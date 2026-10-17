// src/ds/button-classes.ts
// Button look in one place: used by <Button> and by elements that can't be one
// (e.g. role="tab" in Tabs). Kept out of Button.tsx so Fast Refresh works
// (a .tsx file should export components only).

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type Size = 'sm' | 'md' | 'lg'

/* --focus-color feeds the .focus-gradient glow, --rim the .rim-gradient ring (index.css).
   Every variant sets --focus-edge:0px: hover darkens the bg, and a crisp edge in
   the lighter --focus-color would show as a ring around it. */
const variants: Record<Variant, string> = {
  // (◕◕) + [--focus-edge:0px], same as the other three
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover [--focus-color:var(--color-primary)] [--focus-edge:0px]',
  secondary:
    'bg-secondary text-on-secondary hover:bg-secondary-hover hover:text-on-primary active:bg-secondary-active active:text-on-primary [--focus-color:var(--color-sage-300)] [--focus-inner:var(--color-secondary-active)] [--focus-edge:0px] rim-gradient [--rim:var(--gradient-rim-secondary)]',
  ghost:
    'bg-transparent text-text hover:bg-ink-900/10 active:bg-ink-900/20 [--focus-color:var(--color-text-muted)] [--focus-edge:0px]',
  danger:
    'bg-danger-soft text-danger hover:bg-danger hover:text-on-primary active:bg-danger active:text-on-primary [--focus-color:var(--color-danger)] [--focus-inner:var(--color-danger)] [--focus-edge:0px]',
}

const sizes: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 gap-1.5 rounded-full',
  md: 'text-sm px-4 py-2 gap-2 rounded-full',
  lg: 'text-base px-6 py-3 gap-2 rounded-full',
}

const base =
  'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-gradient disabled:opacity-40 disabled:pointer-events-none cursor-pointer'

export function buttonClass(variant: Variant = 'primary', size: Size = 'md') {
  return `${base} ${variants[variant]} ${sizes[size]}`
}