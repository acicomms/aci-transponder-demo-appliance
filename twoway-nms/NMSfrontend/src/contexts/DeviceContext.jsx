import { createContext, useState, useContext, useRef, useEffect, useCallback } from 'react';
import { Snackbar, Alert } from '@mui/material';
import { DeviceApi } from '../api/deviceApi';
import { toLocalIso } from '../utils/dateUtils';

const DeviceContext = createContext();

export const DeviceProvider = ({ children }) => {
  // P2: default to global dashboard so "/" lands on Dashboard, not blank
  const [selectedDevice, setSelectedDevice] = useState({ itemType: 'global-dashboard' });

  // ==========================================
  // 側邊欄 (Sidebar) 全域資料狀態
  // ==========================================
  const [appsData, setAppsData] = useState([]);
  const [gatewaysData, setGatewaysData] = useState([]);
  // ==========================================
  // 封裝一個可以隨時被呼叫的更新函式 , for 更新左側sidebar用
  // ==========================================
  const refreshSidebarData = async () => {
    try {
      const apps = await DeviceApi.getAppDeviceTree();
      const gws = await DeviceApi.getGateways();
      setAppsData(apps);
      setGatewaysData(gws);
    } catch (error) {
      console.error("載入側邊欄資料失敗", error);
      showToast('Sidebar data loading failed, please check your network connection.', 'error');
    }
  };
  // ==========================================
  // 初次載入 Context 時，自動抓取一次資料
  // ==========================================
  useEffect(() => {
    refreshSidebarData();
  }, []);



  // ==========================================
  // 全域指令鎖定狀態
  // 記錄目前正在執行的指令 (例如: 'SPECTRUM_SCAN', 'SET_TEMP', 'START_MONITOR')
  // ==========================================
  const [pendingCommand, setPendingCommand] = useState(null);
  const timeoutRef = useRef(null); // 用於儲存 Timeout ID

  // ==========================================
  // 全域提示 UI (Snackbar)
  // ==========================================
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });

  const showToast = (message, severity = 'info') => {
    setToast({ open: true, message, severity });
  };

  const closeToast = () => setToast(prev => ({ ...prev, open: false }));

  // ==========================================
  // 請求上鎖 (Request Lock) - 附帶防死鎖機制
  // ==========================================
  const requestCommandLock = (commandType, timeoutMs = 15000) => {
    // 如果目前已經有別的指令在上鎖中，拒絕新的請求
    if (pendingCommand && pendingCommand !== commandType) {
      showToast('Another command is in progress. Please try again.', 'warning');
      return false; // 拒絕執行
    }

    setPendingCommand(commandType);

    // 清除舊的計時器，避免互相干擾
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    //  設定逾時防死鎖機制 (Timeout Fallback)
    // 如果時間到了還沒呼叫 releaseCommandLock，系統自動強制解鎖
    timeoutRef.current = setTimeout(() => {
      setPendingCommand(null);
      showToast('Command timed out. Lock released.', 'error');
    }, timeoutMs);

    return true; // 允許執行
  };

  // ==========================================
  // 解除鎖定 (Release Lock)
  // ==========================================
  const releaseCommandLock = (successMessage = '') => {
    setPendingCommand(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (successMessage) showToast(successMessage, 'success');
  };

  // Bell unread count (LINE-style): count of alarm events with start_time >= localStorage 'alarms.lastOpenedAt'
  const [unreadAlarmCount, setUnreadAlarmCount] = useState(0);

  // ==========================================
  // Bell unread count: poll backend every 30s
  // since localStorage 'alarms.lastOpenedAt'
  // ==========================================
  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const since = localStorage.getItem('alarms.lastOpenedAt')
          || toLocalIso(new Date(Date.now() - 24 * 60 * 60 * 1000)); // fallback: 24h 前
        const res = await DeviceApi.getAlarmEvents({ countOnly: true, since });
        if (!cancelled) setUnreadAlarmCount(res?.count || 0);
      } catch (e) {
        // 安靜失敗, 不打擾使用者
        console.warn('Bell unread poll failed:', e?.message || e);
      }
    };
    fetchCount(); // 立即拉一次
    const id = setInterval(fetchCount, 30 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // 進入 Alarms 頁時呼叫 → 標記已讀, 鈴鐺歸零
  const markAlarmsRead = useCallback(() => {
    localStorage.setItem('alarms.lastOpenedAt', toLocalIso(new Date()));
    setUnreadAlarmCount(0);
  }, []);

  return (
    <DeviceContext.Provider value={{
      selectedDevice, setSelectedDevice,
      appsData, gatewaysData, refreshSidebarData,
      pendingCommand, requestCommandLock, releaseCommandLock, showToast,
      unreadAlarmCount, markAlarmsRead,
    }}>
      {children}

      {/* 全域共用的提示元件 */}
      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={closeToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={closeToast} severity={toast.severity} sx={{ width: '100%', boxShadow: 3 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </DeviceContext.Provider>
  );
};

export const useDevice = () => useContext(DeviceContext);