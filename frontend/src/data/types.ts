export type Species = 'dog' | 'cat'

export type PetSize = 'small' | 'medium' | 'large'

export type PetSex = 'male' | 'female'

export interface User {
  id: string
  handle: string
  full_name: string
  avatar: string | null
  is_online: boolean
  city: string | null
  bio: string
}

export interface Pet {
  id: string
  owner: User
  name: string
  species: Species
  breed: string
  age_years: number
  size: PetSize
  sex: PetSex
  city: string
  story: string
  traits: string[]
  photo: string | null
  is_vaccinated: boolean
  is_neutered: boolean
  adopted_by: User | null
  adopted_at: string | null
  inquiry_count: number
  created_at: string
}

export interface NewPet {
  name: string
  species: Species
  breed: string
  age_years: number
  size: PetSize
  sex: PetSex
  city: string
  story: string
  traits: string[]
  is_vaccinated: boolean
  is_neutered: boolean
}
