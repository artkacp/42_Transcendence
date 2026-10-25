import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getNotifications, type AppNotification } from '../api/notifications'
import { useAuth } from '../auth/auth-context'
import { Badge, Button, Card, EmptyState, toastKinds } from '../ds'
import { navigate } from '../routing'

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
]

function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit)
  }
  return 'just now'
}

export function Notifications() {
  const { status } = useAuth()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (status !== 'signed-in') return
    let cancelled = false
    getNotifications()
      .then((res) => {
        if (!cancelled) setItems(res.results)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your notifications.')
      })
    return () => {
      cancelled = true
    }
  }, [status])

  if (status === 'loading') return null

  if (status === 'signed-out') {
    return (
      <div className="p-8">
        <EmptyState
          emoji="🔒"
          title="Sign in to see your notifications"
          hint="Notifications are visible to signed-in members only."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl font-black tracking-tight">Notifications</h1>
      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger">
          {error}
        </p>
      ) : items === null ? (
        <p role="status" className="text-sm text-text-muted">Loading notifications…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const { icon, tint, label } = toastKinds[n.kind]
            return (
              <li key={n.id}>
                <Card className={`flex items-start gap-3 p-4 ${n.is_read ? '' : 'ring-1 ring-primary/40'}`}>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${tint}`} aria-hidden="true">
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${n.is_read ? 'font-medium text-text-muted' : 'font-semibold text-text'}`}>
                        {!n.is_read && <span className="sr-only">Unread: </span>}
                        {n.title}
                      </p>
                      <Badge>{label}</Badge>
                      {!n.is_read && <span className="ml-auto size-2 rounded-full bg-primary" aria-hidden="true" />}
                      <time
                        dateTime={n.created_at}
                        title={new Date(n.created_at).toLocaleString()}
                        className={`text-xs text-text-subtle ${n.is_read ? 'ml-auto' : ''}`}
                      >
                        {timeAgo(n.created_at)}
                      </time>
                    </div>
                    {n.body && <p className="mt-0.5 text-sm text-text-muted">{n.body}</p>}
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
