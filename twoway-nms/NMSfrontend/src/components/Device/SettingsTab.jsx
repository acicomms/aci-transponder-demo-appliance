import { useState, useEffect } from 'react';
import {
  Box, Stack, Typography, Grid, TextField,
  Button, IconButton, Tooltip, Chip,
  MenuItem, Switch, FormControlLabel, InputAdornment,
  Collapse, CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { DeviceApi } from '../../api/deviceApi';
import { useDevice } from '../../contexts/DeviceContext';
import {
  ALARM_SETTINGS, ALARM_MASK_SETTINGS, ALARM_MASK_OTHER_SETTINGS,
  RF_MODE_SETTINGS, RF_LOADING_SETTINGS,
  BENCH_FWD_SETTINGS, BENCH_REV_SETTINGS, SYSTEM_LOG_SETTINGS,
} from '../../constants/settingDefinitions';
import { PAGE_SECTION_HEADING_SX } from '../../constants/cardStyles';

// ---------- Group display names for alarm card titles ----------
const ALARM_GROUP_DISPLAY = {
  'temperature': 'Temperature',
  'voltage':     '24V',
  'ripple':      '24V Ripple',
  'rf-out':      'RF Output Total Power',
};

// ---------- Collapsible section wrapper ----------
function CollapsibleSection({ title, helperText, defaultExpanded, children }) {
  const [open, setOpen] = useState(defaultExpanded);
  return (
    <Box>
      <Box
        component="button"
        onClick={() => setOpen(prev => !prev)}
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          p: 0,
          color: 'text.primary',
          textAlign: 'left',
        }}
      >
        <Box>
          <Typography sx={PAGE_SECTION_HEADING_SX}>{title}</Typography>
          {helperText && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.5 }}
            >
              {helperText}
            </Typography>
          )}
        </Box>
        <ExpandMoreIcon
          sx={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            color: 'text.secondary',
          }}
        />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ mt: 2 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

