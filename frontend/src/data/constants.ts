import type { Species } from './types'

export const CITIES: string[] = ['Warszawa', 'Kraków', 'Łódź', 'Wrocław', 'Poznań', 'Gdańsk', 'Szczecin', 'Katowice', 'Lublin']

export const BREEDS_BY_SPECIES: Record<Species, string[]> = {
  dog: ['Golden Retriever', 'German Shepherd', 'French Bulldog', 'Border Collie', 'Poodle'],
  cat: ['British Shorthair', 'Maine Coon', 'Siamese', 'Persian', 'Scottish Fold'],
}

export const ALL_TRAITS: string[] = ['friendly', 'playful', 'calm', 'shy', 'energetic', 'wild', 'cuddly', 'loyal', 'protective']

export const AGE_BUCKETS: { id: string; label: string }[] = [
  { id: 'all', label: 'Any age' },
  { id: 'under_1', label: 'Under 1' },
  { id: '1_3', label: '1–3 years' },
  { id: '4_7', label: '4–7 years' },
  { id: '8_plus', label: '8+ years' },
]
