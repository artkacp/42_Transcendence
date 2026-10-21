import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './Button'

type Size = 'sm' | 'md' | 'lg'

const sizes: Record<Size, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export interface ModalProps
  extends Omit<ComponentProps<'dialog'>, 'open' | 'title' | 'onClose' | 'onClick' | 'aria-labelledby' | 'aria-describedby'> {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: ReactNode
  size?: Size
}

const CLOSE_MS = 700
const CLOSE_DELAY_MS = 80
const OVERSHOOT = 0.7 // 0 = no bounce, 1.7 = strong bounce

function easeScrollTo(top: number, ms: number, delay: number) {
  const start = window.scrollY
  const distance = top - start
  if (distance === 0) return
  const t0 = performance.now() + delay

  const step = (now: number) => {
    const t = Math.min(Math.max((now - t0) / ms, 0), 1)
    const p = t - 1
    const eased = 1 + (OVERSHOOT + 1) * p ** 3 + OVERSHOOT * p ** 2 // ease-out-back
    window.scrollTo(0, start + distance * eased)
    if (t < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}


export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  size = 'md',
  className = '',
  children,
  ...rest
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const scrollY = useRef(0)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      scrollY.current = window.scrollY
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  const close = () => dialogRef.current?.close()

  return (
    <dialog
      {...rest}
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        if (reduce) window.scrollTo(0, scrollY.current)
        else easeScrollTo(scrollY.current, CLOSE_MS, CLOSE_DELAY_MS)
        onClose()
      }}
      onClick={(event) => {
        //the panel fills the dialog, so a click that lands on the dialog itself is on the backdrop
        if (event.target === event.currentTarget) close()
      }}
      className={`modal-fade m-auto w-[calc(100%-2rem)] ${sizes[size]} overflow-hidden rounded-3xl border border-border bg-surface p-0 text-text shadow-[0_0_28px_6px_color-mix(in_oklch,var(--color-cream-300)_70%,transparent)] backdrop:bg-overlay/40 backdrop:backdrop-blur-[2px] ${className}`}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
          <div className="space-y-1">
            <h2 id={titleId} className="font-display text-xl text-text">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="text-sm text-text-muted">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close" onClick={close} className="-mt-1 -mr-2 shrink-0">
            <X aria-hidden="true" className="size-4" />
          </IconButton>
        </header>

        <div className="min-h-0 overflow-y-auto px-6 pb-6">{children}</div>

        {footer && (
          <footer className="flex justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  )
}
