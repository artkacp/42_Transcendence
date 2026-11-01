// src/views/PetChat.tsx
// F3b · one inquiry thread under the pet, for the adopter and the owner alike.
// History over REST, live over the socket; sends go by socket, or by REST when it isn't ready.
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type SubmitEvent } from 'react'
import { ApiError } from '../api/client'
import { changeStage, getMessages, getMyInquiries, getPetInquiries, sendMessageRest } from '../api/inquiries'
import { adoptPet } from '../api/pets'
import { useAuth } from '../auth/auth-context'
import { StageProgress } from '../components/StageProgress'
import type { Inquiry, InquiryMessage, InquiryStage } from '../data/types'
import { Button, Card, Modal, Select, Textarea } from '../ds'
import { usePetSubscription, useSocketFrame, useSocketReconnect, useSocketSend } from '../socket/SocketContext'

type Result = { inquiryId: string; messages: InquiryMessage[] } | { inquiryId: string; error: string }

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const errorText = (err: unknown, fallback = 'Could not send the message') =>
  err instanceof ApiError ? err.message : fallback

const STAGE_OPTIONS = [
  { value: 'conversation', label: 'Talking' },
  { value: 'visit', label: 'Visit planned' },
  { value: 'decision', label: 'Decision' },
  { value: 'denied', label: 'Declined' },
  { value: 'adopted', label: 'Adopted' },
]

// Appends unless the id is already there (the socket echo and the REST answer can both bring it)
function withMessage(result: Result | null, message: InquiryMessage): Result | null {
  if (!result || 'error' in result || result.inquiryId !== message.inquiry) return result
  if (result.messages.some((m) => m.id === message.id)) return result
  return { ...result, messages: [...result.messages, message] }
}

