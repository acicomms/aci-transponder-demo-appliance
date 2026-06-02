import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, Card, CardContent, Alert,
  Table, TableHead, TableBody, TableRow, TableCell,
  Pagination, FormControl, InputLabel, Select, MenuItem,
  OutlinedInput, Checkbox, ListItemText, Autocomplete,
  TextField, CircularProgress
} from '@mui/material';
import { DeviceApi } from '../api/deviceApi';
import { useDevice } from '../contexts/DeviceContext';
import PageHeader from '../components/Layout/PageHeader';
import {
  PAGE_BG_SX,
  SECTION_CARD_SX,
  BORDERLESS_TABLE_HEAD_SX,
  BORDERLESS_TABLE_BODY_SX,
} from '../constants/cardStyles';

const CATEGORY_OPTIONS = ['TEMPERATURE', 'VOLTAGE', 'RIPPLE', 'TCP', 'UNIT_STATUS'];
const CATEGORY_LABELS  = {
  TEMPERATURE: 'Temperature',
  VOLTAGE:     'Voltage',
  RIPPLE:      'Ripple',
  TCP:         'TCP',
  UNIT_STATUS: 'Unit Status',
};
const formatCategory   = (cat) => CATEGORY_LABELS[cat] || cat;
const STATUS_OPTIONS   = ['ACTIVE', 'CLEARED'];
const PAGE_SIZE        = 50;

// Date 物件 → datetime-local input 字串 ("YYYY-MM-DDTHH:mm")
const toLocalInput = (d) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};

// datetime-local input → 後端 ISO_LOCAL_DATE_TIME (補上 :00 秒)
const toIsoForBackend = (localInput) => {
  if (!localInput) return null;
  return localInput.length === 16 ? `${localInput}:00` : localInput;
};

const formatDuration = (sec) => {
  if (sec == null) return '-';
  const s = Math.max(0, Math.floor(sec));
  if (s < 60)    return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)    return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24)    return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
};

const formatTriggerValue = (category, value) => {
  if (value == null) return '-';
  switch (category) {
    case 'TEMPERATURE': return `${Number(value).toFixed(1)} °C`;
    case 'VOLTAGE':     return `${Number(value).toFixed(1)} V`;
    case 'RIPPLE':      return `${Math.round(value)} mV`;
    case 'TCP':         return `${Number(value).toFixed(1)} dBmV`;
    case 'UNIT_STATUS': return Math.round(Number(value)) === 2 ? 'Alarm' : 'Normal';
    default:            return String(value);
  }
};

