import type { ButtonHTMLAttributes } from "react";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	active?: boolean
}

export function Chip({active = false, className = '', children, ...rest}: ChipProps) {
	return (
		<button
			type="button"
			{...rest}
			aria-pressed={active}
			className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-gradient [--focus-edge:0px] disabled:opacity-40 disabled:pointer-events-none ${active ? 'bg-terra-500 text-cream-50 [--focus-color:var(--color-primary)]' : 'bg-cream-100 text-ink-700 hover:bg-cream-200/70 [--focus-color:var(--color-honey-500)]'} ${className}`}>
			{children}
		</button>
	)
}