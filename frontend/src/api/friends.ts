import { del, get, post } from './client'
import type { User } from '../data/types'

export interface FriendRecord {
  id: string
  other_user: User
}

export interface FriendRequestRecord {
  id: string
  other_user: User
  created_at: string
}

export const getFriends = () => get<FriendRecord[]>('/api/users/friends/')

export const getFriendRequests = () => get<FriendRequestRecord[]>('/api/users/friends/incoming/')

export const sendFriendRequest = (userId: string) =>
  post<{ id: string; status: 'pending' | 'accepted' }>('/api/users/friends/', { addressee: userId })

export const acceptFriendRequest = (id: string) => post(`/api/users/friends/${id}/accept/`)

// decline and cancel both use DELETE — there is no separate reject action
export const deleteFriendship = (id: string) => del(`/api/users/friends/${id}/`)
