import type { HTMLAttributes, ReactNode } from 'react'

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  emoji?: string
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({emoji = '◣◥ ･ﾟ', title, hint, action, className = '', ...rest} : EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-cream-50/50 px-6 py-16 text-center ${className}`} {...rest}>
      <span className="text-5xl" aria-hidden="true">
        {emoji}
      </span>
      <h3 className="font-display text-xl font-bold text-text">{title}</h3>
      {hint && <p className="max-w-sm text-sm text-text-muted">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
