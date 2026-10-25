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

export type InquiryStage = 'conversation' | 'visit' | 'decision' | 'denied'

export interface Attachment {
  id: string
  original_name: string
  content_type: string
  size_bytes: number
  kind: 'image' | 'document'
  created_at: string
}

export interface InquiryMessage {
  id: string
  inquiry: string
  sender: User
  body: string
  attachments: Attachment[]
  created_at: string
}

export interface Inquiry {
  id: string
  pet: Pet
  adopter: User
  stage: InquiryStage
  last_message: InquiryMessage | null
  last_message_at: string | null
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

export interface Friendship {
  id: string
  status: 'pending' | 'accepted'
  requested_by_me: boolean
}

export interface UserProfile extends User {
  friendship: Friendship | null
}

export interface ProfileChanges {
  full_name: string
  city: string | null
  bio: string
}

// "App" so it doesn't hide the browser's own Notification type
export interface AppNotification {
  id: string
  kind: 'create' | 'update' | 'delete' | 'info'
  title: string
  body: string
  is_read: boolean
  subject_type: string | null
  subject_id: string | null
  created_at: string
}
