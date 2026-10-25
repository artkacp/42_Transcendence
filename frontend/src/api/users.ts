import { api, del, get, patch, post } from './client'
import type { User as Me } from '../auth/auth-context'
import type { Pet, ProfileChanges, UserProfile } from '../data/types'

export const getUser = (id: string) => get<UserProfile>(`/api/users/${id}/`)

export const getUserPets = (id: string) => get<Pet[]>(`/api/users/${id}/pets/`)

export const updateMe = (changes: ProfileChanges) => patch<Me>('/api/users/me/', changes)

export function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return api<Me>('/api/users/me/avatar/', { method: 'PUT', body: form })
}

export const removeAvatar = () => del<Me>('/api/users/me/avatar/')

export const sendFriendRequest = (userId: string) => post('/api/users/friends/', { addressee: userId })

export const acceptFriendRequest = (friendshipId: string) => post(`/api/users/friends/${friendshipId}/accept/`)

// Decline, cancel or unfriend: the backend deletes the row in every case
export const deleteFriendship = (friendshipId: string) => del(`/api/users/friends/${friendshipId}/`)
