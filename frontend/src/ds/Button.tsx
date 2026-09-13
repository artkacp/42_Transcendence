import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover focus-visible:ring-primary',
  secondary:
    'bg-secondary text-on-secondary hover:bg-secondary-hover hover:text-on-primary active:bg-secondary-active active:text-on-primary focus-visible:ring-secondary-hover',
  ghost:
    'bg-transparent text-text hover:bg-ink-900/10 active:bg-ink-900/20 focus-visible:ring-text-muted',
  danger:
    'bg-danger-soft text-danger hover:bg-danger hover:text-on-primary active:bg-danger active:text-on-primary focus-visible:ring-danger',
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
    'inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-40 disabled:pointer-events-none cursor-pointer'

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
      className={`inline-flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-ink-900/10 hover:text-text active:bg-ink-900/20 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-muted ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}