import type { HTMLAttributes } from "react";

type AvatarSize = 'sm' | 'md' | 'lg'

const sizes: Record<AvatarSize, string> = {
	sm: 'size-8 text-xs',
	md: 'size-10 text-sm',
	lg: 'size-14 text-lg',
}

const dotSizes: Record<AvatarSize, string> = {
	sm: 'size-2',
	md: 'size-2.5',
	lg: 'size-3.5',
}

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
	src?: string | null
	name: string
	size?: AvatarSize
	online?: boolean
}

function initials(name: string): string {

	const parts = name.trim().split(/\s+/);
	const first = parts[0]?.[0] ?? '';
	const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
	return (first.toUpperCase() + last.toUpperCase());
}

export function Avatar({ src, name, size = 'md', online, className='', ...rest}: AvatarProps) {
	return (
		<div className={`relative inline-block shrink-0 ${sizes[size]} ${className}`} {...rest} >
			{src ? (
				<img src={src} alt={name} className="size-full rounded-full object-cover" />) : (
				<div className="flex size-full items-center justify-center rounded-full bg-sage-100 font-semibold text-sage-600">
					{initials(name)}
				</div>
			)}
			{online != null && (
				<span
					className={`absolute bottom-0 right-0 rounded-full ring-2 ring-cream-50 ${dotSizes[size]} ${online ? 'bg-sage-500' : 'bg-ink-400'}`}
					aria-label={online ? 'online' : 'offline'}/>
			)}
		</div>
	)
}