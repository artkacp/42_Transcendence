import { Check, UserMinus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  acceptFriendRequest,
  deleteFriendship,
  getFriendRequests,
  getFriends,
  type FriendRecord,
  type FriendRequestRecord,
} from '../api/friends'
import { ApiError } from '../api/client'
import { getUsers } from '../api/users'
import { useAuth } from '../auth/auth-context'
import type { User, UserProfile } from '../data/types'
import { Avatar, Button, EmptyState, Input, Tabs, type TabItem } from '../ds'
import { useToast } from '../contexts/toast/ToastContext'
import { navigate } from '../routing'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'
import { FriendAction } from './Profile'

//  helpers 

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

// flex-wrap: on a narrow card the buttons drop to their own line instead of overflowing
function PersonCard({ user, children }: { user: User; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <Avatar name={user.full_name} src={user.avatar} size="md" online={user.is_online} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="block max-w-full truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
            onClick={() => navigate('profile', { user: user.id })}
          >
            {user.full_name}
          </button>
          <p className="truncate text-xs text-text-muted">@{user.handle}</p>
        </div>
      </div>
      <div className="ml-auto flex shrink-0 gap-1.5">{children}</div>
    </div>
  )
}

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
    <PersonCard user={other_user}>
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
    </PersonCard>
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
        hint="Head to Discover to find people on Pawfect."
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
    <PersonCard user={other_user}>
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
    </PersonCard>
  )
}

//  Discover tab

// Accent-insensitive, so "hernandez" finds "Hernández"
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

function DiscoverList({ users, onChanged }: { users: UserProfile[]; onChanged: () => void }) {
  const [query, setQuery] = useState('')

  if (users.length === 0) {
    return (
      <EmptyState
        emoji="🌟"
        title="Nobody else here yet"
        hint="New members will show up here."
      />
    )
  }

  const term = normalize(query.trim())
  const matches = users.filter((u) => normalize(`${u.full_name} ${u.handle}`).includes(term))

  return (
    <div className="space-y-4">
      <Input
        aria-label="Search people"
        placeholder="Search by name or handle…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? (
        <EmptyState
          emoji="🔍"
          title="No one matches that search"
          hint="Try a different name or handle."
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {matches.map((u) => (
            <PersonCard key={u.id} user={u}>
              <FriendAction user={u} onChanged={onChanged} size="sm" />
            </PersonCard>
          ))}
        </div>
      )}
    </div>
  )
}

//  root view 

type Tab = 'friends' | 'requests' | 'discover'

export function Friends() {
  const { status, user } = useAuth()
  const [friends, setFriends] = useState<FriendRecord[] | null>(null)
  const [requests, setRequests] = useState<FriendRequestRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [users, setUsers] = useState<UserProfile[] | null>(null)
  const [friendsError, setFriendsError] = useState(false)
  const [requestsError, setRequestsError] = useState(false)
  const [usersError, setUsersError] = useState(false)
  const [reload, setReload] = useState(0)

  const load = () => {
    setFriendsError(false)
    setRequestsError(false)
    setUsersError(false)
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

  useEffect(() => {
    if (status !== 'signed-in' || tab !== 'discover') return
    let ignore = false

    getUsers()
      .then((res) => {
        if (ignore) return
        setUsers(res)
        setUsersError(false)
      })
      .catch(() => { if (!ignore) setUsersError(true) })

    return () => { ignore = true }
  }, [status, reload, tab])

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
    setUsers((prev) =>
      prev?.map((u) => (u.id === frame.user_id ? { ...u, is_online: frame.online } : u)) ?? prev,
    )
  })

  // Refetch after reconnect — frames sent while offline were missed
  useSocketReconnect(load)

  if (status === 'loading') return null

  if (status === 'signed-out' || !user) {
    return (
      <div className="p-8">
        <EmptyState
          emoji="🔒"
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
    { id: 'discover', label: 'Discover' },
  ]

  const removeFromFriends = (id: string) =>
    setFriends((prev) => prev?.filter((r) => r.id !== id) ?? prev)

  const removeFromRequests = (id: string) =>
    setRequests((prev) => prev?.filter((r) => r.id !== id) ?? prev)

  return (
    <div className="space-y-6 sm:p-8">
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
                emoji="📭"
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

        {tab === 'discover' && (
          <>
            {usersError ? (
              <EmptyState
                emoji="😿"
                title="Couldn't load people"
                hint="Something went wrong. Try again in a moment."
                action={<Button variant="secondary" onClick={load}>Retry</Button>}
              />
            ) : users === null ? (
              <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
            ) : (
              <DiscoverList users={users} onChanged={load} />
            )}
          </>
        )}
      </Tabs>
    </div>
  )
}
