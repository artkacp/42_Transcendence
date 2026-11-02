import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getMyInquiries } from '../api/inquiries'
import { useAuth } from '../auth/auth-context'
import type { Inquiry, InquiryMessage, InquiryStage, Pet } from '../data/types'
import { Avatar, Badge, Button, Card, EmptyState } from '../ds'
import { navigate } from '../routing'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'

// pet.adopted carries only the adopter's id, so a row keeps that id
// (taken from pet.adopted_by on load) and the badge reads it from there
type Row = Inquiry & { adoptedById: string | null }

const toRow = (inquiry: Inquiry): Row => ({ ...inquiry, adoptedById: inquiry.pet.adopted_by?.id ?? null })

// Changes only the matching rows. No match → the same array, so React skips the re-render
function updateRows(rows: Row[], matches: (row: Row) => boolean, change: (row: Row) => Row): Row[] {
  let changed = false
  const next = rows.map((row) => {
    if (!matches(row)) return row
    changed = true
    return change(row)
  })
  return changed ? next : rows
}

// Badge for a pet that is not adopted yet: mirrors the stage the owner set
const STAGE_BADGES = {
  conversation: { label: 'in conversation', tone: 'neutral' },
  visit: { label: 'visit scheduled', tone: 'warning' },
  decision: { label: 'final decision', tone: 'warning' },
  denied: { label: 'denied', tone: 'danger' },
} as const

function PetThumb({ pet }: { pet: Pet }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
      {pet.photo ? (
        <img src={pet.photo} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="text-[11px] whitespace-nowrap" aria-hidden>
          {pet.species === 'dog' ? 'U・ᴥ・U' : '=^ ◗ ◗^='}
        </span>
      )}
    </div>
  )
}

function LastMessage({ message }: { message: InquiryMessage | null }) {
  if (!message) return <span className="text-text-subtle">No messages yet</span>

  // body is only empty when the message carries a file
  const clip = message.attachments.length > 0 ? '╰●╮ ≡◕◕) ' : ''
  const text = clip + (message.body || 'Attachment')
  return (
    <p className="max-w-64 truncate text-text-muted" title={text}>
      {text}
    </p>
  )
}

interface StatusBadgeProps {
  adoptedById: string | null
  stage: InquiryStage
  meId?: string
}

function StatusBadge({ adoptedById, stage, meId }: StatusBadgeProps) {
  if (adoptedById && adoptedById === meId) {
    return <Badge tone="success" className="whitespace-nowrap">adopted ︶ᴥ₍^◕◕^₎･ﾟ✧ by You</Badge>
  }
  if (adoptedById) {
    return <Badge tone="neutral">already adopted ︶ᴥ－－).｡O</Badge>
  }
  const { label, tone } = STAGE_BADGES[stage]
  return <Badge tone={tone}>{label}</Badge>
}

interface AdoptionsTableProps {
  rows: Row[]
  meId?: string
}