const formatDateTime = (str) => {
  if (!str) return '-';
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export default function AlarmsPage() {
  const { appsData, markAlarmsRead } = useDevice();

  // 從 appsData tree 攤平成設備清單
  const allDevices = useMemo(() => {
    const arr = [];
    (appsData || []).forEach(app => {
      (app.devices || []).forEach(d => {
        arr.push({
          devEui: d.devEui,
          name: d.name || d.devEui,
          label: d.name ? `${d.name} (${d.devEui})` : d.devEui,
        });
      });
    });
    return arr;
  }, [appsData]);

  // last 24 hours window: ACTIVE alarm 即使 startTime 比這個更早,
  // 也會被 backend union 進來 (queryAlarmEvents 修法)
  const todayStart = useMemo(() => new Date(Date.now() - 24 * 60 * 60 * 1000), []);

  // ----- filter state -----
  const [selectedDevices, setSelectedDevices]       = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStatus, setSelectedStatus]         = useState('');
  const [startInput, setStartInput]                 = useState(toLocalInput(todayStart));
  const [endInput, setEndInput]                     = useState(toLocalInput(new Date()));
  const [page, setPage]                             = useState(1);

  // ----- data state -----
  const [data, setData]       = useState({ events: [], totalCount: 0, page: 1, pageSize: PAGE_SIZE });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // 進入頁面 → 標記已讀, 鈴鐺立即歸零
  useEffect(() => {
    markAlarmsRead();
  }, [markAlarmsRead]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {
        devEui:   selectedDevices.map(d => d.devEui),
        category: selectedCategories,
        status:   selectedStatus ? [selectedStatus] : [],
        start:    toIsoForBackend(startInput),
        end:      toIsoForBackend(endInput),
        page,
        pageSize: PAGE_SIZE,
        sortBy:   'startTime',
        sortDir:  'desc',
      };
      const res = await DeviceApi.getAlarmEvents(filters);
      setData(res);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [selectedDevices, selectedCategories, selectedStatus, startInput, endInput, page]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const totalPages = Math.max(1, Math.ceil((data.totalCount || 0) / PAGE_SIZE));

  return (
    <Box sx={PAGE_BG_SX}>
      <PageHeader
        title="Alarms"
        count={data.totalCount}
        onRefresh={() => { setPage(1); fetchEvents(); }}
      />

      {/* Filters */}
      <Card variant="outlined" sx={{ ...SECTION_CARD_SX, mb: 2 }}>
        <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="stretch">
          {/* Device */}
          <Autocomplete
            multiple size="small"
            sx={{ minWidth: 240, flex: 1 }}
            options={allDevices}
            getOptionLabel={(o) => o.label}
            isOptionEqualToValue={(a, b) => a.devEui === b.devEui}
            value={selectedDevices}
            onChange={(_, v) => { setSelectedDevices(v); setPage(1); }}
            renderInput={(params) => <TextField {...params} label="Device" placeholder="All devices" />}
          />

          {/* Category */}
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel id="cat-label">Category</InputLabel>
            <Select
              labelId="cat-label" multiple
              value={selectedCategories}
              onChange={(e) => { setSelectedCategories(e.target.value); setPage(1); }}
              input={<OutlinedInput label="Category" />}
              renderValue={(s) => s.length === 0 ? 'All' : s.map(formatCategory).join(', ')}
            >
              {CATEGORY_OPTIONS.map(c => (
                <MenuItem key={c} value={c}>
                  <Checkbox checked={selectedCategories.indexOf(c) > -1} />
                  <ListItemText primary={formatCategory(c)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status */}
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="st-label" shrink>Status</InputLabel>
            <Select
              labelId="st-label" label="Status"
              displayEmpty
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              renderValue={(v) => v || 'All statuses'}
            >
              <MenuItem value=""><em>All statuses</em></MenuItem>
              {STATUS_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </Select>
          </FormControl>

          {/* Start */}
          <TextField
            label="Start" type="datetime-local" size="small"
            value={startInput}
            onChange={(e) => { setStartInput(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
          />

          {/* End */}
          <TextField
            label="End" type="datetime-local" size="small"
            value={endInput}
            onChange={(e) => { setEndInput(e.target.value); setPage(1); }}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
          />
        </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load: {error}
        </Alert>
      )}

      {/* Table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Status</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Start Time</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Device</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Category</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Duration</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Trigger</TableCell>
              <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>End Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!loading && data.events.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No alarm events
                </TableCell>
              </TableRow>
            )}
            {!loading && data.events.map(ev => {
              const dev = allDevices.find(d => d.devEui === ev.devEui);
              const devName = dev?.name || ev.devEui;
              const isActive = ev.status === 'ACTIVE';
              return (
                <TableRow key={ev.id} hover>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                    <Chip
                      label={ev.status} size="small"
                      sx={{
                        // align with StatusBadge alarm/offline tokens (Phase 5)
                        bgcolor: isActive ? '#FEE2E2' : '#F1F5F9',
                        color:   isActive ? '#B91C1C' : '#475569',
                        fontWeight: 500,
                      }}
                    />
                  </TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatDateTime(ev.startTime)}</TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                    <Box>
                      <Typography variant="body2">{devName}</Typography>
                      <Typography variant="caption" color="text.secondary">{ev.devEui}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatCategory(ev.category)}</TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatDuration(ev.durationSeconds)}</TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatTriggerValue(ev.category, ev.triggerValue)}</TableCell>
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{isActive ? '-' : formatDateTime(ev.endTime)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      {/* Pagination */}
      {data.totalCount > PAGE_SIZE && (
        <Stack alignItems="center" sx={{ mt: 2 }}>
          <Pagination
            count={totalPages} page={page}
            onChange={(_, p) => setPage(p)}
            color="primary"
          />
        </Stack>
      )}
    </Box>
  );
}