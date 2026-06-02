export const SECTION_CARD_SX = {
  borderRadius: '12px',
  borderColor: 'divider',
  '& .MuiCardContent-root':           { p: 2.5 },
  '& .MuiCardContent-root:last-child':{ pb: 2.5 },
};

// In-card section title
export const SECTION_CARD_TITLE_SX = {
  fontSize: '1rem',
  fontWeight: 600,
  color: 'text.primary',
};

export const PAGE_SECTION_HEADING_SX = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: 'text.primary',
};

// Page outer Box
export const PAGE_BG_SX = {
  bgcolor: 'background.default',
  minHeight: '100%',
  p: { xs: 2, sm: 3, md: 4 },
};

// Metadata strip
export const METADATA_STRIP_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
  gap: 3,
};

// Borderless table
export const BORDERLESS_TABLE_HEAD_SX = {
  color: 'text.secondary',
  fontWeight: 600,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid',
  borderColor: 'divider',
  py: 1.5,
};

export const BORDERLESS_TABLE_BODY_SX = {
  fontSize: '0.875rem',
  py: 1.75,
  borderBottom: '1px solid',
  borderColor: 'divider',
};


