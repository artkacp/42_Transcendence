import { get } from './client'
import type { Pet } from '../data/types'

export const getMyPets = () => get<Pet[]>('/api/pets/mine/')
