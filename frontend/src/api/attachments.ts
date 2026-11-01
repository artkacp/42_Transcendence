// Chat attachments: staged uploads (with progress), unstaging, and authorized downloads.
import { ApiError, authorizedFetch, del, endSession, getAccessToken, refresh, toApiError } from './client'
import type { Attachment } from '../data/types'

export const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'txt', 'md', 'csv', 'docx']
export const ACCEPT = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(',')
export const MAX_BYTES = 5 * 1024 * 1024

export const fileSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

// Same rules as the backend, checked before anything is sent
export function checkFile(file: File): string | null {
  const ext = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `${file.name}: this file type is not allowed`
  if (file.size > MAX_BYTES) return `${file.name}: larger than 5 MB`
  return null
}

// × on a running upload: the UI shows nothing for it
export class UploadCancelled extends Error {
  constructor() {
    super('Upload cancelled')
    this.name = 'UploadCancelled'
  }
}

const UPLOAD_PATH = '/api/attachments/'

// XMLHttpRequest, because fetch has no upload progress. Same Bearer token and the same
// one-time refresh on 401 as api() in client.ts.
export function uploadAttachment(file: File, onProgress: (percent: number) => void) {
  let current: XMLHttpRequest | null = null
  let aborted = false

  const send = () =>
    new Promise<{ status: number; body: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      current = xhr
      xhr.open('POST', UPLOAD_PATH)
      xhr.withCredentials = true
      xhr.responseType = 'json' // null when the body is not JSON
      const token = getAccessToken()
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      }
      xhr.onload = () => resolve({ status: xhr.status, body: xhr.response })
      xhr.onerror = () => reject(new ApiError(0, 'Could not upload the file', 'network'))
      xhr.onabort = () => reject(new UploadCancelled())
      const form = new FormData()
      form.append('file', file)
      xhr.send(form)
    })

  const done = (async (): Promise<Attachment> => {
    let res = await send()
    if (res.status === 401) {
      const refreshed = await refresh()
      if (aborted) throw new UploadCancelled()
      if (!refreshed) {
        endSession()
        throw toApiError(401, res.body)
      }
      onProgress(0)
      res = await send()
    }
    if (res.status < 200 || res.status >= 300) throw toApiError(res.status, res.body)
    return res.body as Attachment
  })()

  // aborts whichever request is in flight, the first try or the retry
  const abort = () => {
    aborted = true
    current?.abort()
  }

  return { done, abort }
}

// Unstage one of your own unsent uploads
export const deleteAttachment = (id: string) => del<null>(`/api/attachments/${id}/`)

// Needs the Bearer header, so never a plain <a href>: fetch as a blob instead
export async function downloadAttachment(id: string): Promise<Blob> {
  const res = await authorizedFetch(`/api/attachments/${id}/download/`)
  if (!res.ok) throw toApiError(res.status, await res.json().catch(() => null))
  return res.blob()
}
