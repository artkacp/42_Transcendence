import { Check, UserMinus, UserPlus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  acceptFriendRequest,
  deleteFriendship,
  getFriendRequests,
  getFriends,
  rejectFriendRequest,
  searchUsers,
  sendFriendRequest,
  type FriendRecord,
  type FriendRequestRecord,
  type UserSearchResult,
} from '../api/friends'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { Avatar, Badge, Button, EmptyState, Input, Tabs, type TabItem } from '../ds'
import { useToast } from '../contexts/toast/ToastContext'
import { navigate } from '../routing'
import { useSocket } from '../socket/useSocket'

// Helpers

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

// Small shared pieces  

function OnlineDot({ online }: { online: boolean }) {
  return (
    <span
      aria-label={online ? 'online' : 'offline'}
      className={`inline-block size-2.5 rounded-full ring-2 ring-surface ${online ? 'bg-on-secondary' : 'bg-text-subtle'}`}
    />
  )
}

// Friends tab

function FriendCard({
  record,
  onRemoved,
}: {
  record: FriendRecord
  onRemoved: (id: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { friend } = record

  const remove = async () => {
    setBusy(true)
    try {
      await deleteFriendship(record.id)
      toast({ kind: 'delete', title: 'Friend removed', message: `${friend.full_name.split(' ')[0]} is no longer your friend.` })
      onRemoved(record.id)
    } catch (err) {
      toast({ title: 'Could not remove friend', message: errorText(err, 'Please try again.') })
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="relative shrink-0">
        <Avatar name={friend.full_name} src={friend.avatar} size="md" />
        <span className="absolute -right-0.5 -bottom-0.5">
          <OnlineDot online={friend.is_online} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
          onClick={() => navigate('profile', { user: friend.id })}
        >
          {friend.full_name}
        </button>
        <p className="truncate text-xs text-text-muted">@{friend.handle}</p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        icon={<UserMinus className="size-3.5" />}
        disabled={busy}
        aria-label={`Remove ${friend.full_name}`}
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
        hint="Search for people to add them as friends."
      />
    )
  }

  const online = records.filter((r) => r.friend.is_online)
  const offline = records.filter((r) => !r.friend.is_online)

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

// Requests tab

function RequestCard({
  record,
  onSettled,
}: {
  record: FriendRequestRecord
  onSettled: (id: string) => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { requester } = record

  const run = async (action: () => Promise<unknown>, title: string, message: string) => {
    setBusy(true)
    try {
      await action()
      toast({ kind: 'update', title, message })
      onSettled(record.id)
    } catch (err) {
      toast({ title: 'Could not update request', message: errorText(err, 'Please try again.') })
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="relative shrink-0">
        <Avatar name={requester.full_name} src={requester.avatar} size="md" />
        <span className="absolute -right-0.5 -bottom-0.5">
          <OnlineDot online={requester.is_online} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
          onClick={() => navigate('profile', { user: requester.id })}
        >
          {requester.full_name}
        </button>
        <p className="truncate text-xs text-text-muted">@{requester.handle}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          size="sm"
          icon={<Check className="size-3.5" />}
          disabled={busy}
          aria-label={`Accept ${requester.full_name}`}
          onClick={() =>
            void run(
              () => acceptFriendRequest(record.id),
              'Friend added',
              `You and ${requester.full_name.split(' ')[0]} are now friends.`,
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
          aria-label={`Decline ${requester.full_name}`}
          onClick={() =>
            void run(
              () => rejectFriendRequest(record.id),
              'Request declined',
              `You declined ${requester.full_name.split(' ')[0]}'s request.`,
            )
          }
        >
          Decline
        </Button>
      </div>
    </div>
  )
}

// Find people tab 

type SearchState = 'idle' | 'searching' | 'done' | 'error'

function SearchResultCard({ result, onAction }: { result: UserSearchResult; onAction: (id: string, next: UserSearchResult['friendship']) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const { friendship } = result

  const run = async (action: () => Promise<unknown>, title: string, message: string, nextFriendship: UserSearchResult['friendship']) => {
    setBusy(true)
    try {
      await action()
      toast({ kind: 'update', title, message })
      onAction(result.id, nextFriendship)
    } catch (err) {
      toast({ title: 'Could not update', message: errorText(err, 'Please try again.') })
    } finally {
      setBusy(false)
    }
  }

  let action: ReactNode

  if (!friendship) {
    action = (
      <Button
        size="sm"
        icon={<UserPlus className="size-3.5" />}
        disabled={busy}
        onClick={() =>
          void run(
            () => sendFriendRequest(result.id),
            'Request sent',
            `${result.full_name.split(' ')[0]} will see your request.`,
            { id: '', status: 'pending', requested_by_me: true },
          )
        }
      >
        Add friend
      </Button>
    )
  } else if (friendship.status === 'pending' && friendship.requested_by_me) {
    action = (
      <Button
        size="sm"
        variant="ghost"
        icon={<X className="size-3.5" />}
        disabled={busy}
        onClick={() =>
          void run(
            () => deleteFriendship(friendship.id),
            'Request withdrawn',
            `Your request to ${result.full_name.split(' ')[0]} was cancelled.`,
            null,
          )
        }
      >
        Cancel
      </Button>
    )
  } else if (friendship.status === 'pending' && !friendship.requested_by_me) {
    action = (
      <Button
        size="sm"
        icon={<Check className="size-3.5" />}
        disabled={busy}
        onClick={() =>
          void run(
            () => acceptFriendRequest(friendship.id),
            'Friend added',
            `You and ${result.full_name.split(' ')[0]} are now friends.`,
            { ...friendship, status: 'accepted' },
          )
        }
      >
        Accept
      </Button>
    )
  } else {
    action = <Badge tone="success">Friends</Badge>
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3">
      <div className="relative shrink-0">
        <Avatar name={result.full_name} src={result.avatar} size="md" />
        <span className="absolute -right-0.5 -bottom-0.5">
          <OnlineDot online={result.is_online} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="block truncate text-left font-semibold hover:text-primary focus-visible:outline-none focus-visible:underline"
          onClick={() => navigate('profile', { user: result.id })}
        >
          {result.full_name}
        </button>
        <p className="truncate text-xs text-text-muted">@{result.handle}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

function FindPeople({ myId }: { myId: string }) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [results, setResults] = useState<UserSearchResult[]>([])
  const [state, setState] = useState<SearchState>('idle')

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    if (!debouncedQ) {
      setResults([])
      setState('idle')
      return
    }
    let ignore = false
    setState('searching')
    searchUsers(debouncedQ)
      .then((res) => {
        if (ignore) return
        setResults(res.filter((u) => u.id !== myId))
        setState('done')
      })
      .catch(() => {
        if (!ignore) setState('error')
      })
    return () => {
      ignore = true
    }
  }, [debouncedQ, myId])

  const updateResult = (userId: string, next: UserSearchResult['friendship']) => {
    setResults((prev) =>
      prev.map((r) => (r.id === userId ? { ...r, friendship: next } : r)),
    )
  }

  return (
    <div className="space-y-4">
      <Input
        type="search"
        placeholder="Search by name or username…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search for people"
      />
      {state === 'idle' && (
        <p className="py-8 text-center text-sm text-text-muted">
          Start typing to find people.
        </p>
      )}
      {state === 'searching' && (
        <p className="py-8 text-center text-sm text-text-muted">Searching…</p>
      )}
      {state === 'error' && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
          Search failed. Please try again.
        </p>
      )}
      {state === 'done' && results.length === 0 && (
        <EmptyState emoji="🔍" title="No results" hint="Try a different name or handle." />
      )}
      {state === 'done' && results.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {results.map((r) => (
            <SearchResultCard key={r.id} result={r} onAction={updateResult} />
          ))}
        </div>
      )}
    </div>
  )
}

// Main view

type Tab = 'friends' | 'requests' | 'find'

export function Friends() {
  const { status, user } = useAuth()
  const [friends, setFriends] = useState<FriendRecord[] | null>(null)
  const [requests, setRequests] = useState<FriendRequestRecord[] | null>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [friendsError, setFriendsError] = useState(false)
  const [requestsError, setRequestsError] = useState(false)
  const [reload, setReload] = useState(0)

  const load = () => setReload((n) => n + 1)

  useEffect(() => {
    if (status !== 'signed-in') return
    let ignore = false

    setFriendsError(false)
    setRequestsError(false)

    getFriends()
      .then((res) => { if (!ignore) setFriends(res) })
      .catch(() => { if (!ignore) setFriendsError(true) })

    getFriendRequests()
      .then((res) => { if (!ignore) setRequests(res) })
      .catch(() => { if (!ignore) setRequestsError(true) })

    return () => { ignore = true }
  }, [status, reload])

  // Live presence updates
  useSocket(
    status === 'signed-in',
    (frame) => {
      if (frame.type !== 'presence') return
      const userId = frame.user_id as string
      const isOnline = frame.is_online as boolean
      setFriends((prev) =>
        prev
          ? prev.map((r) =>
              r.friend.id === userId ? { ...r, friend: { ...r.friend, is_online: isOnline } } : r,
            )
          : prev,
      )
    },
    load,
  )

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
  const friendsCount = friends?.length ?? 0

  const tabs: readonly TabItem<Tab>[] = [
    { id: 'friends', label: friends ? `Friends (${friendsCount})` : 'Friends' },
    { id: 'requests', label: pendingCount > 0 ? `Requests (${pendingCount})` : 'Requests' },
    { id: 'find', label: 'Find people' },
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
                emoji="📭"
                title="No pending requests"
                hint="When someone adds you, their request will appear here."
              />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {requests.map((r) => (
                  <RequestCard key={r.id} record={r} onSettled={removeFromRequests} />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'find' && <FindPeople myId={user.id} />}
      </Tabs>
    </div>
  )
}
