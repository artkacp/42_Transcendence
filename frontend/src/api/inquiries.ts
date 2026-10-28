import { get, post } from './client'
import type { Inquiry, InquiryMessage } from '../data/types'

export const getMyInquiries = () => get<Inquiry[]>('/api/inquiries/')

// Owner inbox for one pet (403 for anyone else)
export const getPetInquiries = (petId: string) => get<Inquiry[]>(`/api/pets/${petId}/inquiries/`)

// get_or_create: 201 when new, 200 when the caller already asked about this pet
export const startInquiry = (petId: string) => post<Inquiry>(`/api/pets/${petId}/inquiries/`)

// Newest first, 30 per page
export const getMessages = (id: string) => get<InquiryMessage[]>(`/api/inquiries/${id}/messages/`)

// REST fallback when the socket isn't ready (the server still pushes chat.message)
export const sendMessageRest = (id: string, body: string) =>
  post<InquiryMessage>(`/api/inquiries/${id}/messages/`, { body })
