import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[]
}

export function Select({ options, className = '', ...rest }: SelectProps) {
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        className="w-full appearance-none rounded-full border border-cream-200 bg-cream-50/70 px-4 py-2 pr-9 text-sm text-ink-700 transition-colors hover:bg-cream-100/70 focus-visible:outline-none focus-gradient [--focus-color:var(--color-honey-500)] [--focus-edge:0px] disabled:opacity-40 disabled:pointer-events-none"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-500" />
    </div>
  )
}
