import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, IconButton, Table, TableHead, TableBody, TableRow, TableCell, Tabs, Tab, Card, CardContent, Typography, Box, Grid, CircularProgress, Chip, Button, Tooltip, Stack, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, MenuItem, Select, FormControl, InputLabel, Switch, FormControlLabel, Divider } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Client } from '@stomp/stompjs';
import { DeviceApi } from '../../api/deviceApi';
import RealTimeDashboard from '../../pages/RealTimeDashboard';

import DeviceHistoryCharts from '../Dashboard/DeviceHistoryCharts';
import SpectrumDashboard from '../Dashboard/SpectrumDashboard';
import DeviceLinkMetricsCharts from '../Dashboard/DeviceLinkMetricsCharts';
import GatewayMetricsCharts from '../Dashboard/GatewayMetricsCharts';

import DeviceTopology from '../../components/Topology/DeviceTopology';

import SettingsTab from '../Device/SettingsTab';
import DiagnosticsTab from '../Device/DiagnosticsTab';

import { getWebSocketUrl } from '../../utils/websocketUtils';

import { useDevice } from '../../contexts/DeviceContext';
import StatusBadge from '../Common/StatusBadge';
import PageHeader from './PageHeader';
import {
  SECTION_CARD_SX,
  SECTION_CARD_TITLE_SX,
  PAGE_SECTION_HEADING_SX,
  PAGE_BG_SX,
  METADATA_STRIP_SX,
  BORDERLESS_TABLE_HEAD_SX,
  BORDERLESS_TABLE_BODY_SX,
} from '../../constants/cardStyles';
// setting definitions reused for readonly snapshot in Basic Info tab.
import { ALARM_SETTINGS, RF_MODE_SETTINGS, RF_LOADING_SETTINGS } from '../../constants/settingDefinitions';

// ChirpStack lastSeenAt (ISO8601) => YYYY-MM-DD HH:mm:ss
// null / parse 失敗 => '-'.
const formatLastSeen = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatSentinel = (value, unit) => {
  if (value === null || value === undefined) return '—';
  if (value === -999 || value === -999.0) return '—';
  return unit ? `${value} ${unit}` : String(value);
};

const kebabToCamel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// DFU type → option label, e.g. 1 → "1 — 204/258 MHz" (per Phase 2 spec).
const formatDfuLabel = (v) => {
  if (v === null || v === undefined || v === -999) return '—';
  const opt = RF_MODE_SETTINGS[0].options.find(o => o.value === v);
  return opt ? opt.label : String(v);
};

const formatAlscLabel = (v) => {
  if (v === null || v === undefined || v === -999) return '—';
  if (v === 1) return 'ON';
  if (v === 0) return 'OFF (TGC mode)';
  return String(v);
};