function Bubble({ message, mine }: { message: InquiryMessage; mine: boolean }) {
  return (
    <li className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <span className="text-xs text-text-subtle">
        {message.sender.full_name} ·{' '}
        <time dateTime={message.created_at} title={new Date(message.created_at).toLocaleString()}>
          {timeOf(message.created_at)}
        </time>
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
          mine ? 'bg-primary text-on-primary' : 'bg-surface-raised text-text'
        }`}
      >
        {message.body && <p className="whitespace-pre-line break-words">{message.body}</p>}
        {message.attachments.map((a) => (
          <p key={a.id} className="break-all opacity-80">
            File: {a.original_name}
          </p>
        ))}
      </div>
    </li>
  )
}

export function PetChat({ inquiry }: { inquiry: Inquiry }) {
  const inquiryId = inquiry.id
  const { pet, adopter } = inquiry
  const { user } = useAuth()
  const owner = user?.id === pet.owner.id
  const [stage, setStage] = useState<InquiryStage>(inquiry.stage)
  const [adoptedById, setAdoptedById] = useState<string | null>(pet.adopted_by?.id ?? null)
  const [saving, setSaving] = useState(false)
  const [stageError, setStageError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [adoptError, setAdoptError] = useState<string | null>(null)
  const sendFrame = useSocketSend()
  const [result, setResult] = useState<Result | null>(null)
  const [reload, setReload] = useState(0)
  const [draft, setDraft] = useState('')
  // the body sent over the socket, waiting for its echo or an error frame
  const [pending, setPending] = useState<string | null>(null)
  const [sendingRest, setSendingRest] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const logRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    let cancelled = false
    getMessages(inquiryId)
      .then((page) => {
        // the server sends newest first
        if (!cancelled) setResult({ inquiryId, messages: [...page].reverse() })
      })
      .catch(() => {
        if (!cancelled) setResult({ inquiryId, error: 'Could not load the messages' })
      })
    return () => {
      cancelled = true
    }
  }, [inquiryId, reload])

  useSocketFrame('chat.message', ({ message }) => {
    if (message.inquiry !== inquiryId) return
    setResult((r) => withMessage(r, message))
    // our own echo confirms the pending send: only now is the input cleared
    if (pending !== null && message.sender.id === user?.id) {
      setDraft('')
      setPending(null)
      setSendError(null)
    }
  })

  // the frame has no inquiry id: only a send of ours that is still pending can own it
  useSocketFrame('error', (frame) => {
    if (frame.for !== 'chat.send' || pending === null) return
    setPending(null)
    setSendError(frame.detail)
  })

  useSocketFrame('inquiry.stage_changed', ({ inquiry_id, stage: next }) => {
    if (inquiry_id === inquiryId) setStage(next)
  })

  // may arrive twice (pet group and browse): the first one wins
  useSocketFrame('pet.adopted', ({ pet_id, adopted_by_id }) => {
    if (pet_id === pet.id) setAdoptedById((v) => v ?? adopted_by_id)
  })

  usePetSubscription(pet.id)

  // frames were missed while offline: refetch, and stop waiting for an echo that may never come
  useSocketReconnect(() => {
    setPending(null)
    setReload((n) => n + 1)
    const refetch = owner ? getPetInquiries(pet.id) : getMyInquiries()
    refetch
      .then((list) => {
        const fresh = list.find((i) => i.id === inquiryId)
        if (!fresh) return
        setStage(fresh.stage)
        setAdoptedById(fresh.pet.adopted_by?.id ?? null)
      })
      .catch(() => undefined)
  })

  const onStageChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value
    setStageError(null)
    // the select stays bound to `stage`: after Cancel it shows the current stage again
    if (next === 'adopted') {
      setAdoptError(null)
      setConfirmOpen(true)
      return
    }
    if (next === stage) return
    setSaving(true)
    changeStage(inquiryId, next as InquiryStage)
      .then((updated) => setStage(updated.stage))
      .catch((err) => setStageError(errorText(err, 'Could not change the stage')))
      .finally(() => setSaving(false))
  }

  const confirmAdoption = () => {
    setSaving(true)
    setAdoptError(null)
    adoptPet(pet.id, inquiryId)
      .then((updated) => {
        setAdoptedById(updated.adopted_by?.id ?? adopter.id)
        setConfirmOpen(false)
      })
      .catch((err) => setAdoptError(errorText(err, 'Could not complete the adoption')))
      .finally(() => setSaving(false))
  }

  const adopted = adoptedById !== null
  const adoptedHere = adoptedById === adopter.id

  const count = result && 'messages' in result ? result.messages.length : 0
  useEffect(() => {
    const log = logRef.current
    if (log) log.scrollTop = log.scrollHeight
  }, [count])

  const busy = pending !== null || sendingRest

  // disabling the textarea drops its focus: give it back once the send is settled
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !busy) inputRef.current?.focus()
    wasBusy.current = busy
  }, [busy])

  const onSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || busy) return
    setSendError(null)
    if (sendFrame({ type: 'chat.send', inquiry_id: inquiryId, body })) {
      setPending(body)
      return
    }
    // socket not ready: no echo will reach us, so the REST answer is the message
    setSendingRest(true)
    sendMessageRest(inquiryId, body)
      .then((message) => {
        setResult((r) => withMessage(r, message))
        setDraft('')
      })
      .catch((err) => setSendError(errorText(err)))
      .finally(() => setSendingRest(false))
  }

  // Enter sends, Shift+Enter adds a newline
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    e.currentTarget.form?.requestSubmit()
  }

  // derived, not stored: an answer for another thread means we are still loading
  const ready = result && result.inquiryId === inquiryId ? result : null

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-bold text-text">Messages</h2>
        {owner && !adopted && (
          <Select
            aria-label="Adoption stage"
            options={STAGE_OPTIONS}
            value={stage}
            onChange={onStageChange}
            disabled={saving}
            className="w-auto"
          />
        )}
        {adopted && !adoptedHere ? (
          <p className="text-sm text-text-muted">Adopted by someone else</p>
        ) : adoptedHere && owner ? (
          <p className="text-sm text-text-muted">Adopted by {adopter.full_name}</p>
        ) : (
          <StageProgress stage={adoptedHere ? 'adopted' : stage} viewer={owner ? 'owner' : 'adopter'} />
        )}
      </div>
      {stageError && (
        <p role="alert" className="text-sm text-danger">
          {stageError}
        </p>
      )}

      {owner && (
        <Modal
          open={confirmOpen}
          onClose={() => !saving && setConfirmOpen(false)}
          title={`Give ${pet.name} to ${adopter.full_name}?`}
          description="Other applicants will be told."
          footer={
            <>
              <Button type="button" variant="secondary" disabled={saving} onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving} onClick={confirmAdoption}>
                Confirm adoption
              </Button>
            </>
          }
        >
          {adoptError && (
            <p role="alert" className="text-sm text-danger">
              {adoptError}
            </p>
          )}
        </Modal>
      )}

      {!ready ? (
        <p role="status" className="text-text-muted">Loading…</p>
      ) : 'error' in ready ? (
        <p role="alert" className="text-text-muted">{ready.error}</p>
      ) : (
        <>
          {ready.messages.length === 0 && (
          <p className="text-terra-400">
            <span aria-hidden="true" className="mr-1 font-logo">^◕◕^｡｡｡｡</span>
            No messages yet
          </p>
          )}
          {/* always mounted, so the first message is announced too */}
          <ol ref={logRef} role="log" aria-live="polite" className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {ready.messages.map((m) => (
              <Bubble key={m.id} message={m} mine={m.sender.id === user?.id} />
            ))}
          </ol>
        </>
      )}

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <Textarea
          ref={inputRef}
          label="Your message"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy || adopted}
        />
        {adopted && <p className="text-sm text-text-muted">This adoption is closed.</p>}
        {sendError && (
          <p role="alert" className="text-sm text-danger">
            {sendError}
          </p>
        )}
        <Button type="submit" disabled={busy || adopted || !draft.trim()} className="self-end">
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </Card>
  )
}
