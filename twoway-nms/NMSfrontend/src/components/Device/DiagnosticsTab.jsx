import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box, Stack, Typography, Button, ToggleButton, ToggleButtonGroup,
  TextField, MenuItem, Alert, AlertTitle, Chip, CircularProgress,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';

import { DeviceApi } from '../../api/deviceApi';
import { useDevice } from '../../contexts/DeviceContext';
import { PAGE_SECTION_HEADING_SX } from '../../constants/cardStyles';
import {
  ALARM_SETTINGS, RF_MODE_SETTINGS, RF_LOADING_SETTINGS,
  BENCH_FWD_SETTINGS, BENCH_REV_SETTINGS, SYSTEM_LOG_SETTINGS,
} from '../../constants/settingDefinitions';

const SET_MODE_OPTIONS = [
  ...ALARM_SETTINGS,
  ...RF_MODE_SETTINGS,
  ...RF_LOADING_SETTINGS,
  ...BENCH_FWD_SETTINGS,
  ...BENCH_REV_SETTINGS,
  ...SYSTEM_LOG_SETTINGS,
];

const POLL_INTERVAL_MS = 2000;

const DEFAULT_TIMEOUT_SEC  = 6;
const MIN_TIMEOUT_SEC      = 1;
const MAX_TIMEOUT_SEC      = 30;

const DEFAULT_INTERVAL_SEC = 0;
const MIN_INTERVAL_SEC     = 0;
const MAX_INTERVAL_SEC     = 60;

const LOG_BUFFER_CAP = 1000;

