import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type Size, type Variant } from './button-classes'

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
  const combinedClasses = `${buttonClass(variant, size)} ${className}`.trim()

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
