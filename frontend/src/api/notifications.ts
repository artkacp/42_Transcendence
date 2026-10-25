import { del, get, post } from './client'
import type { Paginated } from './browse'
import type { AppNotification } from '../data/types'

export const getNotifications = (page = 1) => get<Paginated<AppNotification>>(`/api/notifications/?page=${page}`)

export const markAllRead = () => post<null>('/api/notifications/read-all/')

export const clearNotifications = () => del<null>('/api/notifications/')