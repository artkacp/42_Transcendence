// src/components/ChatAttachment.tsx
// One file inside a chat bubble: an image preview, or a document card with Download.
// Files need the Bearer header, so everything goes through an authorized blob fetch
// and every object URL made here is revoked once it is no longer needed.
import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../api/client'
import { downloadAttachment, fileSize } from '../api/attachments'
import type { Attachment } from '../data/types'
import { Button } from '../ds'

// long enough for the new tab to load the PDF
const PDF_URL_LIFETIME_MS = 60_000

function ImagePreview({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    let made: string | null = null
    downloadAttachment(attachment.id)
      .then((blob) => {
        if (cancelled) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [attachment.id])

  if (failed) return <p className="break-all opacity-80">Image: {attachment.original_name}</p>
  if (!url) return <div role="status" aria-label="Loading image" className="size-32 rounded-xl bg-ink-900/10" />
  return <img src={url} alt={attachment.original_name} className="max-h-48 max-w-full rounded-xl object-contain" />
}

function DocumentCard({ attachment }: { attachment: Attachment }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // URLs still alive (the PDF tab may be loading) and their revoke timers
  const live = useRef(new Map<string, number>())

  useEffect(() => {
    const urls = live.current
    return () => {
      urls.forEach((timer, url) => {
        window.clearTimeout(timer)
        URL.revokeObjectURL(url)
      })
      urls.clear()
    }
  }, [])

  const revokeLater = (url: string, ms: number) => {
    const timer = window.setTimeout(() => {
      URL.revokeObjectURL(url)
      live.current.delete(url)
    }, ms)
    live.current.set(url, timer)
  }

  const save = (url: string) => {
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.original_name
    a.click()
    revokeLater(url, 0) // after the click has started the download
  }

  const isPdf = attachment.content_type === 'application/pdf' || /\.pdf$/i.test(attachment.original_name)

  const onDownload = () => {
    setBusy(true)
    setError(null)
    // opened inside the click, before any await, so it is not blocked as a popup
    const tab = isPdf ? window.open('', '_blank') : null
    downloadAttachment(attachment.id)
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        if (tab && !tab.closed) {
          tab.opener = null
          tab.location.href = url
          revokeLater(url, PDF_URL_LIFETIME_MS)
        } else {
          save(url)
        }
      })
      .catch((err) => {
        tab?.close()
        setError(err instanceof ApiError ? err.message : 'Could not download the file')
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="flex flex-col gap-1 rounded-xl bg-ink-900/5 px-3 py-2">
      <span className="break-all font-medium">{attachment.original_name}</span>
      <span className="text-xs opacity-80">{fileSize(attachment.size_bytes)}</span>
      <Button size="sm" variant="secondary" disabled={busy} onClick={onDownload} className="self-start">
        {busy ? 'Downloading…' : isPdf ? 'Open PDF' : 'Download'}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

export function ChatAttachment({ attachment }: { attachment: Attachment }) {
  return attachment.kind === 'image' ? <ImagePreview attachment={attachment} /> : <DocumentCard attachment={attachment} />
}
