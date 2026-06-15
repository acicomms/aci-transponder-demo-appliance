import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Badge, Menu, MenuItem, IconButton, Typography, Button, Tooltip, Avatar,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import MenuIcon from '@mui/icons-material/Menu';

import { useDevice } from '../../contexts/DeviceContext';
import AppBreadcrumb from './AppBreadcrumb';

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function TopNav({ toggleDrawer, view }) {
  const navigate = useNavigate();
  const { unreadAlarmCount } = useDevice();

  // Real-time clock
  const [clockNow, setClockNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setClockNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // User dropdown
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState(null);
  const userMenuOpen = Boolean(userMenuAnchorEl);
  const handleUserMenuClick = (e) => setUserMenuAnchorEl(e.currentTarget);
  const handleUserMenuClose = () => setUserMenuAnchorEl(null);

  const storedUser = localStorage.getItem('user');
  const currentUser = storedUser ? JSON.parse(storedUser) : { name: 'User Name' };
  const initials = getInitials(currentUser.name);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleBellClick = () => navigate('/alarms');

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 2,
        height: 64,
        bgcolor: '#FFFFFF',
        color: 'text.primary',
        borderBottom: '1px solid',
        borderColor: 'divider',
        flexShrink: 0,
      }}
    >
      {/* Mobile hamburger — opens sidebar drawer */}
      <IconButton
        onClick={toggleDrawer}
        sx={{ display: { xs: 'flex', md: 'none' }, mr: 0.5, color: 'text.secondary' }}
      >
        <MenuIcon />
      </IconButton>

      {/* Breadcrumb (left-aligned, takes available space) */}
      <Box sx={{ flex: 1, minWidth: 0, ml: 0.5 }}>
        <AppBreadcrumb view={view} />
      </Box>

      {/* Real-time clock (hidden on xs) */}
      <Typography
        variant="body2"
        sx={{
          color: 'text.secondary',
          fontFamily: 'monospace',
          mr: 1.5,
          display: { xs: 'none', sm: 'block' },
          whiteSpace: 'nowrap',
        }}
      >
        {clockNow.toLocaleString('zh-TW', { hour12: false })}
      </Typography>

      {/* Bell — navigate to /alarms */}
      <Tooltip title="Open Alarms">
        <IconButton onClick={handleBellClick} sx={{ color: 'text.secondary' }}>
          <Badge badgeContent={unreadAlarmCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* User menu */}
      <Button
        sx={{
          color: 'text.primary',
          textTransform: 'none',
          minWidth: 'auto',
          gap: 1,
          px: 1,
          ml: 0.5,
          fontWeight: 500,
          whiteSpace: 'nowrap',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={handleUserMenuClick}
        endIcon={<ArrowDropDownIcon />}
      >
        <Avatar
          sx={{
            width: 32, height: 32,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: '0.8125rem',
            fontWeight: 600,
          }}
        >
          {initials}
        </Avatar>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, display: { xs: 'none', sm: 'block' } }}
        >
          {currentUser.name}
        </Typography>
      </Button>

      <Menu
        anchorEl={userMenuAnchorEl}
        open={userMenuOpen}
        onClose={handleUserMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ elevation: 3, sx: { mt: 1, minWidth: 150 } }}
      >
        <MenuItem
          onClick={() => { handleLogout(); handleUserMenuClose(); }}
          sx={{ color: 'error.main' }}
        >
          Log out
        </MenuItem>
      </Menu>
    </Box>
  );
}