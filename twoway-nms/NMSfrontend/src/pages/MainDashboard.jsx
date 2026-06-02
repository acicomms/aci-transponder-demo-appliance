import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../contexts/DeviceContext';
import Sidebar from '../components/Layout/Sidebar';
import MainContent from '../components/Layout/MainContent';
import { Typography, Drawer, useTheme, useMediaQuery } from '@mui/material';
import UserManagement from './User/UserManagement';
import LoginHistory from './User/LoginHistory';
import GlobalMapTopology from '../components/Topology/GlobalMapTopology';

import GlobalDashboard from '../components/Dashboard/GlobalDashboard';
import TopNav from '../components/Layout/TopNav';
import AlarmsPage from './AlarmsPage';
import GatewaysListPage from './GatewaysListPage';
import ApplicationsListPage from './ApplicationsListPage';

export default function MainDashboard({ view }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    selectedDevice,
    setSelectedDevice,
  } = useDevice();

  const navigate = useNavigate();

  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    if (view !== 'device') {
      navigate('/');
    }
    if (isMobile && (device.itemType === 'device' || device.itemType === 'gateway' || device.itemType === 'global-map')) {
      setMobileOpen(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>

      {/* 桌機版：Sidebar 全高靠左 */}
      {!isMobile && (
        <div className="sidebar-container" style={{ width: '250px', overflowY: 'auto', flexShrink: 0 }}>
          <Sidebar
            onSelect={handleDeviceSelect}
            selectedDevice={selectedDevice}
            view={view}
          />
        </div>
      )}

      {/* 手機/平板版：用隱藏式 Drawer 包同一個 Sidebar (paper 染深色) */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: 250,
              bgcolor: 'sidebar.bg',
              borderRight: 'none',
            },
          }}
        >
          <Sidebar
            onSelect={handleDeviceSelect}
            selectedDevice={selectedDevice}
            view={view}
          />
        </Drawer>
      )}

      {/* 右側容器：上方 TopNav (含 Breadcrumb)，下方主內容 */}
      <div className="main-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopNav toggleDrawer={() => setMobileOpen(true)} view={view} />
        <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '10px' : '20px' }}>
          {view === 'users' && <UserManagement />}
          {view === 'history' && <LoginHistory />}
          {view === 'alarms' && <AlarmsPage />}
          {view === 'gateways-list' && <GatewaysListPage />}
          {view === 'applications-list' && <ApplicationsListPage />}
          {view === 'device' && (
            selectedDevice?.itemType === 'global-dashboard' ? (
              <GlobalDashboard />
            ) : selectedDevice?.itemType === 'global-map' ? (
              <GlobalMapTopology />
            ) : selectedDevice ? (
              <MainContent selectedDevice={selectedDevice} />
            ) : null
          )}
        </div>
      </div>
    </div>
  );
}