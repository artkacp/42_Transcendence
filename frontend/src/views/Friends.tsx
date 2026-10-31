import { Check, UserMinus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  acceptFriendRequest,
  deleteFriendship,
  getFriendRequests,
  getFriends,
  type FriendRecord,
  type FriendRequestRecord,
} from '../api/friends'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { Avatar, Button, EmptyState, Tabs, type TabItem } from '../ds'
import { useToast } from '../contexts/toast/ToastContext'
import { navigate } from '../routing'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'

//  helpers 

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

//  Friends tab

function FriendCard({
  record,
  onRemoved,
}: {
  record: FriendRecord
  onRemoved: (id: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { other_user } = record

  const remove = async () => {
    setBusy(true)
    try {
      await deleteFriendship(record.id)
      toast({ kind: 'delete', title: 'Friend removed', message: `${other_user.full_name.split(' ')[0]} is no longer your friend.` })
      onRemoved(record.id)
    } catch (err) {
      toast({ title: 'Could not remove friend', message: errorText(err, 'Please try again.') })
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <Avatar name={other_user.full_name} src={other_user.avatar} size="md" online={other_user.is_online} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
          onClick={() => navigate('profile', { user: other_user.id })}
        >
          {other_user.full_name}
        </button>
        <p className="truncate text-xs text-text-muted">@{other_user.handle}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<UserMinus className="size-3.5" />}
        disabled={busy}
        aria-label={`Remove ${other_user.full_name}`}
        onClick={() => void remove()}
      >
        Remove
      </Button>
    </div>
  )
}

function FriendsList({
  records,
  onRemoved,
}: {
  records: FriendRecord[]
  onRemoved: (id: string) => void
}) {
  if (records.length === 0) {
    return (
      <EmptyState
        emoji="🐾"
        title="No friends yet"
        hint="Go to someone's profile and add them as a friend."
      />
    )
  }

  const online = records.filter((r) => r.other_user.is_online)
  const offline = records.filter((r) => !r.other_user.is_online)

  return (
    <div className="space-y-4">
      {online.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Online — {online.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {online.map((r) => (
              <FriendCard key={r.id} record={r} onRemoved={onRemoved} />
            ))}
          </div>
        </section>
      )}
      {offline.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Offline — {offline.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {offline.map((r) => (
              <FriendCard key={r.id} record={r} onRemoved={onRemoved} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

//  Requests tab ─

function RequestCard({
  record,
  onSettled,
  onAccepted,
}: {
  record: FriendRequestRecord
  onSettled: (id: string) => void
  onAccepted: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { other_user } = record

  const run = async (
    action: () => Promise<unknown>,
    title: string,
    message: string,
    accepted: boolean,
  ) => {
    setBusy(true)
    try {
      await action()
      toast({ kind: 'update', title, message })
      onSettled(record.id)
      if (accepted) onAccepted()
    } catch (err) {
      toast({ title: 'Could not update request', message: errorText(err, 'Please try again.') })
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <Avatar name={other_user.full_name} src={other_user.avatar} size="md" online={other_user.is_online} />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
          onClick={() => navigate('profile', { user: other_user.id })}
        >
          {other_user.full_name}
        </button>
        <p className="truncate text-xs text-text-muted">@{other_user.handle}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="sm"
          icon={<Check className="size-3.5" />}
          disabled={busy}
          aria-label={`Accept ${other_user.full_name}`}
          onClick={() =>
            void run(
              () => acceptFriendRequest(record.id),
              'Friend added',
              `You and ${other_user.full_name.split(' ')[0]} are now friends.`,
              true,
            )
          }
        >
          Accept
        </Button>
        <Button
          size="sm"
          variant="ghost"
          icon={<X className="size-3.5" />}
          disabled={busy}
          aria-label={`Decline ${other_user.full_name}`}
          onClick={() =>
            void run(
              () => deleteFriendship(record.id),
              'Request declined',
              `You declined ${other_user.full_name.split(' ')[0]}'s request.`,
              false,
            )
          }
        >
          Decline
        </Button>
      </div>
    </div>
  )
}

//  root view 

type Tab = 'friends' | 'requests'

export function Friends() {
  const { status, user } = useAuth()
  const [friends, setFriends] = useState<FriendRecord[] | null>(null)
  const [requests, setRequests] = useState<FriendRequestRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [friendsError, setFriendsError] = useState(false)
  const [requestsError, setRequestsError] = useState(false)
  const [reload, setReload] = useState(0)

  const load = () => {
    setFriendsError(false)
    setRequestsError(false)
    setReload((n) => n + 1)
  }

  useEffect(() => {
    if (status !== 'signed-in') return
    let ignore = false

    getFriends()
      .then((res) => { if (!ignore) setFriends(res) })
      .catch(() => { if (!ignore) setFriendsError(true) })

    getFriendRequests()
      .then((res) => { if (!ignore) setRequests(res) })
      .catch(() => { if (!ignore) setRequestsError(true) })

    return () => { ignore = true }
  }, [status, reload])

  // Live incoming requests
  useSocketFrame('notification.created', (frame) => {
    if (frame.notification.subject_type === 'user') load()
  })

  // Live presence updates
  useSocketFrame('presence.changed', (frame) => {
    setFriends((prev) =>
      prev
        ? prev.map((r) =>
            r.other_user.id === frame.user_id
              ? { ...r, other_user: { ...r.other_user, is_online: frame.online } }
              : r,
          )
        : prev,
    )
  })

  // Refetch after reconnect — frames sent while offline were missed
  useSocketReconnect(load)

  if (status === 'loading') return null

  if (status === 'signed-out' || !user) {
    return (
      <div className="p-8">
        <EmptyState
          emoji="(︶ᴥ ...   ･ﾟ✧"
          title="Sign in to see your friends"
          hint="Friends are visible to signed-in members only."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  const pendingCount = requests?.length ?? 0

  const tabs: readonly TabItem<Tab>[] = [
    { id: 'friends', label: friends ? `Friends (${friends.length})` : 'Friends' },
    { id: 'requests', label: pendingCount > 0 ? `Requests (${pendingCount})` : 'Requests' },
  ]

  const removeFromFriends = (id: string) =>
    setFriends((prev) => prev?.filter((r) => r.id !== id) ?? prev)

  const removeFromRequests = (id: string) =>
    setRequests((prev) => prev?.filter((r) => r.id !== id) ?? prev)

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-4xl font-black tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-text-muted">People you know on Pawfect.</p>
      </div>

      <Tabs items={tabs} value={tab} onChange={(id) => setTab(id)} label="Friends navigation">
        {tab === 'friends' && (
          <>
            {friendsError ? (
              <EmptyState
                emoji="😿"
                title="Couldn't load friends"
                hint="Something went wrong. Try again in a moment."
                action={<Button variant="secondary" onClick={load}>Retry</Button>}
              />
            ) : friends === null ? (
              <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
            ) : (
              <FriendsList records={friends} onRemoved={removeFromFriends} />
            )}
          </>
        )}

        {tab === 'requests' && (
          <>
            {requestsError ? (
              <EmptyState
                emoji="😿"
                title="Couldn't load requests"
                hint="Something went wrong. Try again in a moment."
                action={<Button variant="secondary" onClick={load}>Retry</Button>}
              />
            ) : requests === null ? (
              <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
            ) : requests.length === 0 ? (
              <EmptyState
                emoji="◣◥ ･ﾟ"
                title="No pending requests"
                hint="When someone adds you, their request will appear here."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {requests.map((r) => (
                  <RequestCard
                    key={r.id}
                    record={r}
                    onSettled={removeFromRequests}
                    onAccepted={load}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
