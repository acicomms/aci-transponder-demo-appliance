import { Breadcrumbs, Link, Typography, Box } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate } from 'react-router-dom';
import { useDevice } from '../../contexts/DeviceContext';

// view: 'device' | 'users' | 'history' (from MainDashboard prop)
export default function AppBreadcrumb({ view }) {
  const { selectedDevice, setSelectedDevice, appsData } = useDevice();
  const navigate = useNavigate();

  // Build crumb segments based on context
  const segments = buildSegments(view, selectedDevice, appsData);

  // Don't render when there's nothing to show
  if (segments.length === 0) return null;

  return (
    <Box>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
        {segments.map((seg, i) => {
          const isLast = i === segments.length - 1;
          if (isLast || !seg.onClick) {
            return (
              <Typography key={i} color={isLast ? 'text.primary' : 'text.secondary'} sx={{ fontSize: '0.875rem' }}>
                {seg.label}
              </Typography>
            );
          }
          return (
            <Link
              key={i}
              component="button"
              underline="hover"
              color="inherit"
              onClick={seg.onClick}
              sx={{ fontSize: '0.875rem', cursor: 'pointer' }}
            >
              {seg.label}
            </Link>
          );
        })}
      </Breadcrumbs>
    </Box>
  );

  // ----- helpers -----
  function buildSegments(view, device, apps) {
    if (view === 'users') {
      return [{ label: 'Admin' }, { label: 'User Management' }];
    }
    if (view === 'history') {
      return [{ label: 'Admin' }, { label: 'Login History' }];
    }
    if (view === 'alarms') {
      return [{ label: 'Alarms' }];
    }
    if (view === 'gateways-list') {
      return [{ label: 'Gateways' }];
    }
    if (view === 'applications-list') {
      return [{ label: 'Applications' }];
    }
    if (!device) return [];

    switch (device.itemType) {
      case 'global-dashboard':
        return [{ label: 'Overview' }];

      case 'global-map':
        return [{ label: 'Global Map' }];

      case 'gateway':
        return [
          { label: 'Gateways', onClick: () => navigate('/gateways') },
          { label: device.name || device.gatewayId },
        ];

      case 'application':
        return [
          { label: 'Applications', onClick: () => navigate('/applications') },
          { label: device.name },
        ];

      case 'device': {
        // Find parent application
        const parentApp = apps.find(app =>
          app.devices?.some(d => d.devEui === device.devEui)
        );
        return [
          { label: 'Applications', onClick: () => navigate('/applications') },
          parentApp
            ? { label: parentApp.name, onClick: () => setSelectedDevice({ ...parentApp, itemType: 'application' }) }
            : { label: '-' },
          { label: device.name || device.devEui },
        ];
      }

      default:
        return [];
    }
  }
}