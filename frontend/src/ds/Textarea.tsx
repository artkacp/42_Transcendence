import { useId, type ComponentProps } from 'react'

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: string
  error?: string
}

export function Textarea({ label, error, className = '', id, rows = 4, ...rest }: TextareaProps) {
  const generatedId = useId()
  const textareaId = id ?? generatedId
  const errorId = `${textareaId}-error`

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
        aria-describedby={error ? errorId : undefined}
        className={`block w-full resize-y rounded-2xl border bg-surface px-4 py-3 text-sm text-text placeholder:text-text-subtle transition-colors focus-visible:outline-none focus-gradient [--focus-edge:0px] focus-visible:border-(--focus-color) disabled:opacity-40 disabled:pointer-events-none ${
          error ? 'border-danger [--focus-color:var(--color-danger)]' : 'border-text [--focus-color:var(--color-primary)]'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