// HH:mm:ss
const formatClock = (millis) => {
  if (!millis) return '—';
  const d = new Date(millis);
  if (isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// HH:mm:ss.SSS — log line timestamp
const formatLogTs = (millis) => {
  if (!millis) return '—';
  const d = new Date(millis);
  if (isNaN(d.getTime())) return '—';
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

// Stat tile. value can be number, string, or null. 0 renders as 0, not em-dash.
const StatCard = ({ label, value, unit }) => {
  const isEmpty = value === null || value === undefined || value === '';
  const display = isEmpty
    ? '—'
    : (typeof value === 'number' ? value.toLocaleString() : value);
  const showUnit = unit && typeof value === 'number';
  return (
    <Box
      sx={{
        flex: 1, minWidth: 90,
        px: 1.5, py: 1,
        border: 1, borderColor: 'divider', borderRadius: 1,
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography
        component="div"
        variant="h6"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {display}{showUnit ? ` ${unit}` : ''}
      </Typography>
    </Box>
  );
};

// One row of the event log. Color cue by status; monospace + nowrap for alignment.
const LogRow = ({ ev }) => {
  const color =
    ev.status === 'TIMEOUT' ? 'error.main' :
    ev.status === 'ERROR'   ? 'warning.main' :
    ev.status === 'OK'      ? 'success.main' :
    'text.primary';
  const dirTag =
       ev.direction === 'TX' ? '=> TX' :
       ev.direction === 'RX' ? '<= RX' :
       '     ';
  const typeStr  = (ev.type   || '').padEnd(20, ' ');
  const rttStr   = ev.rttMs != null ? `${ev.rttMs}ms`.padStart(8, ' ')  : '       —';
  const rssiStr  = ev.rssi  != null ? `${ev.rssi}dBm`.padStart(7, ' ')  : '      —';

  return (
    <Box
      sx={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.7,
        whiteSpace: 'pre',
        color,
        fontWeight: (ev.status === 'TIMEOUT' || ev.status === 'ERROR') ? 600 : 400,
      }}
    >
      {`${formatLogTs(ev.tsMillis)} ${dirTag} ${typeStr} ${rttStr} ${rssiStr} ${ev.status}`}
    </Box>
  );
};

const DiagnosticsTab = ({ devEui }) => {
  const { showToast } = useDevice();

  // ---------- Form state ----------
  const [mode, setMode]                 = useState('READ');
  const [settingKey, setSettingKey]     = useState('');
  const [settingValue, setSettingValue] = useState('');
  const [timeoutSec, setTimeoutSec]     = useState(DEFAULT_TIMEOUT_SEC);
  const [timeoutText, setTimeoutText]   = useState(String(DEFAULT_TIMEOUT_SEC));
  const [intervalSec, setIntervalSec]   = useState(DEFAULT_INTERVAL_SEC);
  const [intervalText, setIntervalText] = useState(String(DEFAULT_INTERVAL_SEC));

  // ---------- Server state ----------
  const [status, setStatus]           = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState('');
  const pollTimerRef  = useRef(null);
  const prevRunningRef = useRef(false);
  const logScrollRef   = useRef(null);

  const running        = status?.running === true;
  const stoppedReason  = status?.stoppedReason || null;
  // stop() → finalStats; getStatus(running) → stats.
  const stats          = status?.stats || status?.finalStats || null;
  const events         = status?.events || [];

  // Chip state: RUNNING (green) / TIMEOUT (red) / STOPPED (grey)
  const chipState = running
    ? 'RUNNING'
    : (stoppedReason === 'timeout' ? 'TIMEOUT' : 'STOPPED');

  const selectedDef = useMemo(
    () => SET_MODE_OPTIONS.find((s) => s.settingKey === settingKey) || null,
    [settingKey]
  );

  // ---------- Poll status ----------
  const fetchStatus = async () => {
    try {
      const data = await DeviceApi.getRfTestStatus(devEui);
      setStatus(data);
    } catch (e) {
      // Transient — silent retry on next tick. Persistent errors surface
      // through the Start/Stop handlers below.
      console.warn('Link test status poll failed:', e);
    }
  };

  // Mount: recover state if a session is already running.
  useEffect(() => {
    if (!devEui) return;
    fetchStatus();
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devEui]);

  useEffect(() => {
    if (running && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS);
    }
    if (!running && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Toast on timeout transition (was running, now stopped with reason=timeout).
  useEffect(() => {
    if (prevRunningRef.current && !running && stoppedReason === 'timeout') {
      const secs = status?.timeoutSec ?? timeoutSec;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      showToast(`Link test stopped: no response within ${secs}s at ${clock}`, 'warning');
    }
    prevRunningRef.current = running;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, stoppedReason]);

  // Auto-scroll log to bottom when new events arrive (console-like behaviour).
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [events.length]);

  // ---------- Handlers ----------
  const commitTimeout = (raw) => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) {
      setTimeoutText(String(timeoutSec));
      return timeoutSec;
    }
    const c = Math.min(MAX_TIMEOUT_SEC, Math.max(MIN_TIMEOUT_SEC, v));
    setTimeoutSec(c);
    setTimeoutText(String(c));
    return c;
  };

  const commitInterval = (raw) => {
    const v = parseInt(raw, 10);
    if (isNaN(v)) {
      setIntervalText(String(intervalSec));
      return intervalSec;
    }
    const c = Math.min(MAX_INTERVAL_SEC, Math.max(MIN_INTERVAL_SEC, v));
    setIntervalSec(c);
    setIntervalText(String(c));
    return c;
  };

  const handleStart = async () => {
    setErrorMsg('');

    const finalTimeoutSec  = commitTimeout(timeoutText);
    const finalIntervalSec = commitInterval(intervalText);

    if (mode === 'SET') {
      if (!settingKey) {
        setErrorMsg('SET mode requires a setting');
        return;
      }
      if (settingValue === '' || settingValue === null || isNaN(Number(settingValue))) {
        setErrorMsg('SET mode requires a numeric value');
        return;
      }
      if (selectedDef) {
        const v = Number(settingValue);
        if (v < selectedDef.min || v > selectedDef.max) {
          setErrorMsg(`Value out of range: ${selectedDef.min} ~ ${selectedDef.max}`);
          return;
        }
      }
    }

    const body = {
      mode,
      timeoutSec:  finalTimeoutSec,
      intervalSec: finalIntervalSec,
      ...(mode === 'READ' ? { readTarget: 'STATUS' } : {}),
      ...(mode === 'SET'  ? { settingKey, value: Number(settingValue) } : {}),
    };

    setSubmitting(true);
    try {
      const data = await DeviceApi.startRfTest(devEui, body);
      setStatus(data);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Failed to start test';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleStop = async () => {
    setErrorMsg('');
    setSubmitting(true);
    try {
      const data = await DeviceApi.stopRfTest(devEui);
      setStatus(data);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Failed to stop test';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- Render ----------
  return (
    <Box>
      {/* Title + status chip */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography sx={PAGE_SECTION_HEADING_SX}>Link Test</Typography>
        <Chip
          label={chipState}
          size="small"
          color={
            chipState === 'RUNNING' ? 'success' :
            chipState === 'TIMEOUT' ? 'error' :
            'default'
          }
          variant={chipState === 'STOPPED' ? 'outlined' : 'filled'}
        />
      </Stack>

      {/* Description / SET caution */}
      <Alert severity={mode === 'SET' ? 'warning' : 'info'} sx={{ mb: 2 }}>
        <AlertTitle>{mode === 'SET' ? 'SET mode caution' : 'Note:'}</AlertTitle>
        Sequential request-response, and stops on timeout
        {mode === 'SET' && <> <strong>SET mode writes to device on every cycle.</strong></>}
      </Alert>

      {errorMsg && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMsg('')}>
          {errorMsg}
        </Alert>
      )}

      {/* Two-column layout: control + stats on the left, event log on the right.
          Stacks vertically on narrow screens. */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
          gap: 3,
        }}
      >
        {/* ===================== LEFT ===================== */}
        <Box>
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Mode</Typography>
              <ToggleButtonGroup
                value={mode}
                exclusive
                size="small"
                disabled={running || submitting}
                onChange={(_, v) => v && setMode(v)}
              >
                <ToggleButton value="READ">READ</ToggleButton>
                <ToggleButton value="SET">SET</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {mode === 'READ' ? (
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Target</Typography>
                <Chip label="STATUS (40010103)" />
              </Box>
            ) : (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Setting"
                  size="small"
                  value={settingKey}
                  onChange={(e) => {
                    setSettingKey(e.target.value);
                    setSettingValue('');
                  }}
                  disabled={running || submitting}
                  sx={{ minWidth: 220 }}
                >
                  <MenuItem value=""><em>Select setting…</em></MenuItem>
                  {SET_MODE_OPTIONS.map((s) => (
                    <MenuItem key={s.settingKey} value={s.settingKey}>
                      {s.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Value"
                  type="number"
                  size="small"
                  value={settingValue}
                  onChange={(e) => setSettingValue(e.target.value)}
                  disabled={running || submitting || !settingKey}
                  helperText={selectedDef
                    ? `${selectedDef.min} ~ ${selectedDef.max}${selectedDef.unit ? ' ' + selectedDef.unit : ''}`
                    : ' '}
                  inputProps={{
                    min:  selectedDef?.min,
                    max:  selectedDef?.max,
                    step: selectedDef?.step,
                  }}
                  sx={{ width: 180 }}
                />
              </Stack>
            )}

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Timeout (sec)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={timeoutText}
                  onChange={(e) => setTimeoutText(e.target.value)}
                  onBlur={() => commitTimeout(timeoutText)}
                  disabled={running || submitting}
                  inputProps={{ min: MIN_TIMEOUT_SEC, max: MAX_TIMEOUT_SEC, step: 1 }}
                  helperText={`${MIN_TIMEOUT_SEC}–${MAX_TIMEOUT_SEC} sec, default ${DEFAULT_TIMEOUT_SEC}`}
                  sx={{ width: 180 }}
                />
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>Interval (sec)</Typography>
                <TextField
                  type="number"
                  size="small"
                  value={intervalText}
                  onChange={(e) => setIntervalText(e.target.value)}
                  onBlur={() => commitInterval(intervalText)}
                  disabled={running || submitting}
                  inputProps={{ min: MIN_INTERVAL_SEC, max: MAX_INTERVAL_SEC, step: 1 }}
                  helperText={`${MIN_INTERVAL_SEC}–${MAX_INTERVAL_SEC} sec, 0 = immediately`}
                  sx={{ width: 180 }}
                />
              </Box>
            </Stack>

            <Box>
              {running ? (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <StopIcon />}
                  onClick={handleStop}
                  disabled={submitting}
                >
                  {submitting ? 'Stopping…' : 'Stop Test'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                  onClick={handleStart}
                  disabled={submitting || (mode === 'SET' && (!settingKey || settingValue === ''))}
                >
                  {submitting ? 'Starting…' : 'Start Test'}
                </Button>
              )}
            </Box>
          </Stack>

          {/* Stats */}
          {stats && (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <StatCard label="Sent"     value={stats.downlinksSent} />
                <StatCard label="Received" value={stats.uplinksReceived} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <StatCard label="RTT Min" value={stats.rttMinMs} unit="ms" />
                <StatCard label="RTT Avg" value={stats.rttAvgMs} unit="ms" />
                <StatCard label="RTT Max" value={stats.rttMaxMs} unit="ms" />
              </Stack>
              <Stack direction="row" spacing={1}>
                <StatCard label="Last RSSI"   value={stats.lastRssi} unit="dBm" />
                <StatCard label="Last Uplink" value={formatClock(stats.lastUplinkAtMillis)} />
              </Stack>
            </Stack>
          )}
        </Box>

        {/* ===================== RIGHT ===================== */}
        <Box>
          <Stack direction="row" alignItems="baseline" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>Event Log</Typography>
            <Typography variant="caption" color="text.secondary">
              {events.length === 0
                ? 'no events yet'
                : `${events.length} entries${events.length >= LOG_BUFFER_CAP ? ', oldest dropped' : ''}`}
            </Typography>
          </Stack>
          <Box
            ref={logScrollRef}
            sx={{
              height: 500,
              overflow: 'auto',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              p: 1.5,
              bgcolor: 'background.default',
            }}
          >
            {events.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No events yet. Start the test to begin.
              </Typography>
            ) : (
              events.map((ev, idx) => <LogRow key={idx} ev={ev} />)
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default DiagnosticsTab;