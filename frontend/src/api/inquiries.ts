import { get } from './client'
import type { Inquiry } from '../data/types'

export const getMyInquiries = () => get<Inquiry[]>('/api/inquiries/')
