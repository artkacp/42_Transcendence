import { api, del, get } from './client'
import type { NewPet, Pet } from '../data/types'

export const getMyPets = () => get<Pet[]>('/api/pets/mine/')

export const deletePet = (id: string) => del<null>(`/api/pets/${id}/`)

export function createPet(pet: NewPet, photo: File | null) {
  const form = new FormData()
  for (const [key, value] of Object.entries(pet)) {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item))
    else form.append(key, String(value))
  }
  if (photo) form.append('photo', photo)
  return api<Pet>('/api/pets/', { method: 'POST', body: form })
}
