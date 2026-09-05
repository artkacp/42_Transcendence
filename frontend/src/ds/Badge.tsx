import type { HTMLAttributes } from 'react'

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  neutral: 'bg-cream-200 text-ink-700',
  success: 'bg-sage-100 text-sage-600',
  warning: 'bg-honey-100 text-ink-700',
  danger: 'bg-danger-100 text-danger-600',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Badge({
  tone = 'neutral',
  className = '',
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${tones[tone]} ${className}`}
      {...rest}
    >
      {children}
    </span>
  )
}