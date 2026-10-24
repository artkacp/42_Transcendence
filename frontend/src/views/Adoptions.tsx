import { useEffect, useState } from 'react'
import { ApiError } from '../api/client'
import { getMyInquiries } from '../api/inquiries'
import { useAuth } from '../auth/auth-context'
import type { Inquiry, InquiryMessage, InquiryStage, Pet } from '../data/types'
import { Avatar, Badge, Button, Card, EmptyState } from '../ds'
import { navigate } from '../routing'

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
        <span className="text-2xl" aria-hidden>
          {pet.species === 'dog' ? '🐕' : '🐈'}
        </span>
      )}
    </div>
  )
}

function LastMessage({ message }: { message: InquiryMessage | null }) {
  if (!message) return <span className="text-text-subtle">No messages yet</span>

  // body is only empty when the message carries a file
  const clip = message.attachments.length > 0 ? '📎 ' : ''
  const text = clip + (message.body || 'Attachment')
  return (
    <p className="max-w-64 truncate text-text-muted" title={text}>
      {text}
    </p>
  )
}

interface StatusBadgeProps {
  pet: Pet
  stage: InquiryStage
  meId?: string
}

function StatusBadge({ pet, stage, meId }: StatusBadgeProps) {
  if (pet.adopted_by && pet.adopted_by.id === meId) {
    return <Badge tone="success">adopted ︶ᴥ₍^◕◕^₎･ﾟ✧ by You</Badge>
  }
  if (pet.adopted_by) {
    return <Badge tone="neutral">already adopted ︶ᴥ－－).｡O</Badge>
  }
  const { label, tone } = STAGE_BADGES[stage]
  return <Badge tone={tone}>{label}</Badge>
}

interface AdoptionsTableProps {
  inquiries: Inquiry[]
  meId?: string
}

function AdoptionsTable({ inquiries, meId }: AdoptionsTableProps) {
  return (
    <Card className="overflow-x-auto">
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
          {inquiries.map(({ id, pet, stage, last_message }) => (
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
                <StatusBadge pet={pet} stage={stage} meId={meId} />
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled
                    title="Opens with the pet page"
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
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getMyInquiries()
      .then((data) => {
        if (!cancelled) setInquiries(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your adoptions.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="font-display text-4xl font-black tracking-tight">Your adoptions</h1>
        <p className="mt-1 text-sm text-text-muted">Pets you asked about, latest conversation first.</p>
      </div>

      {error ? (
        <EmptyState emoji="😿" title="Something went wrong" hint={error} />
      ) : inquiries === null ? (
        <p role="status" className="text-sm text-text-muted">Loading your adoptions…</p>
      ) : inquiries.length === 0 ? (
        <EmptyState
          emoji="🐾"
          title="No adoptions yet"
          hint="Find a pet in Browse and start a conversation with its owner."
          action={<Button onClick={() => navigate('browse')}>Browse pets</Button>}
        />
      ) : (
        <AdoptionsTable inquiries={inquiries} meId={meId} />
      )}
    </div>
  )
}

export function Adoptions() {
  const { status, user } = useAuth()

  if (status === 'loading') return null

  if (status === 'signed-out') {
    return (
      <div className="p-8">
        <EmptyState
          emoji="🔒"
          title="Sign in to see your adoptions"
          hint="Your conversations with pet owners live behind your account."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return <YourAdoptions key={user?.id} meId={user?.id} />
}
