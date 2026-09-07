import type { HTMLAttributes } from 'react'

export function Card({
  className = '',
  hover = false,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return (
    <div
      className={`rounded-3xl bg-surface/70 border border-border shadow-[0_1px_2px_rgba(70,50,40,0.05)] ${
        hover ? 'transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(70,50,40,0.1)]' : ''
      } ${className}`}
      {...rest}
    />
  )
}

