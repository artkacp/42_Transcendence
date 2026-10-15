import { useEffect, useState } from 'react'

/*
 * (◕◕) Routing: one index.html, the page is picked by ?view=
 * nginx only needs `try_files $uri /index.html`, every page lives at `/`.
 * Other query params (e.g. ?lab) are kept when switching views.
 */

export const VIEWS = ['browse', 'rehome', 'design', 'privacy', 'terms'] as const
export type View = (typeof VIEWS)[number]

const DEFAULT_VIEW: View = 'browse'

function isView(value: string | null): value is View {
  return (VIEWS as readonly string[]).includes(value ?? '')
}

function readView(): View {
  const value = new URLSearchParams(window.location.search).get('view')
  return isView(value) ? value : DEFAULT_VIEW
}

export function viewHref(view: View): string {
  const params = new URLSearchParams(window.location.search)
  params.set('view', view)
  return `?${params.toString()}`
}

export function navigate(view: View) {
  window.history.pushState(null, '', viewHref(view))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

// Current view; follows link clicks and the browser back/forward buttons.
export function useView(): View {
  const [view, setView] = useState(readView)
  useEffect(() => {
    const onChange = () => setView(readView())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [])
  return view
}
