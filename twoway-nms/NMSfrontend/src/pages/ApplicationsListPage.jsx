import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Stack, Typography, TextField, InputAdornment, Button, IconButton,
  Table, TableHead, TableBody, TableRow, TableCell,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Menu, MenuItem,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useDevice } from '../contexts/DeviceContext';
import { DeviceApi } from '../api/deviceApi';
import PageHeader from '../components/Layout/PageHeader';
import {
  PAGE_BG_SX,
  BORDERLESS_TABLE_HEAD_SX,
  BORDERLESS_TABLE_BODY_SX,
} from '../constants/cardStyles';

// ISO8601 => YYYY-MM-DD HH:mm:ss; null/parse-fail => '-'.
const formatLastSeen = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// Aggregate device list -> { total, online, alarm, offline, latestSeen }.
// Folds 'stale' into online (StatusBadge convention).
const computeAppDeviceStats = (devices = []) => {
  let online = 0, alarm = 0, offline = 0;
  let latestMs = 0;
  for (const d of devices) {
    if (d.healthStatus === 'alarm')        alarm++;
    else if (d.healthStatus === 'offline') offline++;
    else                                   online++;     // online + stale
    if (d.lastSeen) {
      const ms = new Date(d.lastSeen).getTime();
      if (!isNaN(ms) && ms > latestMs) latestMs = ms;
    }
  }
  return {
    total: devices.length,
    online, alarm, offline,
    latestSeen: latestMs > 0 ? new Date(latestMs).toISOString() : null,
  };
};

// Tailwind-aligned dot colors (matches StatusBadge / Overview KPI).
const DOT_ONLINE  = '#10B981';
const DOT_ALARM   = '#EF4444';
const DOT_OFFLINE = '#94A3B8';

