import { createContext, useContext } from 'react'
import type { ToastKind } from '../../ds'

export interface ToastInput {
  kind?: ToastKind
  title: string
  message?: string
}

export const ToastContext = createContext<((toast: ToastInput) => void) | null>(null)

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used inside <ToastProvider>')
  return toast
}
