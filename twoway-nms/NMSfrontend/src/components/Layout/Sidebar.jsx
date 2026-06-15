import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Collapse } from '@mui/material';

import HubIcon from '@mui/icons-material/Hub';
import DashboardIcon from '@mui/icons-material/Dashboard';
import NotificationsIcon from '@mui/icons-material/Notifications';
import MapIcon from '@mui/icons-material/Map';
import RouterIcon from '@mui/icons-material/Router';
import AppsIcon from '@mui/icons-material/Apps';
import SettingsIcon from '@mui/icons-material/Settings';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

export default function Sidebar({ onSelect, selectedDevice, view }) {
  const navigate = useNavigate();

  // Resolve which row should be highlighted.
  const selectedId = (() => {
    if (view === 'alarms')            return 'alarms-page';
    if (view === 'gateways-list')     return 'gateways-list';
    if (view === 'applications-list') return 'applications-list';
    if (view === 'users')             return 'admin-users';
    if (view === 'history')           return 'admin-history';
    if (!selectedDevice) return null;
    switch (selectedDevice.itemType) {
      case 'global-dashboard':   return 'global-dashboard';
      case 'global-map':         return 'global-map';
      case 'gateway':            return 'gateways-list';
      case 'application':
      case 'device':             return 'applications-list';
      default:                   return null;
    }
  })();

  // Auto-open Admin section when on /settings/* views.
  const [adminOpen, setAdminOpen] = useState(view === 'users' || view === 'history');
  useEffect(() => {
    if (view === 'users' || view === 'history') setAdminOpen(true);
  }, [view]);

  const TOP_ITEMS = [
    { id: 'global-dashboard',  label: 'Overview',     icon: DashboardIcon,
      onClick: () => onSelect({ itemType: 'global-dashboard' }) },
    { id: 'alarms-page',       label: 'Alarms',       icon: NotificationsIcon,
      onClick: () => navigate('/alarms') },
    { id: 'global-map',        label: 'Global Map',   icon: MapIcon,
      onClick: () => onSelect({ itemType: 'global-map' }) },
    { id: 'gateways-list',     label: 'Gateways',     icon: RouterIcon,
      onClick: () => navigate('/gateways') },
    { id: 'applications-list', label: 'Applications', icon: AppsIcon,
      onClick: () => navigate('/applications') },
  ];

  const ADMIN_ITEMS = [
    { id: 'admin-users',   label: 'User Management', onClick: () => navigate('/settings/users') },
    { id: 'admin-history', label: 'Login History',   onClick: () => navigate('/settings/history') },
  ];

  return (
    <Box
      sx={{
        height: '100%',
        bgcolor: 'sidebar.bg',
        color: 'sidebar.text',
        display: 'flex',
        flexDirection: 'column',
        py: 1,
      }}
    >
      {/* Logo */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.5, py: 2.5 }}>
        <HubIcon sx={{ color: 'primary.main', fontSize: 26 }} />
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#FFFFFF', letterSpacing: 0.5 }}
          >
            NEXUS
          </Typography>
          <Typography
            sx={{ fontWeight: 500, fontSize: '0.7rem', color: 'sidebar.muted', letterSpacing: 0.4 }}
          >
            NMS v0.1
          </Typography>
        </Box>
      </Box>

      {/* Top items */}
      <Box sx={{ mt: 1 }}>
        {TOP_ITEMS.map(item => (
          <SidebarItem
            key={item.id}
            label={item.label}
            Icon={item.icon}
            selected={selectedId === item.id}
            onClick={item.onClick}
          />
        ))}
      </Box>

      {/* Admin (collapsible) */}
      <Box sx={{ mt: 0.5 }}>
        <SidebarItem
          label="Admin"
          Icon={SettingsIcon}
          selected={false}
          onClick={() => setAdminOpen(o => !o)}
          trailing={adminOpen
            ? <ExpandMoreIcon fontSize="small" />
            : <ChevronRightIcon fontSize="small" />}
        />
        <Collapse in={adminOpen} timeout="auto" unmountOnExit>
          <Box sx={{ pl: 3.5 }}>
            {ADMIN_ITEMS.map(item => (
              <SidebarItem
                key={item.id}
                label={item.label}
                selected={selectedId === item.id}
                onClick={item.onClick}
                dense
              />
            ))}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
}

function SidebarItem({ label, Icon, selected, onClick, trailing, dense }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        mx: 1,
        my: 0.5,
        px: 1.5,
        py: dense ? 1 : 1.25,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        cursor: 'pointer',
        color: selected ? 'sidebar.selectedFg' : 'sidebar.text',
        bgcolor: selected ? 'sidebar.selectedBg' : 'transparent',
        transition: 'background-color 0.15s, color 0.15s',
        '&:hover': selected ? {} : { bgcolor: 'sidebar.hoverBg' },
        userSelect: 'none',
      }}
    >
      {Icon && <Icon sx={{ fontSize: 20 }} />}
      <Typography
        variant="body2"
        sx={{ flex: 1, fontWeight: selected ? 600 : 500, fontSize: '0.875rem' }}
      >
        {label}
      </Typography>
      {trailing}
    </Box>
  );
}
