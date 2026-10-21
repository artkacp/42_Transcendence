import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Toast } from '../../ds'
import { ToastContext, type ToastInput } from './ToastContext'

const DURATION = 4000
const MAX_VISIBLE = 3

type ToastItem = ToastInput & { id: number }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    window.clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (input: ToastInput) => {
      const id = nextId.current++
      setItems((prev) => [...prev, { ...input, id }].slice(-MAX_VISIBLE))
      timers.current.set(id, window.setTimeout(() => dismiss(id), DURATION))
    },
    [dismiss],
  )

  useEffect(() => {
    const active = timers.current
    return () => active.forEach((timer) => window.clearTimeout(timer))
  }, [])

  return (
    <ToastContext value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-20 z-50 flex flex-col gap-2 sm:left-auto sm:w-96 lg:bottom-6 lg:right-6"
      >
        {items.map((item) => (
          <Toast key={item.id} kind={item.kind} title={item.title} message={item.message} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext>
  )
}
