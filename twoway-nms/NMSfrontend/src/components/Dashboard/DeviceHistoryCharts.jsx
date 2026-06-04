import { useState, useEffect } from 'react';
import { Box, ToggleButtonGroup, ToggleButton, CircularProgress, Typography, IconButton, Tooltip } from '@mui/material';
import ReactECharts from 'echarts-for-react';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DeviceApi } from '../../api/deviceApi';
import { useDevice } from '../../contexts/DeviceContext';
import { cToF, round1 } from '../../utils/temperature';

export default function DeviceHistoryCharts({ devEui }) {
  const { tempUnit } = useDevice();
  const [timeRange, setTimeRange] = useState('24h');
  const [layoutMode, setLayoutMode] = useState('combined');
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(false);


  const toLocalISOString = (date) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, -1);
  };


  // 取得歷史資料
  const fetchHistory = async () => {
    if (!devEui) return;
    setLoading(true);

    try {
      const end = new Date();
      const start = new Date();
      if (timeRange === '6h') start.setHours(start.getHours() - 6);
      else if (timeRange === '24h') start.setHours(start.getHours() - 24);
      else if (timeRange === '7d') start.setDate(start.getDate() - 7);
      //  使用新的轉換函式 確保傳給後端的是精準的台灣時間字串
      const data = await DeviceApi.getDeviceHistory(devEui, toLocalISOString(start), toLocalISOString(end));

      // 因為後端回傳通常是 createdAt 遞減(最新的在最前) 為了畫圖表將它反轉為遞增
      setHistoryData([...data].reverse());
    } catch (error) {
      console.error("載入歷史資料失敗", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [devEui, timeRange]);

  // 準備 ECharts 需要的資料陣列
  const xData = historyData.map(d => new Date(d.createdAt).toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }));
  const tempSeries = historyData.map(d =>
    (tempUnit === 'F' && d.temperature != null ? round1(cToF(d.temperature)) : d.temperature)
  );
  const voltSeries = historyData.map(d => d.voltage);
  const rfSeries = historyData.map(d => d.rfOutputPower);
  const rippleSeries = historyData.map(d => d.ripple);

  // === 產生 ECharts 配置檔 (Option) ===
  const getChartOption = () => {
    const baseOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      legend: { top: 0 },
      dataZoom: [{ type: 'slider', xAxisIndex: 'all', bottom: 5, height: 20 }],
      color: ['#ee6666', '#5470c6', '#91cc75', '#fac858'] // 溫度紅, RF藍, 電壓綠, 漣波黃
    };

    if (layoutMode === 'combined') {
      // --- 模式一：2 張雙 Y 軸大圖 ---
      return {
        ...baseOption,
        grid: [
          { top: '10%', height: '35%', left: '5%', right: '5%' }, // 上方的圖
          { top: '55%', height: '35%', left: '5%', right: '5%' }  // 下方的圖
        ],
        xAxis: [
          { type: 'category', data: xData, gridIndex: 0, axisLabel: { show: false } }, // 上方藏起 X 軸文字
          { type: 'category', data: xData, gridIndex: 1 } // 下方顯示 X 軸文字
        ],
        yAxis: [
          { type: 'value', name: tempUnit === 'F' ? 'Temp. (℉)' : 'Temp. (℃)', gridIndex: 0, position: 'left' },
          { type: 'value', name: 'RF (dBmV)', gridIndex: 0, position: 'right' },
          { type: 'value', name: 'Vol. (V)', gridIndex: 1, position: 'left' },
          { type: 'value', name: 'ripple (mV)', gridIndex: 1, position: 'right' }
        ],
        series: [
          { name: 'Temp.', type: 'line', smooth: true, data: tempSeries, xAxisIndex: 0, yAxisIndex: 0 },
          { name: 'RFpower', type: 'line', smooth: true, data: rfSeries, xAxisIndex: 0, yAxisIndex: 1 },
          { name: '24V Vol.', type: 'line', smooth: true, data: voltSeries, xAxisIndex: 1, yAxisIndex: 2 },
          { name: '24V ripple', type: 'line', smooth: true, data: rippleSeries, xAxisIndex: 1, yAxisIndex: 3 }
        ]
      };
    } else {
      // --- 模式二：4 張獨立單 Y 軸小圖...沒用到 ---
      return {
        ...baseOption,
        grid: [
          { top: '8%', height: '17%', left: '5%', right: '5%' },
          { top: '28%', height: '17%', left: '5%', right: '5%' },
          { top: '48%', height: '17%', left: '5%', right: '5%' },
          { top: '68%', height: '17%', left: '5%', right: '5%' }
        ],
        xAxis: [
          { type: 'category', data: xData, gridIndex: 0, axisLabel: { show: false } },
          { type: 'category', data: xData, gridIndex: 1, axisLabel: { show: false } },
          { type: 'category', data: xData, gridIndex: 2, axisLabel: { show: false } },
          { type: 'category', data: xData, gridIndex: 3 } // 只有最下面顯示時間
        ],
        yAxis: [
          { type: 'value', name: 'Temp. (℃)', gridIndex: 0 },
          { type: 'value', name: 'RF power', gridIndex: 1 },
          { type: 'value', name: 'Vol (V)', gridIndex: 2 },
          { type: 'value', name: 'ripple (mV)', gridIndex: 3 }
        ],
        series: [
          { name: 'Temp.', type: 'line', smooth: true, data: tempSeries, xAxisIndex: 0, yAxisIndex: 0 },
          { name: 'RFPower', type: 'line', smooth: true, data: rfSeries, xAxisIndex: 1, yAxisIndex: 1 },
          { name: '24V Vol.', type: 'line', smooth: true, data: voltSeries, xAxisIndex: 2, yAxisIndex: 2 },
          { name: '24V ripple', type: 'line', smooth: true, data: rippleSeries, xAxisIndex: 3, yAxisIndex: 3 }
        ]
      };
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Range toggle + Refresh */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={timeRange}
          onChange={(e, val) => val && setTimeRange(val)}
        >
          <ToggleButton value="6h">6h</ToggleButton>
          <ToggleButton value="24h">24h</ToggleButton>
          <ToggleButton value="7d">7d</ToggleButton>
        </ToggleButtonGroup>
        <Tooltip title="Reload history">
          <IconButton size="small" color="primary" onClick={fetchHistory}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 圖表渲染區 */}
      {loading ? (
        <Box sx={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      ) : historyData.length === 0 ? (
        <Box sx={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9f9f9', borderRadius: 2 }}>
          <Typography color="textSecondary">No DATA</Typography>
        </Box>
      ) : (
        // ECharts 渲染元件 設定高度以容納多張圖
        <ReactECharts
          option={getChartOption()}
          style={{ height: '600px', width: '100%' }}
          notMerge={true} // 切換佈局時徹底重繪 避免軸線殘留
        />
      )}
    </Box>
  );
}