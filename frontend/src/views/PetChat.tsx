// src/views/PetChat.tsx
// F3b · one inquiry thread under the pet, for the adopter and the owner alike.
// History over REST, live over the socket; sends go by socket, or by REST when it isn't ready.
import { useEffect, useRef, useState, type KeyboardEvent, type SubmitEvent } from 'react'
import { ApiError } from '../api/client'
import { getMessages, sendMessageRest } from '../api/inquiries'
import { useAuth } from '../auth/auth-context'
import type { InquiryMessage } from '../data/types'
import { Button, Card, Textarea } from '../ds'
import { useSocketFrame, useSocketReconnect, useSocketSend } from '../socket/SocketContext'

type Result = { inquiryId: string; messages: InquiryMessage[] } | { inquiryId: string; error: string }

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Could not send the message')

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

export function PetChat({ inquiryId }: { inquiryId: string }) {
  const { user } = useAuth()
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

  // frames were missed while offline: refetch, and stop waiting for an echo that may never come
  useSocketReconnect(() => {
    setPending(null)
    setReload((n) => n + 1)
  })

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
      <h2 className="font-display text-lg font-bold text-text">Messages</h2>

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
          disabled={busy}
        />
        {sendError && (
          <p role="alert" className="text-sm text-danger">
            {sendError}
          </p>
        )}
        <Button type="submit" disabled={busy || !draft.trim()} className="self-end">
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </Card>
  )
}
