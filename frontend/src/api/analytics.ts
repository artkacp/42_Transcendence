import { get } from './client'
import type { Species } from '../data/types'

export interface KpiMetric {
  value: number
  delta: number
}

export interface AnalyticsKpis {
  listing_visits: KpiMetric
  applications: KpiMetric
  adoptions: KpiMetric
  messages: KpiMetric
}

export interface TimePoint {
  date: string
  count: number
}

export interface SpeciesCount {
  species: string
  count: number
}

export interface OffersPoint {
  date: string
  count: number
  running_total: number
}

export interface UsersPoint {
  date: string
  active_users: number
  new_signups: number
}

export interface SeekersRehomersPoint {
  date: string
  seekers: number
  rehomers: number
}

export interface DistributionBucket {
  bucket: string
  count: number
}

export interface ApplicationsDistribution {
  distribution: DistributionBucket[]
  average: number | null
}

export interface AppAdoptionsPoint {
  date: string
  applications: number
  adoptions: number
}

export interface AnalyticsCharts {
  listing_visits_over_time: TimePoint[]
  adoptions_by_species: SpeciesCount[]
  offers_over_time: OffersPoint[]
  users_over_time: UsersPoint[]
  seekers_vs_rehomers: SeekersRehomersPoint[]
  applications_per_adopted_pet: ApplicationsDistribution
  applications_vs_adoptions: AppAdoptionsPoint[]
  community_messages: TimePoint[]
}

export interface AnalyticsResponse {
  kpis: AnalyticsKpis
  charts: AnalyticsCharts
}

export interface AnalyticsFilters {
  start?: string
  end?: string
  species?: Species
  sex?: string
  size?: string
  age_bucket?: string
  city?: string
  breed?: string
  trait?: string
  vaccinated?: boolean
  neutered?: boolean
}

export function getPlatformAnalytics(filters: AnalyticsFilters = {}) {
  const params = new URLSearchParams()

  if (filters.start) params.set('start', filters.start)
  if (filters.end) params.set('end', filters.end)
  if (filters.species) params.set('species', filters.species)
  if (filters.sex) params.set('sex', filters.sex)
  if (filters.size) params.set('size', filters.size)
  if (filters.age_bucket) params.set('age_bucket', filters.age_bucket)
  if (filters.city) params.set('city', filters.city)
  if (filters.breed) params.set('breed', filters.breed)
  if (filters.trait) params.set('trait', filters.trait)
  if (filters.vaccinated) params.set('vaccinated', 'true')
  if (filters.neutered) params.set('neutered', 'true')

  const query = params.toString()
  return get<AnalyticsResponse>(query ? `/api/analytics/platform/?${query}` : '/api/analytics/platform/')
}
