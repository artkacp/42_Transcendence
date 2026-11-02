import { useId, type ComponentProps } from 'react'

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: string
  error?: string
  // "n / maxLength" under the field; needs maxLength and a controlled value
  showCount?: boolean
}

export function Textarea({ label, error, showCount = false, className = '', id, rows = 4, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const errorId = `${textareaId}-error`
  const countId = `${textareaId}-count`
  const count = showCount && rest.maxLength !== undefined ? String(rest.value ?? '').length : null
  const describedBy = [error ? errorId : '', count !== null ? countId : ''].filter(Boolean).join(' ') || undefined

  const errorLine = error && (
    <p id={errorId} className="text-sm text-danger">
      {error}
    </p>
  )

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-text">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full resize-y rounded-2xl border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-subtle transition-colors focus-visible:outline-none focus-gradient [--focus-edge:0px] focus-visible:border-(--focus-color) disabled:opacity-40 disabled:pointer-events-none ${
          error ? 'border-danger [--focus-color:var(--color-danger)]' : 'border-text [--focus-color:var(--color-primary)]'
        } ${className}`}
        {...rest}
      />
      {count === null ? (
        errorLine
      ) : (
        <div className="flex items-start gap-3">
          {errorLine}
          <p id={countId} className="ml-auto shrink-0 text-xs text-text-muted tabular-nums">
            {count} / {rest.maxLength}
          </p>
        </div>
      )}
    </div>
  )
}
