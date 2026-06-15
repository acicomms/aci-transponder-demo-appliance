// src/theme/theme.js
//
// Phase 5 design tokens — derived from PM-provided UI reference.
// Single source of truth for atomic theme: palette / typography /
// shape / per-component override.  Application-level composite sx
// (SECTION_CARD_SX etc) lives in src/constants/cardStyles.jsx.

import { createTheme } from '@mui/material/styles';

const SYSTEM_FONT_STACK = [
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI"',
  'Roboto',
  '"Helvetica Neue"',
  'Arial',
  'sans-serif',
].join(',');

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main:  '#2563EB', // blue-600
      dark:  '#1D4ED8', // blue-700  (hover)
      light: '#DBEAFE', // blue-100  (region chip bg)
      contrastText: '#FFFFFF',
    },
    success: { main: '#10B981' }, // emerald-500
    error:   { main: '#EF4444' }, // red-500
    warning: { main: '#F59E0B' }, // amber-500
    info:    { main: '#2563EB' },
    background: {
      default: '#F8FAFC', // slate-50  — page bg
      paper:   '#FFFFFF', // card bg
    },
    text: {
      primary:   '#0F172A', // slate-900
      secondary: '#64748B', // slate-500
      disabled:  '#94A3B8', // slate-400
    },
    divider: '#E2E8F0',     // slate-200
    // Custom palette key — sidebar (dark zone).
    // Read via theme.palette.sidebar.* in step 2 Sidebar/TopNav rewrite.
    sidebar: {
      bg: '#0F172A',
      text: '#CBD5E1',
      muted: '#64748B',
      selectedBg: '#1D4ED8',
      selectedFg: '#FFFFFF',
      hoverBg: '#1E293B',
    },
  },

  typography: {
    fontFamily: SYSTEM_FONT_STACK,
    h4: { fontSize: '1.5rem',  fontWeight: 600 }, // 24px page title
    h5: { fontSize: '1.25rem', fontWeight: 600 }, // 20px
    h6: { fontSize: '1rem',    fontWeight: 600 }, // 16px section title
    subtitle1: { fontSize: '1rem',     fontWeight: 600 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '0.875rem', fontWeight: 400 },
    body2: { fontSize: '0.875rem', fontWeight: 400 },
    caption: { fontSize: '0.75rem', fontWeight: 400 },
    // Disable MUI default uppercase + heavier weight on buttons.
    button: { textTransform: 'none', fontWeight: 500 },
  },

  // shape.borderRadius left at MUI default (4) on purpose — cardStyles.jsx
  // applies '12px' explicitly where needed; Button/Chip overridden below to 8.
  shape: { borderRadius: 4 },

  components: {
    MuiButton: {
      styleOverrides: {
        root:      { borderRadius: 8 },
        // Spec replaces button shadow with border — remove default elevation.
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // Unify divider color across all tables (was rgba(0,0,0,0.12) default).
        root: { borderColor: '#E2E8F0' },
      },
    },
  },
});

export default theme;