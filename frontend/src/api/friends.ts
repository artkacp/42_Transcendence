import { del, get, post } from './client'
import type { User } from '../data/types'

export interface FriendRecord {
  id: string        
  friend: User
}

export interface FriendRequestRecord {
  id: string       
  requester: User
  created_at: string
}

export interface UserSearchResult extends User {
  friendship: { id: string; status: 'pending' | 'accepted'; requested_by_me: boolean } | null
}

export const getFriends = () => get<FriendRecord[]>('/api/friends/')

export const getFriendRequests = () => get<FriendRequestRecord[]>('/api/friends/requests/')

export const sendFriendRequest = (userId: string) =>
  post('/api/friends/request/', { addressee: userId })

export const acceptFriendRequest = (id: string) => post(`/api/friends/${id}/accept/`)

export const rejectFriendRequest = (id: string) => post(`/api/friends/${id}/reject/`)

export const deleteFriendship = (id: string) => del(`/api/friends/${id}/`)

export const searchUsers = (q: string) =>
  get<UserSearchResult[]>(`/api/users/?search=${encodeURIComponent(q)}`)
