import { api, del, get, patch, post } from './client'
import type { NewPet, Pet, PetSex, PetSize, Species } from '../data/types'

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

export async function updatePet(id: string, pet: NewPet, photo: File | null, removePhoto: boolean) {
  const updated = await patch<Pet>(`/api/pets/${id}/`, removePhoto ? { ...pet, photo: null } : pet)
  if (!photo) return updated
  const form = new FormData()
  form.append('photo', photo)
  return api<Pet>(`/api/pets/${id}/`, { method: 'PATCH', body: form })
}

export interface PetOptions {
  species: Species[]
  breeds: Record<Species, string[]>
  sizes: PetSize[]
  sexes: PetSex[]
  cities: string[]
  traits: string[]
  age_buckets: Record<string, [number, number]>
}

export const getPetOptions = () => get<PetOptions>('/api/pet-options/')

export const getPet = (id: string) => get<Pet>(`/api/pets/${id}/`)

// Owner only: gives the pet to the adopter of this inquiry
export const adoptPet = (petId: string, inquiryId: string) =>
  post<Pet>(`/api/pets/${petId}/adopt/`, { inquiry_id: inquiryId })
