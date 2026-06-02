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
  buildStackedBarOption,
  humanizeFreq,
  humanizeDr,
  identityLabel,
} from './chartUtils';
import MetricChartCell from './MetricChartCell';

// Mirrors ChirpStack web UI Gateway Metrics
export default function GatewayMetricsCharts({ gatewayId }) {
  const [rangeKey, setRangeKey] = useState('24h');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const preset = RANGE_PRESETS[rangeKey];

  const fetchMetrics = useCallback(async () => {
    if (!gatewayId) return;
    setLoading(true);
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - preset.hours * 3600 * 1000);
      const res = await DeviceApi.getGatewayMetrics(
        gatewayId, start.toISOString(), end.toISOString(), preset.aggregation,
      );
      setData(res);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e.message || 'Failed to load gateway metrics');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [gatewayId, preset.hours, preset.aggregation, reloadKey]);

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
        <Tooltip title="Reload gateway metrics">
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
            key="tx-packets"
            title="TX packets"
            metric={data.txPackets}
            optionBuilder={(m) => buildSimpleBarOption(m, 'Count', preset.aggregation)}
          />
          <MetricChartCell
            key="rx-packets-freq"
            title="RX packets / frequency"
            metric={data.rxPacketsPerFreq}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeFreq, preset.aggregation)}
          />
          <MetricChartCell
            key="tx-packets-freq"
            title="TX packets / frequency"
            metric={data.txPacketsPerFreq}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeFreq, preset.aggregation)}
          />
          <MetricChartCell
            key="rx-packets-dr"
            title="RX packets / DR"
            metric={data.rxPacketsPerDr}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeDr, preset.aggregation)}
          />
          <MetricChartCell
            key="tx-packets-dr"
            title="TX packets / DR"
            metric={data.txPacketsPerDr}
            optionBuilder={(m) => buildStackedBarOption(m, humanizeDr, preset.aggregation)}
          />
          <MetricChartCell
            key="tx-packets-status"
            title="TX packets / status"
            metric={data.txPacketsPerStatus}
            optionBuilder={(m) => buildStackedBarOption(m, identityLabel, preset.aggregation)}
          />
        </Box>
      )}
    </Box>
  );
}