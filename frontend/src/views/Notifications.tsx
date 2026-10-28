import { useEffect, useState } from 'react'
import { CheckCheck, Trash2 } from 'lucide-react'
import { ApiError } from '../api/client'
import { clearNotifications, getNotifications, markAllRead } from '../api/notifications'
import type { AppNotification } from '../data/types'
import { useAuth } from '../auth/auth-context'
import { useToast } from '../contexts/toast/ToastContext'
import { Badge, Button, Card, EmptyState, toastKinds } from '../ds'
import { navigate } from '../routing'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'

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
  const { status, updateUser } = useAuth()
  const toast = useToast()
  const [items, setItems] = useState<AppNotification[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [nextPage, setNextPage] = useState<number | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (status !== 'signed-in') return
    let cancelled = false
    getNotifications()
      .then((res) => {
        if (cancelled) return
        setItems(res.results)
        setNextPage(res.next ? 2 : null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your notifications.')
      })
    return () => {
      cancelled = true
    }
  }, [status, reload])

  useSocketFrame('notification.created', ({ notification }) => {
    setItems((prev) => (prev && !prev.some((n) => n.id === notification.id) ? [notification, ...prev] : prev))
  })

  useSocketReconnect(() => setReload((n) => n + 1))

  const run = async (request: () => Promise<unknown>, apply: (list: AppNotification[]) => AppNotification[], failure: string) => {
    setBusy(true)
    try {
      await request()
      setItems((prev) => (prev ? apply(prev) : prev))
      updateUser((u) => u && { ...u, unread_notifications: 0 })
      return true
    } catch (err) {
      toast({ title: failure, message: err instanceof ApiError ? err.message : 'Please try again.' })
      return false
    } finally {
      setBusy(false)
    }
  }

  const loadMore = async () => {
    if (!nextPage) return
    setBusy(true)
    try {
      const res = await getNotifications(nextPage)
      setItems((prev) => {
        const seen = new Set(prev?.map((n) => n.id))
        return [...(prev ?? []), ...res.results.filter((n) => !seen.has(n.id))]
      })
      setNextPage(res.next ? nextPage + 1 : null)
    } catch (err) {
      toast({ title: 'Could not load more notifications', message: err instanceof ApiError ? err.message : 'Please try again.' })
    } finally {
      setBusy(false)
    }
  }

  const hasUnread = items?.some((n) => !n.is_read) ?? false

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-black tracking-tight">Notifications</h1>
        {items && items.length > 0 && (
          <div className="flex gap-2">
            {hasUnread && (
              <Button
                size="sm"
                variant="ghost"
                icon={<CheckCheck className="size-4" />}
                disabled={busy}
                onClick={() => void run(markAllRead, (list) => list.map((n) => ({ ...n, is_read: true })), 'Could not mark as read')}
              >
                Mark all read
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              icon={<Trash2 className="size-4" />}
              disabled={busy}
              onClick={() => void run(clearNotifications, () => [], 'Could not clear notifications').then((ok) => ok && setNextPage(null))}
            >
              Clear all
            </Button>
          </div>
        )}
      </div>
      {error ? (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger">
          {error}
        </p>
      ) : items === null ? (
        <p role="status" className="text-sm text-text-muted">Loading notifications…</p>
      ) : items.length === 0 ? (
        <EmptyState emoji="︶ᴥ︶ .｡O" title="No notifications yet" hint="Updates about your pets, friends and adoptions show up here." />
      ) : (
        <>
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
          {nextPage && (
            <div className="flex justify-center">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void loadMore()}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
