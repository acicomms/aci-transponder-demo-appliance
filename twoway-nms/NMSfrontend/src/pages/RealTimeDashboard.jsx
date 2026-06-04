import { useEffect, useState, useRef } from 'react';
import { Client } from '@stomp/stompjs';
import { Box, Typography, Stack, Chip } from '@mui/material';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import BoltIcon from '@mui/icons-material/Bolt';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getWebSocketUrl } from '../utils/websocketUtils';
import { DeviceApi } from '../api/deviceApi';
import { useDevice } from '../contexts/DeviceContext';
// runtime state enum labels (status byte 67/68).
import { formatWorkingMode, formatDfuTypeActive } from '../constants/runtimeStateLabels';
import { formatTemp } from '../utils/temperature';

const formatLastSeen = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatSentinel = (value, unit) => {
  if (value === null || value === undefined) return '—';
  if (value === -999 || value === -999.0) return '—';
  return unit ? `${value} ${unit}` : String(value);
};

function StatusTile({ icon, label, value, isAlarm }) {
  return (
    <Box sx={{
      bgcolor: '#F1F5F9',
      borderRadius: '8px',
      p: 2,
      display: 'flex',
      alignItems: 'center',
      gap: 1.5,
      minWidth: 0,
    }}>
      <Box sx={{
        width: 36, height: 36,
        borderRadius: '8px',
        bgcolor: '#E2E8F0',
        color: 'text.secondary',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', lineHeight: 1.2 }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            color: isAlarm ? '#B91C1C' : 'text.primary',
            lineHeight: 1.4,
            wordBreak: 'break-all',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Box>
  );
}

export default function RealTimeDashboard({ devEui, initialData }) {

  const [deviceData, setDeviceData] = useState(initialData || null);
  // 元件生命週期內只發射一次 startMonitor 的 ref
  const hasTriggeredRef = useRef(false);
  const { requestCommandLock, releaseCommandLock, showToast, tempUnit } = useDevice();

  // ==========================================
  //  元件載入時，單發觸發監控指令03
  // ==========================================
  useEffect(() => {
    if (!devEui || hasTriggeredRef.current) return;

    const triggerMonitor = async () => {
      // 防呆：請求鎖定 (即時監控比較快，給 15 秒即可)
      if (!requestCommandLock('START_MONITOR', 15000)) {
        return; // 如果被頻譜掃描佔用，03 指令就先不發
      }

      try {
        console.log(` 正在呼叫後端啟動設備 ${devEui} 的即時監控...`);
        showToast('Requesting the latest device status...', 'info');
        await DeviceApi.startRealTimeMonitor(devEui);
        // API 成功送進 Queue 就解鎖 (因為 03 監控是背景持續更新，不需要等資料回來才解鎖)
        releaseCommandLock('The instruction has been issued; awaiting data feedback.');
      } catch (error) {
        console.error(' 啟動監控指令失敗', error);
        releaseCommandLock(); // 發生錯誤也要記得解鎖
        showToast('Failed to issue monitoring command', 'error');
      }
    };

    triggerMonitor();
    hasTriggeredRef.current = true;

    // 切換 device / 卸載時 ref 重置, 下次回到 Basic Info tab 會再 trigger 一次
    return () => {
      hasTriggeredRef.current = false;
    };
  }, [devEui]);

  useEffect(() => {
    if (initialData) {
      setDeviceData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    // 建立 WebSocket 連線
    const stompClient = new Client({
      brokerURL: getWebSocketUrl(),
      onConnect: () => {
        console.log(` RealTimeDashboard WebSocket 已連線，監聽設備: ${devEui}`);

        // 訂閱特定設備的 Topic
        stompClient.subscribe(`/topic/device/${devEui}`, (message) => {
          try {
            const newStatus = JSON.parse(message.body);
            console.log(`收到 ${devEui} 即時數據推播:`, newStatus);

            // 將新資料與舊資料合併，避免某些沒推播的欄位變空
            setDeviceData(prev => ({
              ...prev,
              ...newStatus,
              // 兼容舊版扁平結構與新版 measurements 結構
              measurements: {
                ...(prev?.measurements || {}),
                ...(newStatus.measurements || {}),
                temperature:   newStatus.temperature   ?? newStatus.measurements?.temperature   ?? prev?.measurements?.temperature,
                voltage:       newStatus.voltage       ?? newStatus.measurements?.voltage       ?? prev?.measurements?.voltage,
                rfOutputPower: newStatus.rfOutputPower ?? newStatus.measurements?.rfOutputPower ?? prev?.measurements?.rfOutputPower,
                ripple:        newStatus.ripple        ?? newStatus.measurements?.ripple        ?? prev?.measurements?.ripple,
                pilotLowPwr:   newStatus.pilotLowPwr   ?? newStatus.measurements?.pilotLowPwr   ?? prev?.measurements?.pilotLowPwr,
                pilotHighPwr:  newStatus.pilotHighPwr  ?? newStatus.measurements?.pilotHighPwr  ?? prev?.measurements?.pilotHighPwr,
              },
              activeAlarms: {
                ...(prev?.activeAlarms || {}),
                ...(newStatus.activeAlarms || {}),
                isTempAlarm: newStatus.isTempAlarm ?? newStatus.activeAlarms?.isTempAlarm ?? prev?.activeAlarms?.isTempAlarm,
              },
              //  加入 prev?.updatedAt, 避免沒有時間時強制產生 new Date()
              updatedAt: newStatus.timestamp ?? newStatus.updatedAt ?? prev?.updatedAt ?? new Date().toISOString(),
              unitStatus: newStatus.unitStatus ?? prev?.unitStatus ?? 'Unknown',
              // 運作狀態 enum (status byte 67/68). Fallback 跟 measurements 同模式 - newStatus 不帶值時保留 prev.
              workingMode: newStatus.workingMode ?? prev?.workingMode,
              dfuType:     newStatus.dfuType     ?? prev?.dfuType,
            }));
          } catch (e) {
            console.error("解析 WebSocket 訊息失敗", e);
          }
        });
      },
    });

    stompClient.activate();

    // 組件卸載時斷開連線
    return () => stompClient.deactivate();
  }, [devEui]);

  if (!deviceData) {
    return (
      <Typography variant="body2" color="text.secondary">
        Waiting for data...
      </Typography>
    );
  }

  // 提取需要顯示的資料，增加防呆 (Fallback) 處理
  const { measurements = {}, activeAlarms = {}, updatedAt, unitStatus,
          workingMode, dfuType } = deviceData;

  // unitStatus 顏色: Normal 綠 / Alarm 紅 / 其他 (waiting…) 灰
  const statusColor =
    unitStatus === 'Normal' ? 'success.main' :
    unitStatus === 'Alarm'  ? '#B91C1C' :
                              'text.secondary';

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }} flexWrap="wrap">
        <Chip
          size="small"
          label={
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusColor }} />
              <Box component="span">{unitStatus || '—'}</Box>
            </Box>
          }
          sx={{
            bgcolor: '#FFFFFF',
            border: 1,
            borderColor: 'divider',
            fontWeight: 500,
            '& .MuiChip-label': { px: 1, py: 0 },
          }}
        />
        <Chip
          size="small"
          label={`Mode: ${formatWorkingMode(workingMode)}`}
          sx={{ bgcolor: '#F1F5F9', color: '#475569', fontWeight: 500 }}
        />
      </Stack>

      <Typography
        variant="caption"
        sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}
      >
        DFU:{' '}
        <Box component="span" sx={{ color: 'text.primary' }}>
          {formatDfuTypeActive(dfuType)}
        </Box>
        {' · '}
        Updated {formatLastSeen(updatedAt)}
      </Typography>

      {/* 3x2 tile grid: Temperature / 24V Voltage / Ripple / RF Output / Pilot Low / Pilot High */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
        gap: 2,
      }}>
        <StatusTile
          icon={<ThermostatIcon fontSize="small" />}
          label="Temperature"
          value={formatTemp(measurements.temperature, tempUnit)}
          isAlarm={!!activeAlarms.isTempAlarm}
        />
        <StatusTile
          icon={<BoltIcon fontSize="small" />}
          label="24V Voltage"
          value={formatSentinel(measurements.voltage, 'V')}
          isAlarm={!!activeAlarms.isVoltageAlarm}
        />
        <StatusTile
          icon={<GraphicEqIcon fontSize="small" />}
          label="Ripple"
          value={formatSentinel(measurements.ripple, 'mV')}
          isAlarm={!!activeAlarms.isRippleAlarm}
        />
        <StatusTile
          icon={<SignalCellularAltIcon fontSize="small" />}
          label="RF Output Power"
          value={formatSentinel(measurements.rfOutputPower, 'dBmV')}
          isAlarm={!!activeAlarms.isRfPowerAlarm}
        />
        <StatusTile
          icon={<TrendingDownIcon fontSize="small" />}
          label="Pilot Low Power"
          value={formatSentinel(measurements.pilotLowPwr, 'dBmV')}
        />
        <StatusTile
          icon={<TrendingUpIcon fontSize="small" />}
          label="Pilot High Power"
          value={formatSentinel(measurements.pilotHighPwr, 'dBmV')}
        />
      </Box>
    </Box>
  );
}