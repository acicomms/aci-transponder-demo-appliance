import { RF_MODE_SETTINGS } from './settingDefinitions';

// Working Mode
export const WORKING_MODE_LABELS = {
  12: 'Bandwidth Pilot Unlocked',
  13: 'Bandwidth Pilot Locked',
  14: 'Bandwidth Pilot Lose Pilot',
  22: 'User Setting Pilot Unlocked',
  23: 'User Setting Pilot Locked',
  24: 'User Setting Pilot Lose Pilot',
  71: 'TGC with Log Input PAD',
  72: 'TGC with Manual Input PAD',
  81: 'Bench Test',
  82: 'Bench Test',
  83: 'Bench Test',
};

export const formatWorkingMode = (raw) => {
  if (raw === null || raw === undefined || raw === -999) return '—';
  return WORKING_MODE_LABELS[raw] || `Unknown (raw=${raw})`;
};

// DFU Type Active
const DFU_TYPE_OPTIONS = (
  RF_MODE_SETTINGS.find(s => s.settingKey === 'dfu-type')?.options || []
);

export const formatDfuTypeActive = (raw) => {
  if (raw === null || raw === undefined || raw === -999) return '—';
  const match = DFU_TYPE_OPTIONS.find(o => o.value === raw);
  return match ? match.label : `Unknown (raw=${raw})`;
};