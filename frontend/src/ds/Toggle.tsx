import type { ButtonHTMLAttributes } from "react";

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
	checked: boolean
	onChange: (checked: boolean) => void
	label: string
}

export function Toggle({ checked, onChange, label, className = '', disabled, ...rest }: ToggleProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={`inline-flex items-center gap-2 focus-visible:outline-none rounded-full px-2 py-1 -mx-2 focus-gradient [--focus-color:var(--color-primary)] [--focus-edge:0px] disabled:opacity-40 disabled:pointer-events-none ${className}`}
			{...rest}>
			<span
				className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-150 ${checked ? 'bg-terra-500' : 'bg-cream-200'}`}>
				<span className={`inline-block size-4.5 transform rounded-full bg-white shadow transition-transform duration-150 ${checked ? 'translate-x-6' : 'translate-x-1'}`}/>
			</span>
			<span className="text-sm text-ink-700">{label}</span>
		</button>
	)
}