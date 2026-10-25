import { del, get, post } from './client'
import type { ToastKind } from '../ds'
import type { Paginated } from './browse'

export interface AppNotification {
  id: string
  kind: ToastKind
  title: string
  body: string
  is_read: boolean
  subject_type: string | null
  subject_id: string | null
  created_at: string
}

export const getNotifications = (page = 1) => get<Paginated<AppNotification>>(`/api/notifications/?page=${page}`)

export const markAllRead = () => post<null>('/api/notifications/read-all/')

export const clearNotifications = () => del<null>('/api/notifications/')