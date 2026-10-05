import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/* --focus-color feeds the .focus-gradient glow, --rim the .rim-gradient ring (index.css) */
const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover [--focus-color:var(--color-primary)]',
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

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
}

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'md',
  icon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-gradient disabled:opacity-40 disabled:pointer-events-none cursor-pointer'

  const combinedClasses = `${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`.trim()

  return (
    <button type={type} className={combinedClasses} {...rest}>
      {icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-ink-900/10 hover:text-text active:bg-ink-900/20 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-gradient [--focus-color:var(--color-text-muted)] ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
