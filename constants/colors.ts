export const COLORS = {
  // Primary Brand Colors
  PRIMARY: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // Secondary Colors
  SECONDARY: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // Success Colors (for achievements, completed workouts)
  SUCCESS: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // Warning Colors (for rest periods, caution)
  WARNING: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error Colors (for validation, errors)
  ERROR: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // Tabata-specific Colors
  TABATA: {
    WORK: '#ef4444',     // Red for work periods
    REST: '#22c55e',     // Green for rest periods
    PREPARATION: '#f59e0b', // Orange for preparation
    COMPLETE: '#8b5cf6',    // Purple for completion
  },

  // Neutral Colors
  NEUTRAL: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    WHITE: '#ffffff',
    BLACK: '#000000',
    TRANSPARENT: 'transparent',
  },

  // Social Colors
  SOCIAL: {
    FACEBOOK: '#1877f2',
    GOOGLE: '#4285f4',
    APPLE: '#000000',
    INSTAGRAM: '#e4405f',
    TWITTER: '#1da1f2',
  },
};

export const THEME = {
  LIGHT: {
    BACKGROUND: COLORS.NEUTRAL.WHITE,
    SURFACE: COLORS.SECONDARY[50],
    PRIMARY: COLORS.PRIMARY[600],
    SECONDARY: COLORS.SECONDARY[600],
    TEXT: {
      PRIMARY: COLORS.SECONDARY[900],
      SECONDARY: COLORS.SECONDARY[700],
      DISABLED: COLORS.SECONDARY[400],
      INVERSE: COLORS.NEUTRAL.WHITE,
    },
    BORDER: COLORS.SECONDARY[200],
    DIVIDER: COLORS.SECONDARY[100],
    SHADOW: COLORS.SECONDARY[500],
  },

  DARK: {
    BACKGROUND: COLORS.SECONDARY[900],
    SURFACE: COLORS.SECONDARY[800],
    PRIMARY: COLORS.PRIMARY[400],
    SECONDARY: COLORS.SECONDARY[400],
    TEXT: {
      PRIMARY: COLORS.NEUTRAL.WHITE,
      SECONDARY: COLORS.SECONDARY[300],
      DISABLED: COLORS.SECONDARY[600],
      INVERSE: COLORS.SECONDARY[900],
    },
    BORDER: COLORS.SECONDARY[700],
    DIVIDER: COLORS.SECONDARY[800],
    SHADOW: COLORS.NEUTRAL.BLACK,
  },
};

export const GRADIENTS = {
  PRIMARY: ['#0ea5e9', '#0284c7'],
  SECONDARY: ['#64748b', '#475569'],
  SUCCESS: ['#22c55e', '#16a34a'],
  WARNING: ['#f59e0b', '#d97706'],
  ERROR: ['#ef4444', '#dc2626'],
  TABATA_WORK: ['#ef4444', '#dc2626'],
  TABATA_REST: ['#22c55e', '#16a34a'],
  SUNSET: ['#f59e0b', '#ef4444'],
  OCEAN: ['#0ea5e9', '#8b5cf6'],
};

export const FONTS = {
  REGULAR: 'Poppins-Regular',
  SEMIBOLD: 'Poppins-SemiBold',
  BOLD: 'Poppins-Bold',
} as const;

export const FONT_SIZES = {
  XS: 12,
  SM: 14,
  BASE: 16,
  LG: 18,
  XL: 20,
  XXL: 24,
  XXXL: 28,
  DISPLAY_SM: 32,
  DISPLAY_MD: 36,
  DISPLAY_LG: 40,
  DISPLAY_XL: 48,
} as const;