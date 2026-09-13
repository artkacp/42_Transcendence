/** Palette token names, shared by PaletteLab and the DesignSystem showcase. */
export const TOKEN_NAMES = [
  'cream-50', 'cream-100', 'cream-200', 'cream-300',
  'ink-900', 'ink-700', 'ink-500', 'ink-400',
  'terra-50', 'terra-100', 'terra-400', 'terra-500', 'terra-600',
  'sage-50', 'sage-100', 'sage-500', 'sage-600',
  'honey-100', 'honey-400',
  'danger-100', 'danger-600',
] as const

export type TokenName = (typeof TOKEN_NAMES)[number]
