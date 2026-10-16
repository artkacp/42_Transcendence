import { useEffect } from 'react'

const LIGHT = 'oklch(0.480 0.135 218)'
const DARK = 'oklch(0.945 0.092 90)'
const NOSE_FRAMES = ['ᴥ', 'ﻌ', 'ᴥ']
const NOSE_FRAME_MS = 400
const MIN_WAIT_MS = 15_000
const MAX_WAIT_MS = 40_000

function noseUrl(text: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>text{fill:${LIGHT}}@media (prefers-color-scheme:dark){text{fill:${DARK}}}</style><text x="16" y="29" text-anchor="middle" font-size="48" font-weight="bold" font-family="DejaVu Sans Mono, DejaVu Sans, monospace">${text}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function useFaviconAnimation() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!link) return

    const paw = link.href
    let timer = 0

    const wait = () => {
      const ms = MIN_WAIT_MS + Math.random() * (MAX_WAIT_MS - MIN_WAIT_MS)
      timer = window.setTimeout(() => showNose(0), ms)
    }

    const showNose = (i: number) => {
      if (i === NOSE_FRAMES.length) {
        link.href = paw
        wait()
        return
      }
      link.href = noseUrl(NOSE_FRAMES[i])
      timer = window.setTimeout(() => showNose(i + 1), NOSE_FRAME_MS)
    }

    wait()
    return () => {
      window.clearTimeout(timer)
      link.href = paw
    }
  }, [])
}
