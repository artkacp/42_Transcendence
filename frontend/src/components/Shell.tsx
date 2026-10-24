import { useEffect, useState, type MouseEvent, type ReactNode } from 'react'
import { HeartHandshake, Search, SwatchBook } from 'lucide-react'
import { navigate, viewHref, type View } from '../routing'
import { useFaviconAnimation } from '../hooks/useFaviconAnimation'

/*
 * (◕◕) Shell — layout from the prototype, colours from our roles.
 *   desktop (lg+): sidebar on the left, page on the right
 *   mobile:        top bar + bottom nav
 * Footer links are a subject requirement (III.2): Privacy Policy and
 * Terms of Service must be reachable from anywhere in the app.
 *
 * Add a NAV item only when its view exists, so there are no dead links.
 * Notifications bell and the "me" card come with auth (F0/F1).
 */

const NAV: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'browse', label: 'Browse', icon: <Search className="size-[18px]" /> },
  { view: 'adoptions', label: 'Adoptions', icon: <HeartHandshake className="size-[18px]" /> },
  { view: 'design', label: 'Design kit', icon: <SwatchBook className="size-[18px]" /> },
]
// A real <a href> keeps middle-click / open-in-new-tab working;
// a plain left click switches the view without a page reload.
function Link({ view, className, children, glow = false, ...rest }: {
  view: View
  className: string
  children: ReactNode
  glow?: boolean
  'aria-current'?: 'page'
  'aria-label'?: string
}) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate(view)
  }
  // glow = Ghost button focus; default = thin flush outline
  const focus = glow
    ? 'focus-visible:outline-none focus-gradient'
    : 'focus-visible:outline-1 focus-visible:outline-text focus-visible:outline-offset-0'
  return (
    <a
      href={viewHref(view)}
      onClick={onClick}
      className={`${focus} ${className}`}
      {...rest}
    >
      {children}
    </a>
  )
}

const LOGO_FRAMES = [
  '(︶ᴥ₍ᐢ◑ ◑ᐢ₎)',
  '(︶ᴥ₍ᐢ◐ ◐ᐢ₎)',
  '(︶ᴥ₍ᐢ◐ ◐ᐢ₎)',
  '(︶ᴥ₍ᐢ◐ ◐ᐢ₎)',
  '(︶ᴥ₍ᐢ◑ ◑ᐢ₎)',
  '(︶ᴥ₍ᐢ◑ ◑ᐢ₎)',
]
const FRAME_MS = 500

function useLogoFrame() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % LOGO_FRAMES.length), FRAME_MS)
    return () => clearInterval(id)
  }, [])

  return LOGO_FRAMES[index]
}

function Logo({ small = false }: { small?: boolean }) {
  const frame = useLogoFrame()
  return (
    <Link
      view="browse"
      glow
      className="flex items-center gap-1 rounded-2xl px-3 py-1.5 [--focus-color:var(--color-terra-100)] [--focus-inner:var(--color-terra-100)] [--focus-edge:0px]"
    >
      <span aria-hidden="true" className={`font-logo font-bold whitespace-nowrap text-primary ${small ? 'text-lg' : 'text-xl'}`}>
        {frame}
      </span>
      <span className={`font-display font-bold tracking-tight text-text ${small ? 'text-lg' : 'text-xl'}`}>
        Pawfect
      </span>
    </Link>
  )
}

export function Shell({ view, children }: { view: View; children: ReactNode }) {
  useFaviconAnimation()
  return (
        <div className="min-h-dvh lg:grid lg:grid-cols-[288px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-border bg-surface-raised/60 px-4 py-6 lg:flex">
        <div className="mb-6">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.view}
              view={n.view}
              aria-current={view === n.view ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                view === n.view
                  ? 'bg-surface text-text shadow-sm'
                  : 'text-text-muted hover:bg-surface/60 hover:text-text'
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Top bar (mobile only: logo). Hidden on lg+ — it was an empty strip there.
            Bring it back for desktop when bell / avatar arrive. */}
        <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <Logo small />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-10 lg:px-8">{children}</main>

        <footer className="border-t border-border px-4 pt-4 pb-24 lg:px-8 lg:pb-4">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
            <span>© 2026 Pawfect Match · 42 Warsaw</span>
            <nav aria-label="Legal" className="flex gap-7">
              <Link
                view="privacy"
                aria-current={view === 'privacy' ? 'page' : undefined}
                className={`${view === 'privacy' ? 'text-primary' : 'hover:text-text'} rounded-sm px-2.5 -mx-2.5`}
              >
                Privacy Policy
              </Link>
              <Link
                view="terms"
                aria-current={view === 'terms' ? 'page' : undefined}
                className={`${view === 'terms' ? 'text-primary' : 'hover:text-text'} rounded-sm px-2.5 -mx-2.5`}
              >
                Terms of Service
              </Link>
            </nav>
          </div>
        </footer>

        {/* Bottom nav (mobile) */}
        <nav
          aria-label="Main"
          className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-border bg-surface/95 px-2 py-2 backdrop-blur lg:hidden"
        >
          {NAV.slice(0, 5).map((n) => (
            <Link
              key={n.view}
              view={n.view}
              aria-label={n.label}
              aria-current={view === n.view ? 'page' : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-medium transition-all ${
                view === n.view ? 'text-primary' : 'text-text-subtle'
              }`}
            >
              {n.icon}
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
