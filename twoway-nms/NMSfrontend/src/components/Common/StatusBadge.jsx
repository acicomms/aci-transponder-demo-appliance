import { Box, Chip, Typography } from '@mui/material';

// Backend produces: online / stale / offline / alarm
const STATUS_CONFIG = {
  online:  { label: 'Online',  bg: '#D1FAE5', fg: '#047857', dot: '#10B981' },
  offline: { label: 'Offline', bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  alarm:   { label: 'Alarm',   bg: '#FEE2E2', fg: '#B91C1C', dot: '#EF4444' },
};

export default function StatusBadge({ status, size = 'small', variant = 'chip' }) {
  const effective = (status === 'stale') ? 'online' : status;
  const cfg = STATUS_CONFIG[effective] || STATUS_CONFIG.offline;

  if (variant === 'dot') {
    return (
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
        <Box sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: cfg.dot,
          flexShrink: 0,
        }} />
        <Typography variant="body2" sx={{ color: 'text.primary' }}>
          {cfg.label}
        </Typography>
      </Box>
    );
  }

  return (
    <Chip
      label={cfg.label}
      size={size}
      sx={{
        bgcolor: cfg.bg,
        color: cfg.fg,
        fontWeight: 'bold',
        borderRadius: 1,
      }}
    />
  );
}