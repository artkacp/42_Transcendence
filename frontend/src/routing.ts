import { useEffect, useState } from 'react'
/*
 * (◕◕) Routing: one index.html, the page is picked by ?view=
 * nginx only needs `try_files $uri /index.html`, every page lives at `/`.
 * Other query params (e.g. ?lab) are kept when switching views.
 */

export const VIEWS = ['auth', 'browse', 'pet', 'adoptions', 'rehome', 'profile', 'friends', 'design', 'privacy', 'terms', 'notifications'] as const
export type View = (typeof VIEWS)[number]

const DEFAULT_VIEW: View = 'browse'

// Params that belong to one page (e.g. ?view=profile&user=<id>); dropped on every view switch
type PageParams = { user?: string; id?: string }
const PAGE_PARAMS = ['user', 'id']

function isView(value: string | null): value is View {
  return (VIEWS as readonly string[]).includes(value ?? '')
}

function readView(): View {
  const value = new URLSearchParams(window.location.search).get('view')
  return isView(value) ? value : DEFAULT_VIEW
}

export function viewHref(view: View, pageParams: PageParams = {}): string {
  const params = new URLSearchParams(window.location.search)
  PAGE_PARAMS.forEach((name) => params.delete(name))
  params.set('view', view)
  for (const [name, value] of Object.entries(pageParams)) params.set(name, value)
  return `?${params.toString()}`
}

export function navigate(view: View, pageParams: PageParams = {}) {
  window.history.pushState(null, '', viewHref(view, pageParams))
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function usePopState<T>(read: () => T): T {
  const [value, setValue] = useState(read)
  useEffect(() => {
    const onChange = () => setValue(read())
    window.addEventListener('popstate', onChange)
    return () => window.removeEventListener('popstate', onChange)
  }, [read])
  return value
}

const readUserParam = () => new URLSearchParams(window.location.search).get('user')

// Current view; follows link clicks and the browser back/forward buttons.
export function useView(): View {
  return usePopState(readView)
}

// ?user=<id> of the profile page, or null for your own profile
export function useUserParam(): string | null {
  return usePopState(readUserParam)
}

const readIdParam = () => new URLSearchParams(window.location.search).get('id')

// ?id=<pet id> of the pet page
export function useIdParam(): string | null {
  return usePopState(readIdParam)
}