export default function ApplicationsListPage() {
  const { appsData, setSelectedDevice, refreshSidebarData, showToast } = useDevice();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editApp, setEditApp] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editing, setEditing] = useState(false);

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteApp, setDeleteApp] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Row menu
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuApp, setMenuApp] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return appsData;
    return appsData.filter(app => {
      const name = (app.name || '').toLowerCase();
      const id = String(app.id || '').toLowerCase();
      return name.includes(q) || id.includes(q);
    });
  }, [appsData, search]);

  const handleRowClick = (app) => {
    setSelectedDevice({ ...app, itemType: 'application' });
    navigate('/');
  };

  // --- Add ---
  const handleAddOpen = () => {
    setAddName('');
    setAddDescription('');
    setAddOpen(true);
  };

  const handleAddClose = () => {
    if (adding) return;
    setAddOpen(false);
  };

  const handleAddSubmit = async () => {
    if (!addName.trim()) {
      showToast('Name is required', 'warning');
      return;
    }
    setAdding(true);
    try {
      await DeviceApi.createApplication(addName.trim(), addDescription);
      showToast(`Application "${addName.trim()}" created`, 'success');
      setAddOpen(false);
      await refreshSidebarData();
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Create failed';
      showToast(msg, 'error');
    } finally {
      setAdding(false);
    }
  };

  // --- Row menu ---
  const handleMenuOpen = (e, app) => {
    e.stopPropagation();
    setMenuAnchor(e.currentTarget);
    setMenuApp(app);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuApp(null);
  };

  const handleMenuRename = () => {
    if (!menuApp) return;
    setEditApp(menuApp);
    setEditName(menuApp.name || '');
    setEditDescription(menuApp.description || '');
    setEditOpen(true);
    handleMenuClose();
  };

  const handleMenuDelete = () => {
    if (!menuApp) return;
    setDeleteApp(menuApp);
    setDeleteOpen(true);
    handleMenuClose();
  };

  // --- Edit ---
  const handleEditClose = () => {
    if (editing) return;
    setEditOpen(false);
    setEditApp(null);
  };

  const handleEditSubmit = async () => {
    if (!editApp) return;
    if (!editName.trim()) {
      showToast('Name is required', 'warning');
      return;
    }
    setEditing(true);
    try {
      await DeviceApi.updateApplication(editApp.id, editName.trim(), editDescription);
      showToast('Application updated', 'success');
      setEditOpen(false);
      setEditApp(null);
      await refreshSidebarData();
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Update failed';
      showToast(msg, 'error');
    } finally {
      setEditing(false);
    }
  };

  // --- Delete ---
  const handleDeleteClose = () => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteApp(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteApp) return;
    setDeleting(true);
    try {
      await DeviceApi.deleteApplication(deleteApp.id);
      showToast(`Application "${deleteApp.name}" deleted`, 'success');
      setDeleteOpen(false);
      setDeleteApp(null);
      await refreshSidebarData();
    } catch (error) {
      const msg = error?.response?.data?.message || error.message || 'Delete failed';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={PAGE_BG_SX}>
      <PageHeader
        title="Applications"
        count={filtered.length}
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddOpen}
          >
            Add Application
          </Button>
        }
        onRefresh={refreshSidebarData}
      />

      <TextField
        size="small"
        fullWidth
        placeholder="Search by name or application ID"
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

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={BORDERLESS_TABLE_HEAD_SX}>Name</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 200 }}>Application ID</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 240 }}>Devices</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 170 }}>Last Activity</TableCell>
            <TableCell sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 220 }}>Description</TableCell>
            <TableCell align="center" sx={{ ...BORDERLESS_TABLE_HEAD_SX, width: 80 }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                No applications
              </TableCell>
            </TableRow>
          ) : (
            filtered.map(app => {
              const stats = computeAppDeviceStats(app.devices);
              const idShort = app.id && app.id.length > 12
                ? `${app.id.slice(0, 8)}…${app.id.slice(-4)}`
                : app.id;
              return (
                <TableRow
                  key={app.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => handleRowClick(app)}
                >
                  {/* Name (single line) */}
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {app.name}
                    </Typography>
                  </TableCell>

                  {/* Application ID (mono, truncated) */}
                  <TableCell
                    sx={{ ...BORDERLESS_TABLE_BODY_SX, fontFamily: 'monospace', color: 'text.secondary' }}
                    title={app.id || ''}
                  >
                    {idShort || '-'}
                  </TableCell>

                  {/* Devices: total + colored breakdown dots */}
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>
                    <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.3 }}>
                      {stats.total} {stats.total === 1 ? 'device' : 'devices'}
                    </Typography>
                    {stats.total > 0 && (
                      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mt: 0.25 }}>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DOT_ONLINE }} />
                          <Typography variant="caption" color="text.secondary">{stats.online}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DOT_ALARM }} />
                          <Typography variant="caption" color="text.secondary">{stats.alarm}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: DOT_OFFLINE }} />
                          <Typography variant="caption" color="text.secondary">{stats.offline}</Typography>
                        </Stack>
                      </Stack>
                    )}
                  </TableCell>

                  {/* Last activity = max(devices.lastSeen) */}
                  <TableCell sx={BORDERLESS_TABLE_BODY_SX}>{formatLastSeen(stats.latestSeen)}</TableCell>

                  {/* Description (truncated with ellipsis; native tooltip on hover) */}
                  <TableCell
                    sx={{
                      ...BORDERLESS_TABLE_BODY_SX,
                      maxWidth: 220,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={app.description || ''}
                  >
                    {app.description || '-'}
                  </TableCell>

                  {/* Actions kebab */}
                  <TableCell align="center" sx={BORDERLESS_TABLE_BODY_SX}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, app)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {/* Row menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuRename}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} /> Rename
        </MenuItem>
        <MenuItem onClick={handleMenuDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>

      {/* Add modal */}
      <Dialog open={addOpen} onClose={handleAddClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Application</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              autoFocus
              disabled={adding}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={addDescription}
              onChange={(e) => setAddDescription(e.target.value)}
              disabled={adding}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAddClose} disabled={adding}>Cancel</Button>
          <Button onClick={handleAddSubmit} variant="contained" disabled={adding}>
            {adding ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editOpen} onClose={handleEditClose} maxWidth="sm" fullWidth>
        <DialogTitle>Rename Application</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              autoFocus
              disabled={editing}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              minRows={2}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              disabled={editing}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditClose} disabled={editing}>Cancel</Button>
          <Button onClick={handleEditSubmit} variant="contained" disabled={editing}>
            {editing ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onClose={handleDeleteClose} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Application?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteApp?.name}</strong>?
          </DialogContentText>
          {(deleteApp?.devices?.length ?? 0) > 0 && (
            <DialogContentText sx={{ mt: 2, color: 'error.main' }}>
              ⚠ This application contains <strong>{deleteApp.devices.length}</strong> device(s).
              Deleting will also delete all devices under it.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteClose} disabled={deleting}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}