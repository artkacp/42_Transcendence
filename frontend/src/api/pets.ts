import { api, del, get, post } from './client'
import type { NewPet, Pet, PetSex, PetSize, Species } from '../data/types'

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const getMyPets = () => get<Pet[]>('/api/pets/mine/')

export const deletePet = (id: string) => del<null>(`/api/pets/${id}/`)

function petForm(pet: NewPet) {
  const form = new FormData()
  for (const [key, value] of Object.entries(pet)) {
    if (Array.isArray(value)) value.forEach((item) => form.append(key, item))
    else form.append(key, String(value))
  }
  return form
}

export function createPet(pet: NewPet, photo: File | null) {
  const form = petForm(pet)
  if (photo) form.append('photo', photo)
  return api<Pet>('/api/pets/', { method: 'POST', body: form })
}

// One request, so the text and the photo are saved together or not at all
export function updatePet(id: string, pet: NewPet, photo: File | null, removePhoto: boolean) {
  const form = petForm(pet)
  if (pet.traits.length === 0) form.append('traits', '')
  if (photo) form.append('photo', photo)
  else if (removePhoto) form.append('photo', '')
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
