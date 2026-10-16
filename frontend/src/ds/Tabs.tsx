
// DS · Tabs — WAI-ARIA tabs pattern, automatic activation.
// tablist holds the tabs; one tabpanel shows the active content.
// Keys: ← → move (wraps) · Home first · End last · Tab leaves to the panel.
// Roving tabindex: active tab = 0 (in Tab order), others = -1 (reached by arrows).

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { buttonClass } from './button-classes'

export type TabItem<T extends string> = { id: T; label: string }

export interface TabsProps<T extends string> {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string // aria-label for the tablist
  disabled?: boolean
  children: ReactNode // content of the active tab
}

// same look as Button: active = secondary, inactive = ghost
const ACTIVE = buttonClass('secondary')
const INACTIVE = buttonClass('ghost')

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
  disabled = false,
  children,
}: TabsProps<T>) {
  const baseId = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const tabId = (id: T) => `${baseId}-tab-${id}`
  const panelId = `${baseId}-panel`

  function moveTo(index: number) {
    const i = (index + items.length) % items.length // wrap around
    onChange(items[i].id)
    refs.current[i]?.focus()
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((t) => t.id === value)
    switch (e.key) {
      case 'ArrowRight': moveTo(current + 1); break
      case 'ArrowLeft':  moveTo(current - 1); break
      case 'Home':       moveTo(0); break
      case 'End':        moveTo(items.length - 1); break
      default: return // let other keys (Tab!) work normally
    }
    e.preventDefault() // stop the page from scrolling on Home/End
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={handleKeyDown}
        className="grid gap-1 rounded-full bg-ink-900/5 p-1"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((tab, i) => {
          const selected = tab.id === value
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="tab"
              id={tabId(tab.id)}
              aria-selected={selected}
              aria-controls={selected ? panelId : undefined}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(tab.id)}
              className={selected ? ACTIVE : INACTIVE}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* panel has focusable fields inside, so no tabIndex needed (APG) */}
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(value)}>
        {children}
      </div>
    </div>
  )
}
