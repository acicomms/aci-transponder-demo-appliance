import React, { useState, useEffect } from 'react';
import {
  Box, Typography, CircularProgress, List, ListItem,
  ListItemText, ListItemIcon, Divider, Badge, Chip, Button, Drawer
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import LocationOffIcon from '@mui/icons-material/LocationOff';
import RouterIcon from '@mui/icons-material/Router';
import MemoryIcon from '@mui/icons-material/Memory';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { DeviceApi } from '../../api/deviceApi';
import { useDevice } from '../../contexts/DeviceContext';
import StatusBadge from '../Common/StatusBadge';
import { SECTION_CARD_TITLE_SX } from '../../constants/cardStyles';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color, size) => L.divIcon({
  className: 'custom-div-icon',
  html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>`,
  iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

const gatewayOnlineIcon = createCustomIcon('#1976d2', 24);
const gatewayOfflineIcon = createCustomIcon('#9e9e9e', 24);
const deviceNormalIcon = createCustomIcon('#4caf50', 16);
const deviceAlarmIcon = createCustomIcon('#f44336', 16);
const deviceOfflineIcon = createCustomIcon('#9e9e9e', 16);

// ---  自動縮放元件 (只計算有座標的點) ---
function MapAutoFit({ placedGateways, placedDevices }) {
  const map = useMap();
  useEffect(() => {
    const allPoints = [];
    placedGateways.forEach(g => allPoints.push([g.lat, g.lng]));
    placedDevices.forEach(d => allPoints.push([d.lat, d.lng]));

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [placedGateways, placedDevices, map]);
  return null;
}

export default function GlobalMapTopology() {
  const [mapData, setMapData] = useState({ gateways: [], devices: [] });
  const [loading, setLoading] = useState(true);

  // 控制手機版底部抽屜的開關狀態
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const { setSelectedDevice, appsData, gatewaysData } = useDevice();

  useEffect(() => { fetchMapData(); }, []);

  const fetchMapData = async () => {
    try {
      const data = await DeviceApi.getGlobalMapData();
      setMapData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  //  跳轉邏輯 (支援 Device 與 Gateway)
  const handleItemClick = (id, type) => {

    // 跳轉前自動關閉手機版抽屜
    setMobileDrawerOpen(false);


    if (type === 'device') {
      let foundDevice = null;
      appsData.forEach(app => {
        const dev = app.devices?.find(d => String(d.devEui).toLowerCase() === String(id).toLowerCase());
        if (dev) foundDevice = { ...dev, itemType: 'device' };
      });
      if (foundDevice) setSelectedDevice(foundDevice);
    } else if (type === 'gateway') {
      const foundGw = gatewaysData.find(g => g.gatewayId === id);
      if (foundGw) setSelectedDevice({ ...foundGw, itemType: 'gateway' });
    }
  };

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

  //  資料分流：有座標 || 無座標
  const placedGateways = mapData.gateways.filter(g => g.lat != null && g.lng != null);
  const unplacedGateways = mapData.gateways.filter(g => g.lat == null || g.lng == null);

  const placedDevices = mapData.devices.filter(d => d.lat != null && d.lng != null);
  const unplacedDevices = mapData.devices.filter(d => d.lat == null || d.lng == null);

  const totalUnplaced = unplacedGateways.length + unplacedDevices.length;


  // 將清單內容獨立抽成一個變數  讓電腦版Sidebar和手機版Drawer共用
  const unplacedListContent = (
    <>
      <Box sx={{ p: 2, bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocationOffIcon color="action" />
        <Typography sx={SECTION_CARD_TITLE_SX}>Unlocated List</Typography>
        {totalUnplaced > 0 && <Chip label={totalUnplaced} size="small" color="error" />}
      </Box>

      <List sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
        {totalUnplaced === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">All equipment has completed coordinate positioning </Typography>
          </Box>
        ) : (
          <>
            {unplacedGateways.map(gw => (
              <ListItem button key={gw.id} onClick={() => handleItemClick(gw.id, 'gateway')} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <ListItemIcon sx={{ minWidth: 36 }}><RouterIcon color="primary" fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={gw.name}
                  secondary="Gateway • click to set location"
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                  secondaryTypographyProps={{ variant: 'caption', color: 'error' }}
                />
              </ListItem>
            ))}
            {unplacedDevices.map(dev => (
              <ListItem button key={dev.devEui} onClick={() => handleItemClick(dev.devEui, 'device')} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <ListItemIcon sx={{ minWidth: 36 }}><MemoryIcon color="action" fontSize="small" /></ListItemIcon>
                <ListItemText
                  primary={dev.name}
                  secondary={`${dev.devEui.slice(-6)} • Click to set location`}
                  primaryTypographyProps={{ variant: 'body2', fontWeight: 'bold' }}
                  secondaryTypographyProps={{ variant: 'caption', color: 'error' }}
                />
              </ListItem>
            ))}
          </>
        )}
      </List>
    </>
  );



  return (
    <Box sx={{
      display: 'flex',
      height: 'calc(100vh - 120px)',
      width: '100%',
      overflow: 'hidden',
      borderRadius: '12px',
      border: '1px solid',
      borderColor: 'divider',
      bgcolor: 'background.paper',
    }}>

      {/* 左側：地圖區塊 */}
      <Box sx={{ flex: 1, position: 'relative' }}>

        {/*  手機版專屬：地圖上的浮動按鈕 */}
        <Box sx={{
          display: { xs: 'block', md: 'none' },
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000
        }}>
          <Badge badgeContent={totalUnplaced} color="error" invisible={totalUnplaced === 0}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<LocationOffIcon />}
              onClick={() => setMobileDrawerOpen(true)}
              sx={{ borderRadius: 8, px: 3, boxShadow: 3, fontWeight: 'bold' }}
            >
              Unplaced devices
            </Button>
          </Badge>
        </Box>

        <MapContainer center={[23.6978, 120.9605]} zoom={8} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapAutoFit placedGateways={placedGateways} placedDevices={placedDevices} />

          {placedGateways.map(gw => (
            <Marker key={`gw-${gw.id}`} position={[gw.lat, gw.lng]} icon={gw.healthStatus === 'online' ?
              gatewayOnlineIcon : gatewayOfflineIcon}>
              <Popup>
                <Typography variant="subtitle2" color="primary">Gateway</Typography>
                <Typography variant="body2">{gw.name}</Typography>
                <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => handleItemClick(gw.id, 'gateway')}>
                  View settings
                </Typography>
              </Popup>
            </Marker>
          ))}

          {placedDevices.map(dev => {
            const targetGw = placedGateways.find(g => g.id === dev.gatewayId);
            let dIcon = deviceOfflineIcon;
            if (dev.healthStatus === 'online') dIcon = deviceNormalIcon;
            if (dev.healthStatus === 'stale')  dIcon = deviceNormalIcon; // TODO Phase 4: dedicated stale icon
            if (dev.healthStatus === 'alarm')  dIcon = deviceAlarmIcon;

            return (
              <React.Fragment key={`dev-${dev.devEui}`}>
                <Marker position={[dev.lat, dev.lng]} icon={dIcon} eventHandlers={{ click: () => handleItemClick(dev.devEui, 'device') }}>
                  <Popup>
                    <Typography variant="subtitle2">Device: {dev.name}</Typography>
                    <div style={{ margin: '4px 0' }}>
                      <StatusBadge status={dev.healthStatus} />
                    </div>
                    <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }}>
                      View details
                    </Typography>
                  </Popup>
                </Marker>
                {targetGw && (
                  <Polyline positions={[[dev.lat, dev.lng], [targetGw.lat, targetGw.lng]]} pathOptions={{ color: '#9fa8da', weight: 2, dashArray: '5, 5' }} />
                )}
              </React.Fragment>
            );
          })}
        </MapContainer>
      </Box>

      {/*  電腦版：右側固定的未定位設備清單 */}
      <Box sx={{
        width: { xs: 0, md: 320 },
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        borderLeft: 1, borderColor: 'divider',
        bgcolor: 'background.paper'
      }}>
        {unplacedListContent}
      </Box>

      {/*  手機版：底部滑出的未定位設備drawer*/}
      <Drawer
        anchor="bottom"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        sx={{ display: { xs: 'block', md: 'none' }, zIndex: 1200 }}
        PaperProps={{
          sx: {
            height: '60vh',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >

        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 4, bgcolor: 'grey.400', borderRadius: 2 }} />
        </Box>
        {unplacedListContent}
      </Drawer>

    </Box>
  );
}
