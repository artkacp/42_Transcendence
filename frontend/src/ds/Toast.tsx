import type { ReactNode } from 'react'
import { Info, Pencil, Plus, Trash2, X } from 'lucide-react'
import { IconButton } from './Button'
export type ToastKind = 'create' | 'update' | 'delete' | 'info'

const kinds: Record<ToastKind, { icon: ReactNode; tint: string; label: string }> = {
  create: { icon: <Plus className="size-4" />, tint: 'bg-secondary text-on-secondary', label: 'Created' },
  update: { icon: <Pencil className="size-4" />, tint: 'bg-warning-soft text-text', label: 'Updated' },
  delete: { icon: <Trash2 className="size-4" />, tint: 'bg-danger-soft text-danger', label: 'Deleted' },
  info: { icon: <Info className="size-4" />, tint: 'bg-surface-sunken text-text-muted', label: 'Info' },
}

export interface ToastProps {
  kind?: ToastKind
  title: string
  message?: string
  onDismiss: () => void
}

export function Toast({ kind = 'info', title, message, onDismiss }: ToastProps) {
  const { icon, tint, label } = kinds[kind]

  return (
    <div className="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-[0_8px_24px_rgba(70,50,40,0.1)]">
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tint}`} aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-sm font-semibold text-text">
          <span className="sr-only">{label}: </span>
          {title}
        </p>
        {message && <p className="mt-0.5 text-sm text-text-muted">{message}</p>}
      </div>
      <IconButton label="Dismiss" onClick={onDismiss} className="-mt-1 -mr-2 shrink-0">
        <X aria-hidden="true" className="size-4" />
      </IconButton>
    </div>
  )
}
