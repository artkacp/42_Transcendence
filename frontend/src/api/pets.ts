import { del, get } from './client'
import type { Pet } from '../data/types'

export const getMyPets = () => get<Pet[]>('/api/pets/mine/')
export const deletePet = (id: string) => del<null>(`/api/pets/${id}/`)
