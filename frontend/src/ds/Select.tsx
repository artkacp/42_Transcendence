import { useId, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: SelectOption[]
}

export function Select({ options, className = '', id, ...rest }: SelectProps) {
  const generatedId = useId()
  const selectId = id ?? generatedId

  return (
    <div className={`relative inline-block ${className}`}>
      <select
        id={selectId}
        className="w-full appearance-none rounded-full border border-border bg-surface/70 px-4 py-2 pr-9 text-sm text-text transition-colors hover:bg-surface-raised/70 focus-visible:outline-none focus-gradient [--focus-color:var(--color-primary)] [--focus-edge:0px] disabled:opacity-40 disabled:pointer-events-none"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
    </div>
  )
}