export default function SettingsTab({
  devEui,
  deviceDetail,
  syncCooldown,
  syncPending,
  handleManualSync,
}) {
  const {
    requestCommandLock,
    releaseCommandLock,
    pendingCommand,
    showToast,
  } = useDevice();

  // ---------- value states, all keyed by settingKey ----------
  const [numericValues, setNumericValues] = useState({});
  const [enumValues, setEnumValues] = useState({});
  const [maskValues, setMaskValues] = useState({});
  const [locationForm, setLocationForm] = useState({
    latitude: 0, longitude: 0, address: '',
  });

  // ---------- partType filter state ----------
  // null = loading / fetch failed → fall through to show all (fail-open).
  // Set<settingKey> = filter active.
  const [allowedKeysSet, setAllowedKeysSet] = useState(null);

  // ---------- Sent feedback (5s 'Sent' on buttons / toggle dims) ----------
  const [sentKeys, setSentKeys] = useState({});
  const markSent = (key) => {
    setSentKeys(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setSentKeys(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 5000);
  };

  // ---------- Initial-fill from deviceDetail ----------
  useEffect(() => {
    if (!deviceDetail) return;
    const alarms       = deviceDetail.settings?.alarms;
    const system       = deviceDetail.settings?.system;
    const loadingPilot = deviceDetail.settings?.loadingPilot;
    const masks        = deviceDetail.settings?.alarmMasks; // arrives in Commit 2b

    const numericInit = {};
    ALARM_SETTINGS.forEach(d => { numericInit[d.settingKey] = d.initialFromDetail(alarms); });
    RF_LOADING_SETTINGS.forEach(d => { numericInit[d.settingKey] = d.initialFromDetail(loadingPilot); });
    BENCH_FWD_SETTINGS.forEach(d => { numericInit[d.settingKey] = d.initialFromDetail(); });
    BENCH_REV_SETTINGS.filter(d => !d.widget).forEach(d => { numericInit[d.settingKey] = d.initialFromDetail(); });
    SYSTEM_LOG_SETTINGS.filter(d => !d.widget).forEach(d => { numericInit[d.settingKey] = d.initialFromDetail(); });
    setNumericValues(numericInit);

    const enumInit = {};
    RF_MODE_SETTINGS.forEach(d => { enumInit[d.settingKey] = d.initialFromDetail(system); });
    BENCH_REV_SETTINGS.filter(d => d.widget).forEach(d => { enumInit[d.settingKey] = d.initialFromDetail(); });
    SYSTEM_LOG_SETTINGS.filter(d => d.widget).forEach(d => { enumInit[d.settingKey] = d.initialFromDetail(system); });
    setEnumValues(enumInit);

    const maskInit = {};
    ALARM_MASK_SETTINGS.forEach(d => { maskInit[d.settingKey] = d.initialFromDetail(masks); });
    ALARM_MASK_OTHER_SETTINGS.forEach(d => { maskInit[d.settingKey] = d.initialFromDetail(masks); });
    setMaskValues(maskInit);

    setLocationForm({
      latitude:  deviceDetail.latitude  ?? 0,
      longitude: deviceDetail.longitude ?? 0,
      address:   deviceDetail.settings?.system?.locationAddress ?? '',
    });
  }, [deviceDetail]);

  // ---------- partType filter: GET /iot/devices/{devEui}/settings ----------
  useEffect(() => {
    if (!devEui) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await DeviceApi.listApplicableSettings(devEui);
        if (cancelled) return;
        const keys = new Set((data?.settings || []).map(s => s.settingKey));
        setAllowedKeysSet(keys);
      } catch (error) {
        console.error('listApplicableSettings failed, fall through to show all:', error);
      }
    })();
    return () => { cancelled = true; };
  }, [devEui]);

  // schema → filtered schema; null filter passes through unchanged (fail-open).
  const visible = (schema) =>
    allowedKeysSet === null ? schema : schema.filter(s => allowedKeysSet.has(s.settingKey));

  // ---------- SET handlers ----------
  // All three use the same generic POST endpoint; only the value source differs.
  const handleSetNumeric = async (def) => {
    const lockKey = `SET_${def.settingKey.replace(/-/g, '_').toUpperCase()}`;
    if (!requestCommandLock(lockKey, 5000)) return;
    markSent(def.settingKey);
    try {
      await DeviceApi.setDeviceSetting(devEui, def.settingKey, numericValues[def.settingKey]);
      showToast(`${def.label} sent — tap Reload above to verify when device responds`, 'success');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Send failed';
      showToast(msg, 'error');
    } finally {
      releaseCommandLock();
    }
  };

  const handleSetEnum = async (def) => {
    const lockKey = `SET_${def.settingKey.replace(/-/g, '_').toUpperCase()}`;
    if (!requestCommandLock(lockKey, 5000)) return;
    markSent(def.settingKey);
    try {
      await DeviceApi.setDeviceSetting(devEui, def.settingKey, enumValues[def.settingKey]);
      showToast(`${def.label} sent — tap Reload above to verify when device responds`, 'success');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Send failed';
      showToast(msg, 'error');
    } finally {
      releaseCommandLock();
    }
  };

  // Mask: auto-send on toggle (no Set button). Optimistic UI; rollback on failure.
  const handleSetMask = async (def, nextValue) => {
    const lockKey = `SET_${def.settingKey.replace(/-/g, '_').toUpperCase()}`;
    if (!requestCommandLock(lockKey, 5000)) return;
    setMaskValues(prev => ({ ...prev, [def.settingKey]: nextValue }));
    markSent(def.settingKey);
    try {
      await DeviceApi.setDeviceSetting(devEui, def.settingKey, nextValue);
      showToast(`${def.label} sent — tap Reload above to verify when device responds`, 'success');
    } catch (error) {
      const msg = error?.response?.data?.message || 'Send failed';
      showToast(msg, 'error');
      // rollback optimistic update
      setMaskValues(prev => ({ ...prev, [def.settingKey]: nextValue === 1 ? 0 : 1 }));
    } finally {
      releaseCommandLock();
    }
  };

  const handleSetLocation = async () => {
    if (!requestCommandLock('SET_DEVICE_LOCATION', 5000)) return;
    markSent('__location__');
    try {
      await DeviceApi.updateDeviceLocation(devEui, locationForm.latitude, locationForm.longitude);
      showToast('Map location sent — tap Reload above to verify when device responds', 'success');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Send failed', 'error');
    } finally {
      releaseCommandLock();
    }
  };

  const handleSetAddress = async () => {
    if (!requestCommandLock('SET_DEVICE_ADDRESS', 5000)) return;
    markSent('__address__');
    try {
      await DeviceApi.updateDeviceAddress(devEui, locationForm.address);
      showToast('Address sent — tap Reload above to verify when device responds', 'success');
    } catch (error) {
      showToast(error?.response?.data?.message || 'Send failed', 'error');
    } finally {
      releaseCommandLock();
    }
  };

  // ---------- Row renderers ----------
  const renderNumericRow = (def, valueMap, setValueMap, handler) => (
    <Grid key={def.settingKey} container spacing={2} alignItems="center">
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{def.label}</Typography>
        <Typography variant="caption" color="text.secondary">{def.helperText}</Typography>
      </Grid>
      <Grid size={{ xs: 8, md: 4 }}>
        <TextField
          size="small"
          fullWidth
          type="number"
          value={valueMap[def.settingKey] ?? ''}
          inputProps={{ min: def.min, max: def.max, step: def.step }}
          InputProps={{
            endAdornment: def.unit
              ? (<InputAdornment position="end">{def.unit}</InputAdornment>)
              : null,
          }}
          onChange={(e) => setValueMap(prev => ({
            ...prev,
            [def.settingKey]: e.target.value,
          }))}
        />
      </Grid>
      <Grid size={{ xs: 4, md: 2 }}>
        <Button
          fullWidth
          size="small"
          variant="contained"
          color="primary"
          disabled={pendingCommand !== null}
          onClick={() => handler(def)}
        >
          {sentKeys[def.settingKey] ? 'Sent' : 'Set'}
        </Button>
      </Grid>
    </Grid>
  );

  // Enum row: dropdown (TextField select) or switch + Set button.
  const renderEnumRow = (def) => (
    <Grid key={def.settingKey} container spacing={2} alignItems="center">
      <Grid size={{ xs: 12, md: 6 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>{def.label}</Typography>
        <Typography variant="caption" color="text.secondary">{def.helperText}</Typography>
      </Grid>
      <Grid size={{ xs: 8, md: 4 }}>
        {def.widget === 'dropdown' && (
          <TextField
            select
            size="small"
            fullWidth
            value={enumValues[def.settingKey] ?? ''}
            onChange={(e) => setEnumValues(prev => ({
              ...prev,
              [def.settingKey]: Number(e.target.value),
            }))}
          >
            {def.options.map(o => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
        )}
        {def.widget === 'switch' && (
          <FormControlLabel
            control={
              <Switch
                checked={enumValues[def.settingKey] === 1}
                onChange={(e) => setEnumValues(prev => ({
                  ...prev,
                  [def.settingKey]: e.target.checked ? 1 : 0,
                }))}
              />
            }
            label={enumValues[def.settingKey] === 1 ? 'ON' : 'OFF (TGC mode)'}
          />
        )}
      </Grid>
      <Grid size={{ xs: 4, md: 2 }}>
        <Button
          fullWidth
          size="small"
          variant="contained"
          color="primary"
          disabled={pendingCommand !== null}
          onClick={() => handleSetEnum(def)}
        >
          {sentKeys[def.settingKey] ? 'Sent' : 'Set'}
        </Button>
      </Grid>
    </Grid>
  );

  const renderAlarmCard = (groupId) => {
    const thresholds = visible(ALARM_SETTINGS).filter(s => s.groupId === groupId);
    if (thresholds.length === 0) return null;
    const mask = visible(ALARM_MASK_SETTINGS).find(s => s.groupId === groupId);
    const groupName = ALARM_GROUP_DISPLAY[groupId] || groupId;
    return (
      <Box
        key={groupId}
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          p: 2,
        }}
      >
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {groupName}
          </Typography>
          {mask && (
            <Tooltip title={`Toggle ${mask.label}`}>
              <Box>
                <FormControlLabel
                  labelPlacement="start"
                  sx={{ mr: 0 }}
                  control={
                    <Switch
                      size="small"
                      checked={maskValues[mask.settingKey] === 1}
                      disabled={pendingCommand !== null}
                      onChange={(e) => handleSetMask(mask, e.target.checked ? 1 : 0)}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      {sentKeys[mask.settingKey] ? 'Sent' : 'Alarm enable'}
                    </Typography>
                  }
                />
              </Box>
            </Tooltip>
          )}
        </Stack>
        <Stack spacing={2}>
          {thresholds.map(def =>
            renderNumericRow(def, numericValues, setNumericValues, handleSetNumeric)
          )}
        </Stack>
      </Box>
    );
  };

  // ---------- compute visible sub-arrays once per render ----------
  const visibleAlarmGroups = ['temperature', 'voltage', 'ripple', 'rf-out']
    .filter(gid => visible(ALARM_SETTINGS).some(s => s.groupId === gid));
  const visibleOtherMasks = visible(ALARM_MASK_OTHER_SETTINGS);
  const visibleRfMode     = visible(RF_MODE_SETTINGS);
  const visibleRfLoading  = visible(RF_LOADING_SETTINGS);
  const visibleBenchFwd   = visible(BENCH_FWD_SETTINGS);
  const visibleBenchRev   = visible(BENCH_REV_SETTINGS);
  const visibleSysLog     = visible(SYSTEM_LOG_SETTINGS);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>

      {/* Header: heading + manual SETTINGS sync (per-target cooldown + pending) */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={PAGE_SECTION_HEADING_SX}>Device settings</Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            {syncPending?.SETTINGS && (
              <Typography variant="caption" color="text.secondary">Syncing...</Typography>
            )}
            <Tooltip title={
              syncPending?.SETTINGS
                ? 'Waiting for device response (up to 20s)...'
                : syncCooldown.SETTINGS > 0
                  ? `Cooling down (${syncCooldown.SETTINGS}s)`
                  : 'Reload current settings from the device.'
            }>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleManualSync('SETTINGS')}
                  disabled={syncCooldown.SETTINGS > 0 || syncPending?.SETTINGS}
                >
                  {syncPending?.SETTINGS
                    ? <CircularProgress size={16} />
                    : syncCooldown.SETTINGS > 0
                      ? <Typography variant="caption">{syncCooldown.SETTINGS}s</Typography>
                      : <RefreshIcon />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}
        >
          Tap Reload above to refresh values from the device after sending.
        </Typography>
      </Box>

      {(visibleAlarmGroups.length > 0 || visibleOtherMasks.length > 0) && (
        <CollapsibleSection title="Alarm Thresholds" defaultExpanded={true}>
          <Stack spacing={2}>
            {visibleAlarmGroups.map(renderAlarmCard)}
          </Stack>
          {visibleOtherMasks.length > 0 && (
            <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Other Status Masks
              </Typography>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                flexWrap="wrap"
              >
                {visibleOtherMasks.map(def => (
                  <FormControlLabel
                    key={def.settingKey}
                    control={
                      <Switch
                        size="small"
                        checked={maskValues[def.settingKey] === 1}
                        disabled={pendingCommand !== null}
                        onChange={(e) => handleSetMask(def, e.target.checked ? 1 : 0)}
                      />
                    }
                    label={
                      <Typography variant="body2">
                        {sentKeys[def.settingKey] ? `${def.label} (Sent)` : def.label}
                      </Typography>
                    }
                  />
                ))}
              </Stack>
            </Box>
          )}
        </CollapsibleSection>
      )}

      {visibleRfMode.length > 0 && (
        <CollapsibleSection title="RF Mode" defaultExpanded={true}>
          <Stack spacing={2}>
            {visibleRfMode.map(renderEnumRow)}
          </Stack>
        </CollapsibleSection>
      )}

      {visibleRfLoading.length > 0 && (
        <CollapsibleSection title="RF Loading & Pilot" defaultExpanded={true}>
          <Stack spacing={2}>
            {visibleRfLoading.map(def =>
              renderNumericRow(def, numericValues, setNumericValues, handleSetNumeric)
            )}
          </Stack>
        </CollapsibleSection>
      )}

      {visibleBenchFwd.length > 0 && (
        <CollapsibleSection
          title="Bench Mode FWD"
          helperText="Group assignment to physical ports depends on device part type."
          defaultExpanded={false}
        >
          <Stack spacing={2}>
            {visibleBenchFwd.map(def =>
              renderNumericRow(def, numericValues, setNumericValues, handleSetNumeric)
            )}
          </Stack>
        </CollapsibleSection>
      )}

      {visibleBenchRev.length > 0 && (
        <CollapsibleSection
          title="Bench Mode REV"
          helperText="Group assignment to physical ports depends on device part type."
          defaultExpanded={false}
        >
          <Stack spacing={2}>
            {visibleBenchRev.map(def =>
              def.widget
                ? renderEnumRow(def)
                : renderNumericRow(def, numericValues, setNumericValues, handleSetNumeric)
            )}
          </Stack>
        </CollapsibleSection>
      )}

      {visibleSysLog.length > 0 && (
        <CollapsibleSection title="System Log" defaultExpanded={false}>
          <Stack spacing={2}>
            {visibleSysLog.map(def =>
              def.widget
                ? renderEnumRow(def)
                : renderNumericRow(def, numericValues, setNumericValues, handleSetNumeric)
            )}
          </Stack>
        </CollapsibleSection>
      )}

      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={PAGE_SECTION_HEADING_SX}>Map location</Typography>
          <Chip label="Beta" size="small" color="warning" />
        </Box>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <TextField
            size="small"
            type="number"
            label="Latitude"
            helperText="-90 ~ 90"
            value={locationForm.latitude}
            inputProps={{ min: -90, max: 90, step: 0.000001 }}
            onChange={(e) => setLocationForm(prev => ({
              ...prev, latitude: e.target.value,
            }))}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <TextField
            size="small"
            type="number"
            label="Longitude"
            helperText="-180 ~ 180"
            value={locationForm.longitude}
            inputProps={{ min: -180, max: 180, step: 0.000001 }}
            onChange={(e) => setLocationForm(prev => ({
              ...prev, longitude: e.target.value,
            }))}
            sx={{ width: { xs: '100%', sm: 200 } }}
          />
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={pendingCommand !== null}
            onClick={handleSetLocation}
          >
            {sentKeys['__location__'] ? 'Sent' : 'Set'}
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography sx={PAGE_SECTION_HEADING_SX}>Address text (UTF-16)</Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', sm: 'center' }}
        >
          <TextField
            multiline
            rows={1}
            label="Location Address"
            placeholder="Enter the installation address"
            value={locationForm.address}
            inputProps={{ maxLength: 48 }}
            onChange={(e) => setLocationForm(prev => ({
              ...prev, address: e.target.value,
            }))}
            helperText={
              <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Max 48 characters (UTF-16)</span>
                <span style={{ color: locationForm.address.length >= 40 ? 'orange' : 'inherit' }}>
                  {locationForm.address.length}/48
                </span>
              </Box>
            }
            sx={{ flexGrow: 1 }}
          />
          <Button
            size="small"
            variant="contained"
            color="primary"
            disabled={pendingCommand !== null}
            onClick={handleSetAddress}
          >
            {sentKeys['__address__'] ? 'Sent' : 'Set'}
          </Button>
        </Stack>
      </Stack>

    </Box>
  );
}