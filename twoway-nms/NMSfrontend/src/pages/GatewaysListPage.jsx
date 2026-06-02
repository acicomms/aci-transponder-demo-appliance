import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, InputAdornment, Chip,
  Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useDevice } from '../contexts/DeviceContext';
import StatusBadge from '../components/Common/StatusBadge';
import PageHeader from '../components/Layout/PageHeader';
import {
  PAGE_BG_SX,
  BORDERLESS_TABLE_HEAD_SX,
  BORDERLESS_TABLE_BODY_SX,
} from '../constants/cardStyles';


const formatLastSeen = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const BODY_CELL_MONO_SX = {
  ...BORDERLESS_TABLE_BODY_SX,
  fontFamily: 'monospace',
};

export default function GatewaysListPage() {
  const { gatewaysData, setSelectedDevice, refreshSidebarData } = useDevice();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return gatewaysData;
    return gatewaysData.filter(gw => {
      const name = (gw.name || '').toLowerCase();
      const id = (gw.gatewayId || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [gatewaysData, search]);

  const handleRowClick = (gw) => {
    setSelectedDevice({ ...gw, itemType: 'gateway' });
    navigate('/');
  };

  return (
    <Box sx={PAGE_BG_SX}>
      <PageHeader
        title="Gateways"
        count={filtered.length}
        onRefresh={refreshSidebarData}
      />

      <TextField
        size="small"
        fullWidth
        placeholder="Search by name or gateway ID"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
      />

      <Table size="small" sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 200 }}>Name</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 200 }}>Application ID</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 240 }}>Devices</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 170 }}>Last Activity</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 200 }}>Description</TableCell>
            <TableCell align="center" sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 80 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                No gateways
              </TableCell>
            </TableRow>
          ) : (
            filtered.map(gw => (
              <TableRow
                key={gw.gatewayId}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => handleRowClick(gw)}
              >
                <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                  <StatusBadge variant="dot" status={gw.onlineStatus ? 'online' : 'offline'} />
                </TableCell>
                <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{gw.name || gw.gatewayId}</TableCell>
                <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatLastSeen(gw.lastSeenAt)}</TableCell>
                <TableCell sx={BODY_CELL_MONO_SX}>{gw.gatewayId}</TableCell>
                <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                  {gw.regionId
                    ? <Chip
                        size="small"
                        label={gw.regionId}
                        sx={{ bgcolor: 'primary.light', color: 'primary.main', fontWeight: 500 }}
                      />
                    : '-'}
                </TableCell>
                <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{gw.description || '-'}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Box>
  );
}