export default function MainContent({ selectedDevice }) {

  // ==========================================
  //  過渡期開發開關 (Feature Toggle)
  // 當未來硬體到位，只需將此處改為 false，fu, 切換tab自動重置queue機制就會完全失效。
  // ==========================================
  const ENABLE_AUTO_RESET_ON_TAB_CHANGE = true;


  const [gwTab, setGwTab] = useState(0);
  const [gwLocation, setGwLocation] = useState({ lat: 0, lon: 0 });

  const [tab, setTab] = useState(0);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const [isClearingQueue, setIsClearingQueue] = useState(false);
  const [clearQueueOpen, setClearQueueOpen] = useState(false);

  const { requestCommandLock, releaseCommandLock, pendingCommand, setSelectedDevice, showToast, refreshSidebarData, appsData } = useDevice();
  const navigate = useNavigate();

  // === add Device modal state ===
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [addDeviceForm, setAddDeviceForm] = useState({
    devEui: '',
    name: '',
    description: '',
    deviceProfileId: '',
    appKey: '',
    isDisabled: false,
    skipFcntCheck: false,
  });
  const [addDeviceErrors, setAddDeviceErrors] = useState({});
  const [addDeviceSubmitting, setAddDeviceSubmitting] = useState(false);
  const [deviceProfiles, setDeviceProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState(null);

  // Per-target manual sync cooldown countdown state
  // syncCooldown[target] = remaining seconds (0 means ready)
  const [syncCooldown, setSyncCooldown] = useState({ INFO: 0, SETTINGS: 0, STATUS: 0 });

  // Tick down all active cooldowns once per second
  useEffect(() => {
    const anyActive = Object.values(syncCooldown).some(v => v > 0);
    if (!anyActive) return;
    const id = setInterval(() => {
      setSyncCooldown(prev => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (next[k] > 0) next[k] = Math.max(0, next[k] - 1);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [syncCooldown]);

  const [syncPending, setSyncPending] = useState({ INFO: false, SETTINGS: false, STATUS: false });
  const syncTimerRef = useRef({ INFO: null, SETTINGS: null, STATUS: null });

  const clearSyncPending = (target) => {
    setSyncPending(prev => (prev[target] ? { ...prev, [target]: false } : prev));
    if (syncTimerRef.current[target]) {
      clearTimeout(syncTimerRef.current[target]);
      syncTimerRef.current[target] = null;
    }
  };

  const isGateway = selectedDevice?.itemType === 'gateway';
  const isApplication = selectedDevice?.itemType === 'application';

  // === Application CRUD state ===
  const [appEditOpen, setAppEditOpen] = useState(false);
  const [appEditName, setAppEditName] = useState('');
  const [appEditDescription, setAppEditDescription] = useState('');
  const [appEditing, setAppEditing] = useState(false);

  const [appDeleteOpen, setAppDeleteOpen] = useState(false);
  const [appDeleting, setAppDeleting] = useState(false);

  // === Device Delete + OTAA Keys state ===
  const [deviceKeys, setDeviceKeys] = useState(null);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keysReloadKey, setKeysReloadKey] = useState(0); // bumped by Retry button
  const [deleteDeviceOpen, setDeleteDeviceOpen] = useState(false);
  const [deleteDeviceSubmitting, setDeleteDeviceSubmitting] = useState(false);

  // 切換到不同Gateway時 初始化座標數值
  useEffect(() => {
    if (isGateway) {
      setGwLocation({
        lat: selectedDevice.latitude || 0,
        lon: selectedDevice.longitude || 0
      });
      setGwTab(0);
    }
  }, [selectedDevice?.gatewayId, isGateway]);





  // ==========================================
  //  過渡期開發開關 (Feature Toggle)
  // 新增切換tab自動重置queue機制：處理 Tab 切換的包裝函式
  // ==========================================
  const handleTabChange = async (event, newValue) => {
    // 1. 先執行原本的 Tab 切換
    setTab(newValue);

    //  檢查目前系統是否正在背景同步..如果是則禁止清空queue
    const isSyncing = deviceDetail?.syncStatus === 'SYNCING';
    // [Spectrum scan 保護] scan 進行中切 tab 不能 clear queue, 否則會把
    // in-flight cmd 4~9 殺掉 (實測 cmd 9 因此 missing)
    const isSpectrumScanning = pendingCommand === 'SPECTRUM_SCAN';
    // 如果開關開啟、不在背景同步、也不在 spectrum scan, 才執行自動重置 Queue
    if (ENABLE_AUTO_RESET_ON_TAB_CHANGE && devEui && !isSyncing && !isSpectrumScanning) {
      try {
        await DeviceApi.clearDeviceQueue(devEui);
        releaseCommandLock();
      } catch (error) {
        console.warn("Automatic reset failed", error);
      }
    } else if (isSyncing) {
      console.log(" 系統正在背景拉取初始化資料，跳過 Queue 清空保護指令！");
    } else if (isSpectrumScanning) {
      console.log(" Spectrum scan 進行中，跳過 Queue 清空保護指令！");
    }
  };

  const devEui = selectedDevice?.devEui;

  const fetchDeviceDetail = async (showLoading = true) => {
    if (!devEui) return;
    if (showLoading) setLoading(true);

    try {
      const data = await DeviceApi.getDeviceDetail(devEui);
      setDeviceDetail(data);
    } catch (error) {
      console.error("無法載入設備詳情", error);
      setDeviceDetail(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (isApplication || !devEui) {
      setDeviceDetail(null);
      return;
    }

    setTab(0);
    setDeviceDetail(null);
    fetchDeviceDetail(true);

    const stompClient = new Client({
      //brokerURL: 'ws://localhost:8080/ws-monitoring/websocket',
      brokerURL: getWebSocketUrl(),
      onConnect: () => {
        // console.log(` MainContent WebSocket 已連線，開始監聽設備 ${devEui}`);
        stompClient.subscribe(`/topic/device/${devEui}`, (message) => {

          const data = JSON.parse(message.body);

          if (data.updateType === 'BASIC_INFO_UPDATED') {
            showToast('Latest device info received', 'success');
            clearSyncPending('INFO');
            fetchDeviceDetail(false);
          }
          else if (data.updateType === 'SETTINGS_UPDATED') {
            showToast('Latest device settings received', 'success');
            clearSyncPending('SETTINGS');
            fetchDeviceDetail(false);
          }
          else if (data.updateType === 'TELEMETRY_UPDATED') {
            clearSyncPending('STATUS');
            setTimeout(() => {
              fetchDeviceDetail(false);
            }, 1000);
          }
          else {

            console.log(" 收到後端資料更新推播，背景重新拉取 API...");
            setTimeout(() => {
              fetchDeviceDetail(false);
            }, 1000);
          }
        });
      }
    });

    stompClient.activate();
    return () => stompClient.deactivate();
  }, [devEui, isApplication]);

  // ==========================================
  // Fetch OTAA keys when device changes
  // ==========================================
  useEffect(() => {
    if (isApplication || !devEui) {
      setDeviceKeys(null);
      return;
    }
    let cancelled = false;
    const fetchKeys = async () => {
      setKeysLoading(true);
      try {
        const data = await DeviceApi.getDeviceKeys(devEui);
        if (!cancelled) setDeviceKeys(data);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load device keys:', error);
          setDeviceKeys(null);
        }
      } finally {
        if (!cancelled) setKeysLoading(false);
      }
    };
    fetchKeys();
    return () => { cancelled = true; };
  }, [devEui, isApplication, keysReloadKey]);

  if (!selectedDevice) {
    return <div style={{ padding: '20px' }}>Select the device from the left-hand navigation bar to view detailed information.</div>;
  }


  //  手動同步 (per-target cooldown + per-target pending, 不走全域 commandLock)
  // 成功送出後同時起 cooldown (10s) 跟 pending (最多 20s, 收到推播會提早結束).
  const handleManualSync = async (target) => {
    if (syncCooldown[target] > 0) return; // UI 已 disabled, 雙重保險
    if (syncPending[target]) return;      // 等推播中, 拒絕重複送
    try {
      await DeviceApi.syncDeviceData(devEui, target);
      showToast('Refresh requested', 'info');
      setSyncCooldown(prev => ({ ...prev, [target]: 10 }));
      setSyncPending(prev => ({ ...prev, [target]: true }));
      // 兜底 20s timeout: 設備沒回就把 pending 清掉, 並 toast 提示
      if (syncTimerRef.current[target]) clearTimeout(syncTimerRef.current[target]);
      syncTimerRef.current[target] = setTimeout(() => {
        setSyncPending(prev => ({ ...prev, [target]: false }));
        syncTimerRef.current[target] = null;
        showToast('No response from device within 20s', 'warning');
      }, 20000);
    } catch (error) {
      const status = error?.response?.status;
      const retryAfter = error?.response?.data?.retryAfterSeconds;
      if (status === 429 && retryAfter) {
        setSyncCooldown(prev => ({ ...prev, [target]: retryAfter }));
        showToast(`Please wait ${retryAfter}s before next refresh`, 'warning');
      } else {
        showToast('Refresh request failed', 'error');
      }
    }
  };

  const handleAppEditOpen = () => {
    setAppEditName(selectedDevice?.name || '');
    setAppEditDescription(selectedDevice?.description || '');
    setAppEditOpen(true);
  };

  const handleAppEditClose = () => {
    if (appEditing) return;
    setAppEditOpen(false);
  };

  const handleAppEditSubmit = async () => {
    if (!selectedDevice?.id) return;
    if (!appEditName.trim()) {
      showToast('Name is required', 'warning');
      return;
    }
    setAppEditing(true);
    try {
      await DeviceApi.updateApplication(selectedDevice.id, appEditName.trim(), appEditDescription);
      showToast('Application updated', 'success');
      setAppEditOpen(false);
      setSelectedDevice({
        ...selectedDevice,
        name: appEditName.trim(),
        description: appEditDescription,
      });
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Update failed';
      showToast(msg, 'error');
    } finally {
      setAppEditing(false);
    }
  };

  const handleAppDeleteOpen = () => setAppDeleteOpen(true);

  const handleAppDeleteClose = () => {
    if (appDeleting) return;
    setAppDeleteOpen(false);
  };

  const handleAppDeleteConfirm = async () => {
    if (!selectedDevice?.id) return;
    setAppDeleting(true);
    try {
      await DeviceApi.deleteApplication(selectedDevice.id);
      showToast(`Application "${selectedDevice.name}" deleted`, 'success');
      setAppDeleteOpen(false);
      setSelectedDevice(null);
      navigate('/applications');
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Delete failed';
      showToast(msg, 'error');
    } finally {
      setAppDeleting(false);
    }
  };

  // ==========================================
  // Add Device handlers
  // ==========================================
  const normalizeHex = (s) => (s || '').replace(/[\s-]/g, '').toLowerCase();

  const validateAddDeviceForm = (form) => {
    const errors = {};
    const devEui = normalizeHex(form.devEui);
    const appKey = normalizeHex(form.appKey);
    if (!form.devEui.trim()) errors.devEui = 'DevEUI is required';
    else if (!/^[0-9a-f]{16}$/.test(devEui)) errors.devEui = 'DevEUI must be 16 hex chars';
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.deviceProfileId) errors.deviceProfileId = 'Device profile is required';
    if (!form.appKey.trim()) errors.appKey = 'AppKey is required';
    else if (!/^[0-9a-f]{32}$/.test(appKey)) errors.appKey = 'AppKey must be 32 hex chars';
    return errors;
  };

  const fetchDeviceProfiles = async () => {
    setProfilesLoading(true);
    setProfilesError(null);
    try {
      const list = await DeviceApi.listDeviceProfiles();
      // 只列 OTAA-supported profile (C-1b-i 不做 ABP)
      const otaaOnly = (list || []).filter(p => p.supportsOtaa === true);
      setDeviceProfiles(otaaOnly);
    } catch (error) {
      setProfilesError(error?.response?.data?.message || error.message || 'Load failed');
      setDeviceProfiles([]);
    } finally {
      setProfilesLoading(false);
    }
  };

  const handleAddDeviceOpen = () => {
    setAddDeviceForm({
      devEui: '',
      name: '',
      description: '',
      deviceProfileId: '',
      appKey: '',
      isDisabled: false,
      skipFcntCheck: false,
    });
    setAddDeviceErrors({});
    setAddDeviceOpen(true);
    fetchDeviceProfiles();
  };

  const handleAddDeviceClose = () => {
    if (addDeviceSubmitting) return;
    setAddDeviceOpen(false);
  };

  const handleAddDeviceFieldChange = (field, value) => {
    setAddDeviceForm(prev => ({ ...prev, [field]: value }));
    if (addDeviceErrors[field]) {
      setAddDeviceErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAddDeviceSubmit = async () => {
    const errors = validateAddDeviceForm(addDeviceForm);
    if (Object.keys(errors).length > 0) {
      setAddDeviceErrors(errors);
      return;
    }
    setAddDeviceSubmitting(true);
    try {
      await DeviceApi.createDevice({
        devEui: normalizeHex(addDeviceForm.devEui),
        name: addDeviceForm.name.trim(),
        description: addDeviceForm.description,
        applicationId: selectedDevice.id,
        deviceProfileId: addDeviceForm.deviceProfileId,
        appKey: normalizeHex(addDeviceForm.appKey),
        isDisabled: addDeviceForm.isDisabled,
        skipFcntCheck: addDeviceForm.skipFcntCheck,
      });
      showToast(`Device "${addDeviceForm.name.trim()}" created`, 'success');
      setAddDeviceOpen(false);
      await refreshSidebarData();
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Create failed';
      showToast(msg, 'error');
    } finally {
      setAddDeviceSubmitting(false);
    }
  };

  // === 渲染 Application  ===
  if (isApplication) {
    // 從 appsData 派生最新 application snapshot, Add Device 完成後 devices list 自動 reactive
    const freshApp = (appsData || []).find(a => a.id === selectedDevice.id);
    const appDevices = (freshApp?.devices) || (selectedDevice.devices) || [];
    return (
      <Box sx={PAGE_BG_SX}>
        <PageHeader
          title={selectedDevice.name}
          kind="Application"
          actions={
            <>
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddDeviceOpen}
              >
                Add Device
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={handleAppEditOpen}
              >
                Rename
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleAppDeleteOpen}
              >
                Delete
              </Button>
            </>
          }
        />

        {/* Application metadata strip — bare on page (no Card wrapper) */}
        <Box sx={{
          ...METADATA_STRIP_SX,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          mb: 3,
        }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Application ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {selectedDevice.id}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Description
            </Typography>
            <Typography variant="body2">{selectedDevice.description || '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Device count
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{appDevices.length}</Typography>
          </Box>
        </Box>

        <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>Devices</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Name</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>DevEUI</TableCell>
              <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 120 }}>Status</TableCell>
              <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 180 }}>Last Seen</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {appDevices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  No devices
                </TableCell>
              </TableRow>
            ) : (
              appDevices.map(dev => (
                <TableRow
                  key={dev.devEui}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => setSelectedDevice({ ...dev, itemType: 'device' })}
                >
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{dev.name || dev.devEui}</TableCell>
                  <TableCell sx={{ ...BORDERLESS_TABLE_BODY_SX, fontFamily: 'monospace' }}>
                    {dev.devEui}
                  </TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                    <StatusBadge variant="dot" status={dev.healthStatus} />
                  </TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatLastSeen(dev.lastSeen)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Rename dialog */}
        <Dialog open={appEditOpen} onClose={handleAppEditClose} maxWidth="sm" fullWidth>
          <DialogTitle>Rename Application</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Name"
                required
                fullWidth
                value={appEditName}
                onChange={(e) => setAppEditName(e.target.value)}
                autoFocus
                disabled={appEditing}
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                minRows={2}
                value={appEditDescription}
                onChange={(e) => setAppEditDescription(e.target.value)}
                disabled={appEditing}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleAppEditClose} disabled={appEditing}>Cancel</Button>
            <Button onClick={handleAppEditSubmit} variant="contained" disabled={appEditing}>
              {appEditing ? 'Saving…' : 'Save'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete confirm */}
        <Dialog open={appDeleteOpen} onClose={handleAppDeleteClose} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Application?</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to delete <strong>{selectedDevice?.name}</strong>?
            </DialogContentText>
            {appDevices.length > 0 && (
              <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
                ⚠ This application contains <strong>{appDevices.length}</strong> device(s).
                Deleting will also delete all devices under it.
              </DialogContentText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={handleAppDeleteClose} disabled={appDeleting}>Cancel</Button>
            <Button onClick={handleAppDeleteConfirm} color="error" variant="contained" disabled={appDeleting}>
              {appDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
        {/* Add Device modal (C-1b-i) */}
        <Dialog open={addDeviceOpen} onClose={handleAddDeviceClose} maxWidth="sm" fullWidth>
          <DialogTitle>Add Device</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="DevEUI"
                required
                fullWidth
                value={addDeviceForm.devEui}
                onChange={(e) => handleAddDeviceFieldChange('devEui', e.target.value)}
                error={!!addDeviceErrors.devEui}
                helperText={addDeviceErrors.devEui || '16 hex chars (spaces/hyphens auto stripped)'}
                autoFocus
                disabled={addDeviceSubmitting}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
              <TextField
                label="Name"
                required
                fullWidth
                value={addDeviceForm.name}
                onChange={(e) => handleAddDeviceFieldChange('name', e.target.value)}
                error={!!addDeviceErrors.name}
                helperText={addDeviceErrors.name || ''}
                disabled={addDeviceSubmitting}
              />
              <TextField
                label="Description"
                fullWidth
                multiline
                minRows={2}
                value={addDeviceForm.description}
                onChange={(e) => handleAddDeviceFieldChange('description', e.target.value)}
                disabled={addDeviceSubmitting}
              />
              <FormControl
                fullWidth
                required
                error={!!addDeviceErrors.deviceProfileId}
                disabled={addDeviceSubmitting || profilesLoading}
              >
                <InputLabel id="add-device-profile-label">Device profile</InputLabel>
                <Select
                  labelId="add-device-profile-label"
                  label="Device profile"
                  value={addDeviceForm.deviceProfileId}
                  onChange={(e) => handleAddDeviceFieldChange('deviceProfileId', e.target.value)}
                >
                  {profilesLoading && <MenuItem value="" disabled>Loading…</MenuItem>}
                  {!profilesLoading && profilesError && <MenuItem value="" disabled>Failed to load</MenuItem>}
                  {!profilesLoading && !profilesError && deviceProfiles.length === 0 && (
                    <MenuItem value="" disabled>No OTAA profiles available</MenuItem>
                  )}
                  {!profilesLoading && deviceProfiles.map(p => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name} ({p.region || '-'}, {p.macVersion})
                    </MenuItem>
                  ))}
                </Select>
                {addDeviceErrors.deviceProfileId && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {addDeviceErrors.deviceProfileId}
                  </Typography>
                )}
                {profilesError && (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                    {profilesError} -{' '}
                    <Button size="small" onClick={fetchDeviceProfiles}>Retry</Button>
                  </Typography>
                )}
              </FormControl>
              <TextField
                label="AppKey"
                required
                fullWidth
                value={addDeviceForm.appKey}
                onChange={(e) => handleAddDeviceFieldChange('appKey', e.target.value)}
                error={!!addDeviceErrors.appKey}
                helperText={addDeviceErrors.appKey || 'OTAA Application Key (32 hex chars)'}
                disabled={addDeviceSubmitting}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
              <Divider />
              <FormControlLabel
                control={
                  <Switch
                    checked={addDeviceForm.isDisabled}
                    onChange={(e) => handleAddDeviceFieldChange('isDisabled', e.target.checked)}
                    disabled={addDeviceSubmitting}
                  />
                }
                label="Is disabled"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={addDeviceForm.skipFcntCheck}
                    onChange={(e) => handleAddDeviceFieldChange('skipFcntCheck', e.target.checked)}
                    disabled={addDeviceSubmitting}
                  />
                }
                label="Skip frame-counter checks"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleAddDeviceClose} disabled={addDeviceSubmitting}>Cancel</Button>
            <Button
              onClick={handleAddDeviceSubmit}
              variant="contained"
              disabled={addDeviceSubmitting || profilesLoading}
            >
              {addDeviceSubmitting ? 'Creating…' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }
  // ==========================================
  // 如果選中的是gw 直接渲染拓撲圖
  // ==========================================
  if (isGateway) {
    return (
      <Box sx={PAGE_BG_SX}>
        <PageHeader
          title={selectedDevice.name || selectedDevice.gatewayId}
          kind="Gateway"
          badges={
            <StatusBadge status={selectedDevice.onlineStatus ? 'online' : 'offline'} />
          }
        />

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={gwTab} onChange={(e, val) => setGwTab(val)}>
            <Tab label="Topology" />
            <Tab label="Information" />
            <Tab label="Metrics" />
          </Tabs>
        </Box>

        {/* Tab 0: 拓撲圖 */}
        {gwTab === 0 && (
          <DeviceTopology gateway={selectedDevice} />
        )}

        {/* Tab 1: 基本資訊與 gRPC 座標更新 — Phase 5 step 4c: metadata strip + Update Location Card */}
        {gwTab === 1 && (
          <>
            <Box sx={{
              ...METADATA_STRIP_SX,
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
              mb: 3,
            }}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Gateway ID
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {selectedDevice.gatewayId}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Description
                </Typography>
                <Typography variant="body2">{selectedDevice.description || '-'}</Typography>
              </Box>
            </Box>

            <Card variant="outlined" sx={SECTION_CARD_SX}>
              <CardContent>
                <Typography sx={{ ...SECTION_CARD_TITLE_SX, mb: 2 }}>Update Location</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Latitude"
                    size="small"
                    type="number"
                    value={gwLocation.lat}
                    onChange={(e) => setGwLocation({ ...gwLocation, lat: parseFloat(e.target.value) })}
                  />
                  <TextField
                    label="Longitude"
                    size="small"
                    type="number"
                    value={gwLocation.lon}
                    onChange={(e) => setGwLocation({ ...gwLocation, lon: parseFloat(e.target.value) })}
                  />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => DeviceApi.handleSaveGatewayLocation(selectedDevice.gatewayId, gwLocation.lat, gwLocation.lon)}
                  >
                    Save
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </>
        )}

        {/* Tab 2: Gateway Metrics — Phase 5 step 4c: wrapper Card removed (matches Device Tab 2/5) */}
        {gwTab === 2 && (
          <Box>
            <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>Gateway Metrics</Typography>
            <GatewayMetricsCharts gatewayId={selectedDevice.gatewayId} />
          </Box>
        )}
      </Box>
    );
  }


  const handleClearQueueOpen = () => setClearQueueOpen(true);

  const handleClearQueueClose = () => {
    if (isClearingQueue) return;
    setClearQueueOpen(false);
  };

  const handleClearQueueConfirm = async () => {
    setIsClearingQueue(true);
    try {
      await DeviceApi.clearDeviceQueue(devEui);

      // 解除前端鎖定
      releaseCommandLock('Device queue cleared.');
      setClearQueueOpen(false);
    } catch (error) {
      showToast('Failed to clear queue. Check your network.', 'error');
    } finally {
      setIsClearingQueue(false);
    }
  };

  // ==========================================
  // Device Delete + OTAA Keys handlers
  // ==========================================

  // --- Delete Device ---
  const handleDeleteDeviceOpen = () => setDeleteDeviceOpen(true);

  const handleDeleteDeviceClose = () => {
    if (deleteDeviceSubmitting) return;
    setDeleteDeviceOpen(false);
  };

  const handleDeleteDeviceConfirm = async () => {
    if (!devEui) return;
    setDeleteDeviceSubmitting(true);
    try {
      await DeviceApi.deleteDevice(devEui);
      const deletedName = selectedDevice?.name || devEui;
      showToast(`Device "${deletedName}" deleted`, 'success');
      setDeleteDeviceOpen(false);

      // 找 parent application: 優先用 device 物件上的 applicationId (backend 已 put),
      // fallback 反向找 (處理 stale appsData 邊界情況)
      const appId = selectedDevice?.applicationId;
      const parentApp =
        (appId && (appsData || []).find(a => a.id === appId)) ||
        (appsData || []).find(a => a.devices?.some(d => d.devEui === devEui));

      if (parentApp) {
        setSelectedDevice({ ...parentApp, itemType: 'application' });
      } else {
        setSelectedDevice(null);
        navigate('/applications');
      }
      await refreshSidebarData();
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Delete failed';
      showToast(msg, 'error');
    } finally {
      setDeleteDeviceSubmitting(false);
    }
  };

  // --- Copy AppKey ---
  const handleCopyAppKey = async () => {
    if (!deviceKeys?.appKey) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(deviceKeys.appKey);
      } else {
        // HTTP (non-secure) fallback: hidden textarea + execCommand
        const ta = document.createElement('textarea');
        ta.value = deviceKeys.appKey;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      showToast('AppKey copied', 'success');
    } catch (error) {
      showToast('Copy failed', 'error');
    }
  };

  // --- Copy DevEUI (Phase 2-1) ---
  const handleCopyDevEui = async () => {
    if (!devEui) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(devEui);
      } else {
        const ta = document.createElement('textarea');
        ta.value = devEui;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (!ok) throw new Error('execCommand copy failed');
      }
      showToast('DevEUI copied', 'success');
    } catch (error) {
      showToast('Copy failed', 'error');
    }
  };


  // === 渲染 Device  ===
  return (
    <Box sx={PAGE_BG_SX}>
      <PageHeader
        title={selectedDevice.name || devEui}
        kind="Device"
        thumbnail={
          <Box
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'grey.300',
              borderRadius: '8px',
              flexShrink: 0,
            }}
          />
        }
        badges={
          <>
            {deviceDetail?.healthStatus && (
              <StatusBadge status={deviceDetail.healthStatus} />
            )}
            {deviceDetail?.syncStatus === 'SYNCING' && (
              <Chip
                icon={<CircularProgress size={16} />}
                label="Background sync in progress…"
                color="warning"
                variant="outlined"
                size="small"
              />
            )}
          </>
        }
        actions={
          <>
            <Tooltip title="If the screen freezes or the device is unresponsive, click this button to clear the stuck task.">
              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={isClearingQueue ? <CircularProgress size={16} color="error" /> : <DeleteSweepIcon />}
                onClick={handleClearQueueOpen}
                disabled={isClearingQueue}
                sx={{ minWidth: '140px' }}
              >
                {isClearingQueue ? 'Clearing…' : 'Reset Queue'}
              </Button>
            </Tooltip>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<DeleteIcon />}
              onClick={handleDeleteDeviceOpen}
            >
              Delete Device
            </Button>
          </>
        }
      />


      <Box sx={{ borderBottom: 1, borderColor: 'divider', marginBottom: 2 }}>

        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab label="Basic Info" />
          <Tab label="Settings" />
          <Tab label="History Charts" />
          <Tab label="RF Spectrum" />
          <Tab label="Link Metrics" />
          <Tab label="Diagnostics" />
        </Tabs>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && deviceDetail && (
        <>
          {/* Tab 0: 基本資訊 (Info) — Phase 5 step 4b: wrapper Card removed, metadata strip 4-col */}
          {tab === 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={PAGE_SECTION_HEADING_SX}>Amplifier Information</Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {syncPending.INFO && (
                    <Typography variant="caption" color="text.secondary">Syncing...</Typography>
                  )}
                  <Tooltip title={
                    syncPending.INFO
                      ? 'Waiting for device response (up to 20s)...'
                      : syncCooldown.INFO > 0
                        ? `Cooling down (${syncCooldown.INFO}s)`
                        : 'Reload the latest information from the hardware.'
                  }>
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleManualSync('INFO')}
                        disabled={syncCooldown.INFO > 0 || syncPending.INFO}
                      >
                        {syncPending.INFO
                          ? <CircularProgress size={16} />
                          : syncCooldown.INFO > 0
                            ? <Typography variant="caption">{syncCooldown.INFO}s</Typography>
                            : <RefreshIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>

              {/* Phase 2-1: 4-col → 6-col, prepend DevEUI (mono+Copy), append Last Seen */}
              <Box sx={{
                ...METADATA_STRIP_SX,
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(6, 1fr)' },
                mb: 3,
              }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    DevEUI
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                      {deviceDetail.devEui || '-'}
                    </Typography>
                    {deviceDetail.devEui && (
                      <Tooltip title="Copy DevEUI">
                        <IconButton size="small" onClick={handleCopyDevEui} sx={{ p: 0.25 }}>
                          <ContentCopyIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Stack>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Part Name
                  </Typography>
                  <Typography variant="body2">{deviceDetail.basicInfo.partName || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Part Number
                  </Typography>
                  <Typography variant="body2">{deviceDetail.basicInfo.partNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Serial Number
                  </Typography>
                  <Typography variant="body2">{deviceDetail.basicInfo.serialNumber || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    FW Version
                  </Typography>
                  <Typography variant="body2">{deviceDetail.basicInfo.fwVersion || '-'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Last Seen
                  </Typography>
                  <Typography variant="body2">{formatLastSeen(deviceDetail.lastSeenAt)}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                  Active Alarms
                </Typography>
                {(() => {
                  const aa = deviceDetail.latestStatus?.activeAlarms || {};
                  const items = [
                    { key: 'isTempAlarm',    label: 'Temperature' },
                    { key: 'isVoltageAlarm', label: 'Voltage' },
                    { key: 'isRippleAlarm',  label: 'Ripple' },
                    { key: 'isRfPowerAlarm', label: 'RF Power' },
                  ];
                  const anyActive = items.some(i => aa[i.key]);
                  if (!anyActive) {
                    return <Typography variant="body2" color="text.secondary">None</Typography>;
                  }
                  return (
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {items.map(i => (
                        <Chip
                          key={i.key}
                          label={i.label}
                          size="small"
                          sx={
                            aa[i.key]
                              ? { bgcolor: '#FEE2E2', color: '#B91C1C', fontWeight: 500 }
                              : { bgcolor: '#F1F5F9', color: '#475569' }
                          }
                        />
                      ))}
                    </Stack>
                  );
                })()}
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={PAGE_SECTION_HEADING_SX}>Real-Time Status</Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {syncPending.STATUS && (
                    <Typography variant="caption" color="text.secondary">Syncing...</Typography>
                  )}
                  <Tooltip title={
                    syncPending.STATUS
                      ? 'Waiting for device response (up to 20s)...'
                      : syncCooldown.STATUS > 0
                        ? `Cooling down (${syncCooldown.STATUS}s)`
                        : 'Reload the latest status from the device.'
                  }>
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleManualSync('STATUS')}
                        disabled={syncCooldown.STATUS > 0 || syncPending.STATUS}
                      >
                        {syncPending.STATUS
                          ? <CircularProgress size={16} />
                          : syncCooldown.STATUS > 0
                            ? <Typography variant="caption">{syncCooldown.STATUS}s</Typography>
                            : <RefreshIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>
              <Box sx={{ mb: 3 }}>
                <RealTimeDashboard
                  key={devEui}
                  devEui={devEui}
                  initialData={deviceDetail.latestStatus}
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={PAGE_SECTION_HEADING_SX}>Current Settings</Typography>
                <Stack direction="row" alignItems="center" spacing={1}>
                  {syncPending.SETTINGS && (
                    <Typography variant="caption" color="text.secondary">Syncing...</Typography>
                  )}
                  <Tooltip title={
                    syncPending.SETTINGS
                      ? 'Waiting for device response (up to 20s)...'
                      : syncCooldown.SETTINGS > 0
                        ? `Cooling down (${syncCooldown.SETTINGS}s)`
                        : 'Reload current settings from the device.'
                  }>
                    <span>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleManualSync('SETTINGS')}
                        disabled={syncCooldown.SETTINGS > 0 || syncPending.SETTINGS}
                      >
                        {syncPending.SETTINGS
                          ? <CircularProgress size={16} />
                          : syncCooldown.SETTINGS > 0
                            ? <Typography variant="caption">{syncCooldown.SETTINGS}s</Typography>
                            : <RefreshIcon />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              </Box>

              <Typography sx={{ ...SECTION_CARD_TITLE_SX, mb: 1 }}>Alarm Thresholds</Typography>
              <Table size="small" sx={{ mb: 3, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: '40%' }}>Setting</TableCell>
                    <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ALARM_SETTINGS.map(s => {
                    const value = deviceDetail.settings?.alarms?.[kebabToCamel(s.settingKey)];
                    return (
                      <TableRow key={s.settingKey}>
                        <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{s.label}</TableCell>
                        <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatSentinel(value, s.unit)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <Typography sx={{ ...SECTION_CARD_TITLE_SX, mb: 1 }}>RF Mode</Typography>
              <Table size="small" sx={{ mb: 3, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: '40%' }}>Setting</TableCell>
                    <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{RF_MODE_SETTINGS[0].label}</TableCell>
                    <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                      {formatDfuLabel(deviceDetail.settings?.system?.dfuType)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{RF_MODE_SETTINGS[1].label}</TableCell>
                    <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                      {formatAlscLabel(deviceDetail.settings?.system?.alsc)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              <Typography sx={{ ...SECTION_CARD_TITLE_SX, mb: 1 }}>RF Loading & Pilot</Typography>
              <Table size="small" sx={{ mb: 3, tableLayout: 'fixed' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: '40%' }}>Setting</TableCell>
                    <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {RF_LOADING_SETTINGS.map(s => {
                    const value = deviceDetail.settings?.loadingPilot?.[kebabToCamel(s.settingKey)];
                    return (
                      <TableRow key={s.settingKey}>
                        <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{s.label}</TableCell>
                        <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatSentinel(value, s.unit)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* OTAA Keys — Phase 6d: wrapper Card removed, heading aligned with Amplifier Information page-section style */}
              <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>OTAA Keys</Typography>

              {keysLoading && (
                <Typography color="textSecondary">Loading…</Typography>
              )}

              {!keysLoading && !deviceKeys && (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography color="error">Failed to load keys.</Typography>
                  <Button size="small" onClick={() => setKeysReloadKey(k => k + 1)}>Retry</Button>
                </Stack>
              )}

              {!keysLoading && deviceKeys && (
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="body2" color="textSecondary">AppKey</Typography>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1 }}>
                        {deviceKeys.appKey}
                      </Typography>
                      <Tooltip title="Copy AppKey">
                        <IconButton size="small" onClick={handleCopyAppKey}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                  <Box>
                    <Typography variant="body2" color="textSecondary">
                      Created at:{' '}
                      <Typography component="span" variant="body2" sx={{ color: 'text.primary' }}>
                        {deviceKeys.createdAt ? formatLastSeen(deviceKeys.createdAt) : '-'}
                      </Typography>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Updated at:{' '}
                      <Typography component="span" variant="body2" sx={{ color: 'text.primary' }}>
                        {deviceKeys.updatedAt ? formatLastSeen(deviceKeys.updatedAt) : '-'}
                      </Typography>
                    </Typography>
                  </Box>
                </Stack>
              )}
            </>
          )}

          {tab === 1 && (
            <SettingsTab
              devEui={devEui}
              deviceDetail={deviceDetail}
              syncCooldown={syncCooldown}
              syncPending={syncPending}
              handleManualSync={handleManualSync}
            />
          )}

          {tab === 2 && (
            <Box>
              <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>Historical Charts</Typography>
              <DeviceHistoryCharts devEui={devEui} />
            </Box>
          )}

          {tab === 3 && (
            <SpectrumDashboard devEui={devEui} />
          )}

          {tab === 4 && (
            <Box>
              <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>Link Metrics</Typography>
              <DeviceLinkMetricsCharts devEui={devEui} />
            </Box>
          )}

          {tab === 5 && (
            <DiagnosticsTab devEui={devEui} />
          )}
        </>
      )}

      {/* Delete Device dialog */}
      <Dialog open={deleteDeviceOpen} onClose={handleDeleteDeviceClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Device?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{selectedDevice?.name || devEui}</strong>?
            This will permanently remove the device from ChirpStack.
          </DialogContentText>
          <DialogContentText sx={{ mt: 2, color: 'text.secondary' }}>
            NMS history logs (status / config / spectrum / raw payload / alarm events) will be preserved for audit.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteDeviceClose} disabled={deleteDeviceSubmitting}>Cancel</Button>
          <Button
            onClick={handleDeleteDeviceConfirm}
            color="error"
            variant="contained"
            disabled={deleteDeviceSubmitting}
          >
            {deleteDeviceSubmitting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Queue confirm dialog */}
      <Dialog open={clearQueueOpen} onClose={handleClearQueueClose} maxWidth="sm" fullWidth>
        <DialogTitle>Reset Queue?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to clear the command queue on <strong>{selectedDevice?.name || devEui}</strong>?
            This will interrupt any ongoing tasks.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClearQueueClose} disabled={isClearingQueue}>Cancel</Button>
          <Button
            onClick={handleClearQueueConfirm}
            color="warning"
            variant="contained"
            disabled={isClearingQueue}
          >
            {isClearingQueue ? 'Clearing…' : 'Reset Queue'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}