// below sm: one card per conversation instead of a sideways-scrolling table
function AdoptionsCards({ rows, meId }: AdoptionsTableProps) {
  return (
    <ul className="space-y-3 sm:hidden">
      {rows.map(({ id, pet, stage, last_message, adoptedById }) => (
        <li key={id}>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <PetThumb pet={pet} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text">{pet.name}</p>
                <div className="flex min-w-0 items-center gap-2 text-sm">
                  <Avatar src={pet.owner.avatar} name={pet.owner.full_name} size="sm" online={pet.owner.is_online} />
                  <span className="truncate text-text">{pet.owner.full_name}</span>
                </div>
              </div>
            </div>
            <div className="text-sm [&>p]:max-w-full">
              <LastMessage message={last_message} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge adoptedById={adoptedById} stage={stage} meId={meId} />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => navigate('pet', { id: pet.id })}
                aria-label={`Open ${pet.name}`}
              >
                Open
              </Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function AdoptionsTable({ rows, meId }: AdoptionsTableProps) {
  return (
    <Card className="relative hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Pet</th>
            <th scope="col" className="px-5 py-3 font-medium">Last message</th>
            <th scope="col" className="px-5 py-3 font-medium">Owner</th>
            <th scope="col" className="px-5 py-3 font-medium">Status</th>
            <th scope="col" className="px-5 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(({ id, pet, stage, last_message, adoptedById }) => (
            <tr key={id}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <PetThumb pet={pet} />
                  <span className="font-semibold text-text">{pet.name}</span>
                </div>
              </td>
              <td className="px-5 py-3">
                <LastMessage message={last_message} />
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <Avatar src={pet.owner.avatar} name={pet.owner.full_name} size="sm" online={pet.owner.is_online} />
                  <span className="text-text">{pet.owner.full_name}</span>
                </div>
              </td>
              <td className="px-5 py-3">
                <StatusBadge adoptedById={adoptedById} stage={stage} meId={meId} />
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate('pet', { id: pet.id })}
                    aria-label={`Open ${pet.name}`}
                  >
                    Open
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function YourAdoptions({ meId }: { meId?: string }) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMyInquiries()
      .then((data) => {
        if (cancelled) return
        setRows(data.map(toRow))
        setError('')
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your adoptions.')
      })
    return () => {
      cancelled = true
    }
  }, [reloads])

  // frames sent while the socket was down are lost: load the whole list again
  useSocketReconnect(() => setReloads((n) => n + 1))

  useSocketFrame('inquiry.stage_changed', ({ inquiry_id, stage }) =>
    setRows(
      (prev) =>
        prev &&
        updateRows(
          prev,
          (r) => r.id === inquiry_id && r.stage !== stage,
          (r) => ({ ...r, stage }),
        ),
    ),
  )

  // a new message is the newest one, so its row goes first: the backend's newest_first() order
  useSocketFrame('chat.message', ({ message }) =>
    setRows((prev) => {
      const row = prev?.find((r) => r.id === message.inquiry)
      if (!prev || !row || row.last_message?.id === message.id) return prev
      const updated = { ...row, last_message: message, last_message_at: message.created_at }
      return [updated, ...prev.filter((r) => r !== row)]
    }),
  )

  // can arrive twice (browse + pet.<id>); the second one matches no row and changes nothing
  useSocketFrame('pet.adopted', ({ pet_id, adopted_by_id }) =>
    setRows(
      (prev) =>
        prev &&
        updateRows(
          prev,
          (r) => r.pet.id === pet_id && r.adoptedById !== adopted_by_id,
          (r) => ({ ...r, adoptedById: adopted_by_id }),
        ),
    ),
  )

  useSocketFrame('pet.removed', ({ pet_id }) =>
    setRows((prev) => (prev?.some((r) => r.pet.id === pet_id) ? prev.filter((r) => r.pet.id !== pet_id) : prev)),
  )

  useSocketFrame('presence.changed', ({ user_id, online }) =>
    setRows(
      (prev) =>
        prev &&
        updateRows(
          prev,
          (r) => r.pet.owner.id === user_id && r.pet.owner.is_online !== online,
          (r) => ({ ...r, pet: { ...r.pet, owner: { ...r.pet.owner, is_online: online } } }),
        ),
    ),
  )

  return (
    <div className="space-y-6 sm:p-8">
      <div>
        <h1 className="font-display text-4xl font-black tracking-tight">Your adoptions</h1>
        <p className="mt-1 text-sm text-text-muted">Pets you asked about, latest conversation first.</p>
      </div>

      {error ? (
        <EmptyState emoji="≧◒_◒≦" title="Something went wrong" hint={error} />
      ) : rows === null ? (
        <p role="status" className="text-sm text-text-muted">Loading your adoptions…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="┐(︶▼︶)┌" className="[&>span]:font-black [&>span]:[-webkit-text-stroke:1.5px_currentColor]"
          title="No adoptions yet"
          hint="Find a pet in Browse and start a conversation with its owner."
          action={<Button onClick={() => navigate('browse')}>Browse pets</Button>}
        />
      ) : (
        <>
          <AdoptionsCards rows={rows} meId={meId} />
          <AdoptionsTable rows={rows} meId={meId} />
        </>
      )}
    </div>
  )
}

export function Adoptions() {
  const { status, user } = useAuth()

  if (status === 'loading') return null

  if (status === 'signed-out') {
    return (
      <div className="sm:p-8">
        <EmptyState
          emoji="(︶ᴥ .  .   .   .     ╰ᐢ◕ ◕ᐢ╮"
          title="Sign in to see your adoptions"
          hint="Your conversations with pet owners live behind your account."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return <YourAdoptions key={user?.id} meId={user?.id} />
}
