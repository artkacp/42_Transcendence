import { useId, type ComponentProps } from 'react'

export interface InputProps extends ComponentProps<'input'> {
	label?: string
	error?: string
}

export function Input({label, error, className = '', id, ...rest}: InputProps) {
	const generatedId = useId()
	const inputId = id ?? generatedId
	const errorId = `${inputId}-error`

	return (
		<div className="space-y-1.5">
			{label && (
				<label htmlFor={inputId} className="block text-sm font-medium text-text">
					{label}
				</label>
			)}
			<input
				id={inputId}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}

				className={`w-full rounded-full border bg-surface px-4 py-2 text-sm text-text placeholder:text-text-subtle transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-40 disabled:pointer-events-none ${
					error ? 'border-danger focus-visible:outline-danger' : 'border-text focus-visible:outline-primary'
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
