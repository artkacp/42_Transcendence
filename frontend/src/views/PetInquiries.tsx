// src/views/PetInquiries.tsx
// F3b · the owner's side of the pet page: the inquiries for this pet, and the chat of the one picked.
import { useEffect, useState } from 'react'
import { getPetInquiries } from '../api/inquiries'
import type { Inquiry, InquiryMessage } from '../data/types'
import { Avatar, Card } from '../ds'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'
import { PetChat } from './PetChat'

type Result = { petId: string; inquiries: Inquiry[] } | { petId: string; error: string }

// One short line, no emoji: the body, or the file name when the message only carries a file
function Preview({ message }: { message: InquiryMessage | null }) {
  if (!message) return <span className="text-text-subtle">No messages yet</span>

  const file = message.attachments[0]
  const text = !file ? message.body : message.body ? `${message.body} · file` : `File: ${file.original_name}`
  return (
    <span className="block truncate text-text-muted" title={text}>
      {text}
    </span>
  )
}

export function PetInquiries({ petId }: { petId: string }) {
  const [result, setResult] = useState<Result | null>(null)
  const [reload, setReload] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getPetInquiries(petId)
      .then((inquiries) => {
        if (!cancelled) setResult({ petId, inquiries })
      })
      .catch(() => {
        if (!cancelled) setResult({ petId, error: 'Could not load the inquiries' })
      })
    return () => {
      cancelled = true
    }
  }, [petId, reload])

  // a new adopter asked about this pet: put it on top
  useSocketFrame('inquiry.created', ({ inquiry }) => {
    if (inquiry.pet.id !== petId) return
    setResult((r) => {
      if (!r || 'error' in r || r.petId !== petId || r.inquiries.some((i) => i.id === inquiry.id)) return r
      return { ...r, inquiries: [inquiry, ...r.inquiries] }
    })
  })

  // keeps each row's preview current
  useSocketFrame('chat.message', ({ message }) => {
    setResult((r) => {
      if (!r || 'error' in r || !r.inquiries.some((i) => i.id === message.inquiry)) return r
      const inquiries = r.inquiries.map((i) =>
        i.id === message.inquiry ? { ...i, last_message: message, last_message_at: message.created_at } : i,
      )
      return { ...r, inquiries }
    })
  })

  useSocketReconnect(() => setReload((n) => n + 1))

  // derived, not stored: an answer for another pet means we are still loading
  const ready = result && result.petId === petId ? result : null
  const selected = ready && 'inquiries' in ready ? ready.inquiries.find((i) => i.id === selectedId) : undefined

  return (
    <section aria-labelledby="pet-inquiries" className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-5">
        <h2 id="pet-inquiries" className="font-display text-lg font-bold text-text">
          Inquiries
        </h2>

        {!ready ? (
          <p role="status" className="text-text-muted">Loading…</p>
        ) : 'error' in ready ? (
          <p role="alert" className="text-text-muted">{ready.error}</p>
        ) : ready.inquiries.length === 0 ? (
          <p className="text-text-muted">
            <span aria-hidden="true" className="mr-1 font-logo">(・ω・)</span>
            No inquiries yet
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {ready.inquiries.map((inq) => (
              <li key={inq.id}>
                <button
                  type="button"
                  aria-pressed={inq.id === selectedId}
                  onClick={() => setSelectedId(inq.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm transition-colors hover:bg-ink-900/5 focus-visible:outline-1 focus-visible:outline-text ${
                    inq.id === selectedId ? 'bg-ink-900/10' : ''
                  }`}
                >
                  <Avatar src={inq.adopter.avatar} name={inq.adopter.full_name} size="sm" online={inq.adopter.is_online} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text">{inq.adopter.full_name}</span>
                    <Preview message={inq.last_message} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* key: a draft typed for one adopter never carries over to the next */}
      {selected && <PetChat key={selected.id} inquiryId={selected.id} />}
    </section>
  )
}
