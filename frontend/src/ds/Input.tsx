import type { InputHTMLAttributes } from 'react';
import { useId } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({label, error, className = '', id, ...rest}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
		<div className="space-y-1.5">
			{label && (
				<label htmlFor={inputId} className="block text-sm font-medium text-text">
					{label}
				</label>
			)}
			<input id={inputId} className={`w-full rounded-full border px-4 py-2 text-sm ${className}`} {...rest}/>
			{error && (
				<p className="text-sm text-danger">
					{error}
				</p>
			)}
		</div>
	)
}