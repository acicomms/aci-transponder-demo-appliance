import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, TextField, Button, Chip, CircularProgress,
} from '@mui/material';
import { DeviceApi } from '../../api/deviceApi';
import { useDevice } from '../../contexts/DeviceContext';
import { PAGE_SECTION_HEADING_SX } from '../../constants/cardStyles';

// Read-only chip for the secondary (transponder) reachability indicator.
function StatusChip({ status }) {
  const online = status === 'online';
  return (
    <Chip
      label={online ? 'Online' : 'Offline'}
      size="small"
      sx={{
        bgcolor: online ? '#D1FAE5' : '#F1F5F9',
        color: online ? '#047857' : '#475569',
        fontWeight: 'bold',
        borderRadius: 1,
      }}
    />
  );
}

export default function ConfigTab({ devEui, deviceDetail }) {
  const { showToast } = useDevice();

  const [ampMin, setAmpMin] = useState('');
  const [transMin, setTransMin] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed inputs from the aggregated detail (folded GET; no separate fetch).
  useEffect(() => {
    if (deviceDetail) {
      setAmpMin(deviceDetail.ampOfflineMin != null ? String(deviceDetail.ampOfflineMin) : '');
      setTransMin(deviceDetail.transponderOfflineMin != null ? String(deviceDetail.transponderOfflineMin) : '');
    }
  }, [deviceDetail]);

  const inRange = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 1 && n <= 1440;
  };

  const handleSave = async () => {
    if (!inRange(ampMin) || !inRange(transMin)) {
      showToast('Thresholds must be integers between 1 and 1440 minutes.', 'error');
      return;
    }
    setSaving(true);
    try {
      await DeviceApi.updateHealthThresholds(devEui, {
        ampOfflineMin: Number(ampMin),
        transponderOfflineMin: Number(transMin),
      });
      showToast('Health-status thresholds saved.', 'success');
    } catch (e) {
      showToast('Failed to save thresholds: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 1 }}>Health Status</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 3 }}>
        Online/offline is driven by amplifier data freshness. The transponder indicator below is a
        secondary signal for LoRaWAN reachability and does not change the main device status.
      </Typography>

      {/* Secondary indicator (read-only) */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
        <Typography variant="body2" sx={{ minWidth: 180 }}>Transponder reachability</Typography>
        <StatusChip status={deviceDetail?.transponderStatus} />
      </Stack>

      {/* Editable thresholds */}
      <Typography sx={{ ...PAGE_SECTION_HEADING_SX, mb: 2 }}>Offline Thresholds (minutes)</Typography>
      <Stack spacing={2} sx={{ maxWidth: 380 }}>
        <TextField
          label="Amplifier offline threshold"
          type="number"
          size="small"
          value={ampMin}
          onChange={(e) => setAmpMin(e.target.value)}
          helperText="Marks device offline when no amp status frame within this time."
          inputProps={{ min: 1, max: 1440 }}
        />
        <TextField
          label="Transponder offline threshold"
          type="number"
          size="small"
          value={transMin}
          onChange={(e) => setTransMin(e.target.value)}
          helperText="Marks transponder reachability offline after this time."
          inputProps={{ min: 1, max: 1440 }}
        />
        <Box>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}