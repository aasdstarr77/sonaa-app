// Central semantic palette for Sonaa Android.
// Update these tokens to retune colors without editing screen components.
export const COLORS = {
  white: '#FFFFFF',
  paleIndigo: '#E7EAFE',
  teal: '#0891B2',
  teal500: '#14B8A6',
  tealDark: '#0E7490',
  navy: '#172554',
  text: '#172554',
  indigo900: '#312E81',
  indigo700: '#4338CA',
  indigo500: '#6366F1',
  indigo400: '#818CF8',
  indigo200: '#C7D2FE',
  indigo100: '#E0E7FF',
  indigo50: '#EEF2FF',
  blue: '#4F46E5',
  background: '#F5F7FF',
  border: '#D8DDF5',
  placeholder: '#8794B8',
  muted: '#64748B',
  slate: '#475569',
  slateMuted: '#596080',
  slateIndigo: '#373B65',
  gold: '#F59E0B',
  amber100: '#FEF3C7',
  amber200: '#FDE68A',
  amber300: '#FCD34D',
  amber50: '#FFFBEB',
  amber800: '#92400E',
  amber900: '#78350F',
  red: '#DC2626',
  redDark: '#B91C1C',
  redDeep: '#991B1B',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  green: '#10B981',
  greenDark: '#047857',
  greenMedium: '#059669',
  cyan50: '#ECFEFF',
  cyan100: '#CFFAFE',
  cyan300: '#A5F3FC',
  cyan400: '#67E8F9',
};

// Independent page palettes: adjust a page's main colors here.
export const PAGE_COLORS = {
  home: {
    background: COLORS.white, surface: COLORS.background, primary: COLORS.navy,
    accent: COLORS.teal, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  login: {
    background: COLORS.white, surface: COLORS.indigo50, primary: COLORS.navy,
    accent: COLORS.teal, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  client: {
    background: COLORS.background, surface: COLORS.white, primary: COLORS.navy,
    accent: COLORS.teal, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  technician: {
    background: COLORS.background, surface: COLORS.white, primary: COLORS.navy,
    accent: COLORS.blue, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  admin: {
    background: COLORS.background, surface: COLORS.white, primary: COLORS.navy,
    accent: COLORS.indigo700, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  support: {
    background: COLORS.background, surface: COLORS.white, primary: COLORS.navy,
    accent: COLORS.cyan400, text: COLORS.navy, muted: COLORS.muted, border: COLORS.border,
  },
  splash: {
    background: COLORS.background, surface: COLORS.white, primary: COLORS.navy,
    accent: COLORS.teal, text: COLORS.navy, muted: COLORS.muted, border: COLORS.indigo200,
  },
};
