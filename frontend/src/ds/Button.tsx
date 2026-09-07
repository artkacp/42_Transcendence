import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-terra-500 text-cream-50 hover:bg-terra-600 active:bg-terra-600 focus-visible:ring-terra-500',
  secondary:
    'bg-sage-100 text-sage-600 hover:bg-sage-500 hover:text-cream-50 active:bg-sage-600 active:text-cream-50 focus-visible:ring-sage-500',
    ghost: 'bg-transparent text-ink-700 hover:bg-cream-200/70 active:bg-cream-200 focus-visible:ring-ink-500',
  danger:
    'bg-danger-100 text-danger-600 hover:bg-danger-600 hover:text-cream-50 active:bg-danger-600 active:text-cream-50 focus-visible:ring-danger-600',
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
      className={`inline-flex size-9 items-center justify-center rounded-full text-ink-500 hover:bg-cream-200/80 hover:text-ink-900 active:scale-95 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-500 ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
