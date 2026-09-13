import { useState } from 'react'

type Token = { name: string; l: number; c: number; h: number }

const NAMES = [
  'cream-50', 'cream-100', 'cream-200', 'cream-300',
  'ink-900', 'ink-700', 'ink-500', 'ink-400',
  'terra-50', 'terra-100', 'terra-400', 'terra-500', 'terra-600',
  'sage-50', 'sage-100', 'sage-500', 'sage-600',
  'honey-100', 'honey-400',
  'danger-100', 'danger-600',
]

const css = (t: Token) => `oklch(${t.l.toFixed(3)} ${t.c.toFixed(3)} ${Math.round(t.h)})`

/** Reads the palette currently in effect, whichever CSS file is imported. */
function readFromCss(): Token[] {
  const style = getComputedStyle(document.documentElement)
  const missing = NAMES.filter((n) => !style.getPropertyValue(`--color-${n}`).trim())
  if (missing.length) console.warn('PaletteLab: no such tokens in CSS:', missing)
  return NAMES.map((name) => {
    const raw = style.getPropertyValue(`--color-${name}`).trim()
    const m = raw.match(/oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
    return m
      ? { name, l: +m[1], c: +m[2], h: +m[3] }
      : { name, l: 0.5, c: 0.05, h: 0 }
  })
}

export function PaletteLab() {
  const [tokens, setTokens] = useState<Token[]>(readFromCss)
  const [copied, setCopied] = useState(false)

  const update = (i: number, key: 'l' | 'c' | 'h', value: number) => {
    const next = tokens.map((t, j) => (j === i ? { ...t, [key]: value } : t))
    setTokens(next)
    // only the edited token is written to the DOM
    document.documentElement.style.setProperty(
      `--color-${next[i].name}`,
      css(next[i]),
    )
  }

  const output = `@theme {
  --font-display: 'Fraunces', ui-serif, serif;
  --font-sans: 'Outfit', ui-sans-serif, sans-serif;

${tokens.map((t) => `  --color-${t.name}: ${css(t)};`).join('\n')}
}
`

const copy = async () => {
  try {
    await navigator.clipboard.writeText(output)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  } catch (err) {
    console.warn('PaletteLab: failed to copy palette file to clipboard', err)
  }
}

  const reset = () => {
    for (const n of NAMES) {
      document.documentElement.style.removeProperty(`--color-${n}`)
    }
    setTokens(readFromCss())
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 overflow-y-auto border-l p-4 text-xs z-50 bg-[#fff] text-[#222] border-[#ccc]">
      <h2 className="text-lg font-semibold mb-3">Palette lab</h2>

      {tokens.map((t, i) => (
        <div key={t.name} className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="size-5 rounded-full border border-[#0003]"
              style={{ background: css(t) }}
            />
            <span className="font-medium">{t.name}</span>
          </div>

          {(['l', 'c', 'h'] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <span className="w-3 uppercase text-[#666]">{key}</span>
              <input
                type="range"
                min={0}
                max={key === 'h' ? 360 : key === 'c' ? 0.3 : 1}
                step={key === 'h' ? 1 : key === 'c' ? 0.002 : 0.005}
                value={t[key]}
                onChange={(e) => update(i, key, Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-10 text-[#666]">
                {key === 'h' ? Math.round(t[key]) : t[key].toFixed(3)}
              </span>
            </label>
          ))}
        </div>
      ))}

      <button
        type="button"
        onClick={copy}
        className="w-full rounded-full py-2 mt-2 bg-[#222] text-[#fff]"
      >
        {copied ? 'Copied' : 'Copy palette file'}
      </button>

      <button
        type="button"
        onClick={reset}
        className="w-full rounded-full py-2 mt-2 bg-[#eee] text-[#222]"
      >
        Reset to CSS
      </button>
    </div>
  )
}