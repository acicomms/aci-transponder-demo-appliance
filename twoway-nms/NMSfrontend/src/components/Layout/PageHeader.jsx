import { Box, Stack, Typography, IconButton, Tooltip } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

export default function PageHeader({ title, kind, count, badges, actions, onRefresh, thumbnail }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}
    >
      <Stack direction="row" alignItems="center" spacing={2}>
        {thumbnail}
        <Box>
          {kind && (
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                lineHeight: 1.2,
                color: 'text.secondary',
                fontWeight: 500,
                mb: 0.5,
              }}
            >
              {kind}
            </Typography>
          )}
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ wordBreak: 'break-all' }}>{title}</Typography>
            {typeof count === 'number' && (
              <Typography variant="body2" color="text.secondary">
                · {count} total
              </Typography>
            )}
            {badges}
          </Stack>
        </Box>
      </Stack>
      {(actions || onRefresh) && (
        <Stack direction="row" spacing={1} alignItems="center">
          {actions}
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton onClick={onRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      )}
    </Stack>
  );
}