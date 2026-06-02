import { useState, useEffect, useRef } from 'react';
import { Box, Card, Button, Typography, LinearProgress, Grid } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import { Client } from '@stomp/stompjs';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { DeviceApi } from '../../api/deviceApi';
import { getWebSocketUrl } from '../../utils/websocketUtils';

import { useDevice } from '../../contexts/DeviceContext';
import { SECTION_CARD_SX, SECTION_CARD_TITLE_SX } from '../../constants/cardStyles';


// 頻率從111MHz開始間隔6MHz   最高到1791MHz 共281個點
const FREQ_POINTS = Array.from({ length: 281 }, (_, i) => 111 + i * 6);

export default function SpectrumDashboard({ devEui }) {

    // 防呆工具
    const { pendingCommand, requestCommandLock, releaseCommandLock, showToast } = useDevice();
    // 判斷現在是否正在掃描
    const isScanning = pendingCommand === 'SPECTRUM_SCAN';
    // 初始化空陣列準備承接資料
    const [spectrumData, setSpectrumData] = useState(
        FREQ_POINTS.map(f => ({ freq: f, input: null, output: null }))
    );
    const [progress, setProgress] = useState(0);
    const [statusMsg, setStatusMsg] = useState('Click Scan');


    // 用來攔截並解決WebSocket 訊息的 Promise Resolver
    const wsResolver = useRef(null);

    useEffect(() => {
        const stompClient = new Client({
            brokerURL: getWebSocketUrl(),
            onConnect: () => {
                console.log(' 頻譜專用 WebSocket 已連線');
                stompClient.subscribe(`/topic/device/${devEui}`, (message) => {
                    const data = JSON.parse(message.body);

                    // 如果收到的是頻譜 Raw Data且目前剛好在等待資料
                    if (data.updateType === 'SPECTRUM_RAW' && wsResolver.current) {
                        wsResolver.current(data.powerValues); // 將資料拋給 async 迴圈
                        wsResolver.current = null; // 消耗掉這個 Resolver
                    }
                });
            }
        });

        stompClient.activate();
        return () => stompClient.deactivate();
    }, [devEui]);

    // 依序呼叫 6 個指令並組裝資料
    const startScan = async () => {
        if (!devEui) return;

        // scan 過期, pendingCommand 被強制清為 null, MainContent.handleTabChange
        // 的 isSpectrumScanning 保護會失效, in-flight cmd 仍可能被 clearDeviceQueue 殺掉.
        if (!requestCommandLock('SPECTRUM_SCAN', 120000)) {
            return; // 如果別人正在用 直接中斷執行
        }

        setProgress(0);
        showToast(' The spectrum scan command has been sent. Please wait patiently....', 'info');


        // 建立一個臨時陣列來組裝拼圖，避免 React state 更新不及時
        let currentData = FREQ_POINTS.map(f => ({ freq: f, input: null, output: null }));

        // 定義 6 塊拼圖的任務與對應的起始 Index
        const tasks = [
            { type: 0, part: 1, name: 'Input spectrum Part I (111~669MHz)', startIndex: 0 },
            { type: 0, part: 2, name: 'Input spectrum Part II (675~1233MHz)', startIndex: 94 },
            { type: 0, part: 3, name: 'Input spectrum Part III (1237~1791MHz)', startIndex: 188 },
            { type: 1, part: 1, name: 'Input spectrum Part I (111~669MHz)', startIndex: 0 },
            { type: 1, part: 2, name: 'Input spectrum Part II (675~1233MHz)', startIndex: 94 },
            { type: 1, part: 3, name: 'Input spectrum Part III (1237~1791MHz)', startIndex: 188 },
        ];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            setStatusMsg(`Scanning: ${task.name} ...`);

            try {
                await DeviceApi.scanSpectrum(devEui, task.type, task.part);

                // 暫停迴圈 等待WebSocket推播這包資料(附帶45秒防呆超時)
                const powerValues = await new Promise((resolve) => {
                    wsResolver.current = resolve;
                    setTimeout(() => {
                        if (wsResolver.current) {
                            console.warn(` ${task.name} 接收超時`);
                            wsResolver.current = null;
                            resolve(null); // 超時回傳 null
                        }
                    }, 45000);
                });

                // 塞進大陣列對應的位置
                if (powerValues && powerValues.length > 0) {
                    const isOutput = task.type === 1;

                    powerValues.forEach((val, idx) => {

                        // //  【硬體 Bug 修正】
                        // // 硬體的 Buffer 只有 176 Bytes 超過 88 個點以後的資料是因截斷產生的垃圾值(如24dBmV或 0)
                        // // 所以我們強制只採納前 88 個有效的頻率點
                        // if (idx >= 88) return;


                        const targetIdx = task.startIndex + idx;
                        if (targetIdx < currentData.length) {

                            // 過濾邏輯：如果數值 -1000(無訊號)或是0(補空白) 就設為 null 讓圖表留空
                            let finalVal = val;


                            // 過濾 -1000 dBmV (lost )
                            // if (val <= -100) {
                            // // if (val <= -100 || val === 0) {
                            //     finalVal = null;
                            // }


                            if (isOutput) {
                                currentData[targetIdx].output = finalVal;
                            } else {
                                currentData[targetIdx].input = finalVal;
                            }
                        }
                    });
                    //每拚一塊 就繪圖一次
                    setSpectrumData([...currentData]);
                } else {
                    setStatusMsg(` Warn: ${task.name} Timeout or no data`);
                }

            } catch (err) {
                console.error(`執行 ${task.name} 失敗:`, err);
            }

            // 更新進度條
            setProgress(Math.round(((i + 1) / tasks.length) * 100));
        }

        setStatusMsg(' Spectrum scan completed');
        //  執行完畢 安全解鎖並推播成功訊息
        releaseCommandLock('Spectrum scan completed')

    };

    // === 產生 ECharts 頻譜配置檔  ===
    const getChartOption = () => {
        return {
            backgroundColor: '#181818', 
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', crossStyle: { color: '#999' } },
                formatter: function (params) {
                    let str = `<div style="font-weight:bold;margin-bottom:5px;">frequency: ${params[0].axisValue} MHz</div>`;
                    params.forEach(p => {
                        const val = p.value !== null ? `${p.value} dBmV` : 'Scaning...';
                        str += `<span style="color:${p.color}">●</span> ${p.seriesName}: <strong>${val}</strong><br/>`;
                    });
                    return str;
                }
            },
            legend: {
                data: ['Input Power ', 'Output Power '],
                textStyle: { color: '#ccc' },
                top: 10
            },
            grid: { top: 50, left: 50, right: 30, bottom: 60 },
            dataZoom: [{ type: 'slider', bottom: 10, textStyle: { color: '#fff' } }, { type: 'inside' }],
            xAxis: {
                type: 'category',
                name: 'Frequency (MHz)',
                nameLocation: 'middle',
                nameGap: 25,
                data: spectrumData.map(d => d.freq),
                axisLine: { lineStyle: { color: '#666' } },
                axisLabel: { color: '#aaa', interval: 40 }, 
            },
            yAxis: {
                type: 'value',
                name: 'Power (dBmV)',
                min: 0,
                max: 80,
                axisLine: { show: true, lineStyle: { color: '#666' } },
                splitLine: { lineStyle: { color: '#333', type: 'dashed' } },
                axisLabel: { color: '#aaa' }
            },
            series: [
                {
                    name: 'Output Power ',
                    type: 'bar',
                    barWidth: '100%',
                    barGap: '-100%', 
                    itemStyle: { color: 'rgba(54, 162, 235, 0.8)' }, 
                    data: spectrumData.map(d => d.output)
                },
                {
                    name: 'Input Power ',
                    type: 'bar',
                    barWidth: '100%',
                    itemStyle: { color: 'rgba(255, 206, 86, 0.9)' }, 
                    data: spectrumData.map(d => d.input)
                }
            ]
        };
    };

    return (
        <Card variant="outlined" sx={SECTION_CARD_SX}>
            <Box sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                justifyContent: 'space-between',
                alignItems: { xs: 'stretch', sm: 'center' }, 
                gap: 2
            }}>
                <Typography sx={SECTION_CARD_TITLE_SX}>
                    RF Spectrum Analyzer
                </Typography>
                <Button
                    variant="contained"
                    color={isScanning ? "warning" : "primary"}
                    startIcon={isScanning ? null : <PlayArrowIcon />}
                    onClick={startScan}
                    disabled={isScanning || !devEui}
                >
                    {isScanning ? 'Scanning...' : 'Start full scan'}
                </Button>
            </Box>

            {/* 掃描狀態與進度條 */}
            <Box sx={{ p: 2, bgcolor: 'background.default' }}>
                <Grid container alignItems="center" spacing={2}>
                    <Grid size={{ xs: 12, sm: 8 }}>
                        <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <Typography variant="body2" color="textSecondary" align="right">
                            {statusMsg} ({progress}%)
                        </Typography>
                    </Grid>
                </Grid>
            </Box>

            {/* ECharts 頻譜圖渲染區 */}
            <Box sx={{ p: 2, bgcolor: '#181818', borderRadius: '0 0 12px 12px' }}>
                <ReactECharts
                    option={getChartOption()}
                    style={{ height: '450px', width: '100%' }}
                    notMerge={true}
                />
            </Box>
        </Card>
    );
}