import { get } from './client'
import type { Pet, PetSex, PetSize, Species } from '../data/types'

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface PetFilters {
  q: string
  species: Species | 'all'
  sex: PetSex | 'all'
  size: PetSize | 'all'
  city: string
  breed: string
  ageBucket: string
  trait: string
  vaccinated: boolean
  neutered: boolean
  ordering: string
  page: number
}

export function getPets(filters: PetFilters) {
  const params = new URLSearchParams()
  const q = filters.q.trim()
  if (q) params.set('q', q)

  const choices = {
    species: filters.species,
    sex: filters.sex,
    size: filters.size,
    city: filters.city,
    breed: filters.breed,
    age_bucket: filters.ageBucket,
    trait: filters.trait,
  }
  for (const [key, value] of Object.entries(choices)) {
    if (value !== 'all') params.set(key, value)
  }

  if (filters.vaccinated) params.set('vaccinated', 'true')
  if (filters.neutered) params.set('neutered', 'true')
  if (filters.ordering !== '-created_at') params.set('ordering', filters.ordering)
  if (filters.page > 1) params.set('page', String(filters.page))

  const query = params.toString()
  return get<Paginated<Pet>>(query ? `/api/pets/?${query}` : '/api/pets/')
}
