import { useState, useEffect, useCallback } from 'react';
import {
  Box, Alert,
  ToggleButtonGroup, ToggleButton, CircularProgress, Button, Tooltip, IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DeviceApi } from '../../api/deviceApi';
import {
  RANGE_PRESETS,
  buildSimpleBarOption,
  buildSimpleLineOption,
  buildStackedBarOption,
  humanizeFreq,
  humanizeDr,
} from './chartUtils';
import MetricChartCell from './MetricChartCell';

// Mirrors ChirpStack web UI Device Link Metrics (6 charts):
// rxPackets / errors / rxPacketsPerFreq / rxPacketsPerDr / gwRssi / gwSnr.
export default function DeviceLinkMetricsCharts({ devEui }) {
  const [rangeKey, setRangeKey] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const preset = RANGE_PRESETS[rangeKey];

  const fetchMetrics = useCallback(async () => {
    if (!devEui) return;
    setLoading(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - preset.hours * 3600 * 1000);
      const res = await DeviceApi.getDeviceLinkMetrics(
        devEui, start.toISOString(), end.toISOString(), preset.aggregation,
      );
      setData(res);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e.message || 'Failed to load link metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [devEui, preset.hours, preset.aggregation, reloadKey]);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={() => setReloadKey(k => k + 1)}>
            Retry
          </Button>
        }
      >
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Range toggle + Refresh */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={rangeKey}
          onChange={(_e, v) => { if (v) setRangeKey(v); }}
        >
          {Object.entries(RANGE_PRESETS).map(([k, v]) => (
            <ToggleButton key={k} value={k}>{v.label}</ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Tooltip title="Reload link metrics">
          <IconButton size="small" color="primary" onClick={() => setReloadKey(k => k + 1)}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {data && (
        <Box sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
        }}>
          <MetricChartCell
            key="rx-packets"
            title="RX packets"
            metric={data.rxPackets}
            optionBuilder={(m) => buildSimpleBarOption(m, 'Count', preset.aggregation)}
          />
          <MetricChartCell
            key="errors"
            title="Errors"
            metric={data.errors}
            optionBuilder={(m) => buildSimpleBarOption(m, 'Count', preset.aggregation)}
          />
          <MetricChartCell
            key="rx-packets-freq"
            title="RX packets / frequency"
            metric={data.rxPacketsPerFreq}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeFreq, preset.aggregation)}
          />
          <MetricChartCell
            key="rx-packets-dr"
            title="RX packets / DR"
            metric={data.rxPacketsPerDr}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeDr, preset.aggregation)}
          />
          <MetricChartCell
            key="gw-rssi"
            title="Gateway RSSI (dBm)"
            metric={data.gwRssi}
            optionBuilder={(m) => buildSimpleLineOption(m, 'dBm', '#e65100', preset.aggregation)}
          />
          <MetricChartCell
            key="gw-snr"
            title="Gateway SNR (dB)"
            metric={data.gwSnr}
            optionBuilder={(m) => buildSimpleLineOption(m, 'dB', '#388e3c', preset.aggregation)}
          />
        </Box>
      )}
    </Box>
  );
}