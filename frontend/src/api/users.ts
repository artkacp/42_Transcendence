import { api, del, get, patch } from './client'
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
