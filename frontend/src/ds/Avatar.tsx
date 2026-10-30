import type { HTMLAttributes } from "react";
import { PawPrint } from "lucide-react";

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl'

const sizes: Record<AvatarSize, string> = {
	sm: 'size-8',
	md: 'size-10',
	lg: 'size-14',
	xl: 'size-24',
}

const pawSizes: Record<AvatarSize, string> = {
	sm: 'size-4',
	md: 'size-5',
	lg: 'size-7',
	xl: 'size-12',
}

const dotSizes: Record<AvatarSize, string> = {
	sm: 'size-2',
	md: 'size-2.5',
	lg: 'size-3.5',
	xl: 'size-5',
}

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
	src?: string | null
	name: string
	size?: AvatarSize
	online?: boolean
}

export function Avatar({ src, name, size = 'md', online, className='', ...rest}: AvatarProps) {
	return (
		<div className={`relative inline-block shrink-0 ${sizes[size]} ${className}`} {...rest} >
			{src ? (
				<img src={src} alt={name} className="size-full rounded-full object-cover" />) : (
				<div role="img" aria-label={name} className="flex size-full items-center justify-center rounded-full bg-sage-100 text-sage-600">
					<PawPrint className={pawSizes[size]} aria-hidden="true" />
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