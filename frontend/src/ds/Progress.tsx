import type { HTMLAttributes } from 'react'

type Tone = 'primary' | 'success' | 'warning' | 'danger'

const tones: Record<Tone, string> = {
  primary: 'bg-gradient-to-r from-progress-from to-progress-to',
  success: 'bg-gradient-to-r from-success-from to-success-to',
  warning: 'bg-gradient-to-r from-warning-from to-warning-to',
  danger: 'bg-gradient-to-r from-danger-from to-danger-to',
}

export interface ProgressProps extends Omit<HTMLAttributes<HTMLDivElement>, 'role'> {
  /** 0–100. Values outside the range are clamped. */
  value: number
  tone?: Tone
  label?: string
}

export function Progress({
  value,
  tone = 'primary',
  label,
  className = '',
  ...rest
}: ProgressProps) {
  const pct = Math.min(100, Math.max(0, Math.round(value)))

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 w-full overflow-hidden rounded-full bg-surface-sunken ${className}`}
      {...rest}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ease-out ${tones[tone]}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}