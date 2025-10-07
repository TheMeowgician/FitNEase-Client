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

export const FONT_WEIGHTS = {
  NORMAL: '400' as '400',
  MEDIUM: '500' as '500',
  SEMIBOLD: '600' as '600',
  BOLD: '700' as '700',
} as const;

export const LINE_HEIGHTS = {
  TIGHT: 1.2,
  NORMAL: 1.4,
  RELAXED: 1.6,
  LOOSE: 1.8,
} as const;