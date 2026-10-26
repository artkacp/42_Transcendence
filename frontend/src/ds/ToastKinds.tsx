import type { ReactNode } from 'react'
import { Info, Pencil, Plus, Trash2 } from 'lucide-react'
import type { ToastKind } from './Toast'

export const toastKinds: Record<ToastKind, { icon: ReactNode; tint: string; label: string }> = {
  create: { icon: <Plus className="size-4" />, tint: 'bg-secondary text-on-secondary', label: 'Created' },
  update: { icon: <Pencil className="size-4" />, tint: 'bg-warning-soft text-text', label: 'Updated' },
  delete: { icon: <Trash2 className="size-4" />, tint: 'bg-danger-soft text-danger', label: 'Deleted' },
  info: { icon: <Info className="size-4" />, tint: 'bg-surface-sunken text-text-muted', label: 'Info' },
}
