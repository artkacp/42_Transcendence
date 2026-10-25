import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getNotifications, type AppNotification } from '../api/notifications'
import { useAuth } from '../auth/auth-context'
import { Button, EmptyState } from '../ds'
import { navigate } from '../routing'

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
          {items.map((n) => (
            <li key={n.id}>{n.title}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
