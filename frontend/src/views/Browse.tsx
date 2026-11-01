import { SlidersHorizontal } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { getPets, type Paginated } from '../api/browse'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { CITIES, BREEDS_BY_SPECIES, ALL_TRAITS, AGE_BUCKETS } from '../data/constants'
import type { Pet, Species, PetSize, PetSex } from '../data/types'
import { Select, Chip, Avatar, EmptyState, Button, Card, Badge, Input, Pagination } from '../ds'
import { navigate, viewHref } from '../routing'
import { useSocketFrame, useSocketReconnect } from '../socket/SocketContext'

const PAGE_SIZE = 6

function openPet(e: MouseEvent<HTMLAnchorElement>, id: string) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  navigate('pet', { id })
}

export function Browse() {
  const [q, setQ] = useState('')
  const [species, setSpecies] = useState<Species | 'all'>('all')
  const [sex, setSex] = useState<PetSex | 'all'>('all')
  const [size, setSize] = useState<PetSize | 'all'>('all')
  const [city, setCity] = useState('all')
  const [breed, setBreed] = useState('all')
  const [ageBucket, setAgeBucket] = useState('all')
  const [trait, setTrait] = useState('all')
  const [vaccinatedOnly, setVaccinatedOnly] = useState(false)
  const [neuteredOnly, setNeuteredOnly] = useState(false)
  const [ordering, setOrdering] = useState('-created_at')
  const [page, setPage] = useState(1)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [data, setData] = useState<Paginated<Pet> | null>(null)
  const [settledKey, setSettledKey] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const [retry, setRetry] = useState(0)
  const { status, user } = useAuth()
  const [debouncedQ, setDebouncedQ] = useState('')
  const [live, setLive] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = q.trim()
      if (next !== debouncedQ) {
        setDebouncedQ(next)
        setPage(1)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q, debouncedQ])

  const requestKey = JSON.stringify([debouncedQ, species, sex, size, city, breed, ageBucket, trait, vaccinatedOnly, neuteredOnly, ordering, page, retry])
  const loading = settledKey !== requestKey
  const error = errorKey === requestKey

  useEffect(() => {
    if (status !== 'signed-in') return
    let ignore = false
    getPets({ q: debouncedQ, species, sex, size, city, breed, ageBucket, trait, vaccinated: vaccinatedOnly, neutered: neuteredOnly, ordering, page })
      .then((res) => {
        if (ignore) return
        setData(res)
        setSettledKey(requestKey)
      })
      .catch((err) => {
        if (ignore) return
        if (err instanceof ApiError && err.status === 404 && page > 1) setPage(1)
        else setErrorKey(requestKey)
      })
    return () => {
      ignore = true
    }
  }, [status, requestKey, debouncedQ, species, sex, size, city, breed, ageBucket, trait, vaccinatedOnly, neuteredOnly, ordering, page, live])

  const refresh = () => setLive((n) => n + 1)
  useSocketFrame('pet.published', refresh)
  useSocketFrame('pet.removed', refresh)
  useSocketFrame('pet.adopted', refresh)
  useSocketReconnect(refresh)

  const changeFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const breedOptions = species === 'all' ? [...BREEDS_BY_SPECIES.dog, ...BREEDS_BY_SPECIES.cat] : BREEDS_BY_SPECIES[species]

  const handleSpeciesChange = (next: Species | 'all') => {
    setSpecies(next)
    if (next !== 'all' && breed !== 'all' && !BREEDS_BY_SPECIES[next].includes(breed)) {
      setBreed('all')
    }
    setPage(1)
  }

  const activeFilterCount = [sex, size, city, breed, ageBucket, trait].filter((v) => v !== 'all').length + (vaccinatedOnly ? 1 : 0) + (neuteredOnly ? 1 : 0)

  const results = data?.results ?? []
  const count = data?.count ?? 0
  const totalPages = Math.ceil(count / PAGE_SIZE)

  const clearFilters = () => {
    setQ('')
    setDebouncedQ('')
    setSpecies('all')
    setSex('all')
    setSize('all')
    setCity('all')
    setBreed('all')
    setAgeBucket('all')
    setTrait('all')
    setVaccinatedOnly(false)
    setNeuteredOnly(false)
    setPage(1)
  }

  const hasFilters = debouncedQ !== '' || species !== 'all' || activeFilterCount > 0

  if (status !== 'signed-in') {
    return (
      <div className="p-8">
        {status === 'loading' ? (
          <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
        ) : (
          <EmptyState
            emoji="🔒"
            title="Sign in to meet the pals"
            hint="Browsing is for members — it only takes a minute."
            action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">
            Find your <span className="text-primary">person</span>.
          </h1>
          <p className="mt-1 text-sm text-text-muted">They just happen to have four legs. Or wings.</p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <p className="text-sm text-text-subtle">
              <span className="font-semibold text-text">{count}</span> {count === 1 ? 'pal' : 'pals'} available
            </p>
          )}
          <Button size="sm" variant="secondary" onClick={() => navigate('rehome')}>
            Rehome a pet
          </Button>
        </div>
      </div>

      <Input
        type="text"
        placeholder="Search by name, breed, or trait…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search pets"
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={species === 'all'} onClick={() => handleSpeciesChange('all')}>
            All pals
          </Chip>
          <Chip active={species === 'dog'} onClick={() => handleSpeciesChange('dog')}>
            🐶 Dogs
          </Chip>
          <Chip active={species === 'cat'} onClick={() => handleSpeciesChange('cat')}>
            🐱 Cats
          </Chip>
          <Button
            size="sm"
            variant="ghost"
            icon={<SlidersHorizontal className="size-4" />}
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="browse-filters"
          >
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Button>
          <Select
            aria-label="Sort by"
            className="ml-auto"
            options={[
              { value: '-created_at', label: 'Newest listings' },
              { value: 'created_at', label: 'Oldest listings' },
              { value: 'name', label: 'Name A–Z' },
              { value: 'age_years', label: 'Youngest pets' },
              { value: '-age_years', label: 'Oldest pets' },
            ]}
            value={ordering}
            onChange={(e) => changeFilter(() => setOrdering(e.target.value))}
          />
        </div>

        {filtersOpen && (
          <div id="browse-filters" className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Sex"
              options={[
                { value: 'all', label: 'Any sex' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={sex}
              onChange={(e) => changeFilter(() => setSex(e.target.value as PetSex | 'all'))}
            />
            <Select
              aria-label="Size"
              options={[
                { value: 'all', label: 'Any size' },
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
              value={size}
              onChange={(e) => changeFilter(() => setSize(e.target.value as PetSize | 'all'))}
            />
            <Select
              aria-label="City"
              options={[{ value: 'all', label: 'Any city' }, ...CITIES.map((c) => ({ value: c, label: c }))]}
              value={city}
              onChange={(e) => changeFilter(() => setCity(e.target.value))}
            />
            <Select
              aria-label="Breed"
              options={[{ value: 'all', label: 'Any breed' }, ...breedOptions.map((b) => ({ value: b, label: b }))]}
              value={breed}
              onChange={(e) => changeFilter(() => setBreed(e.target.value))}
            />
            <Select
              aria-label="Age"
              options={AGE_BUCKETS.map((b) => ({ value: b.id, label: b.label }))}
              value={ageBucket}
              onChange={(e) => changeFilter(() => setAgeBucket(e.target.value))}
            />
            <Select
              aria-label="Trait"
              options={[{ value: 'all', label: 'Any trait' }, ...ALL_TRAITS.map((t) => ({ value: t, label: t }))]}
              value={trait}
              onChange={(e) => changeFilter(() => setTrait(e.target.value))}
            />
            <Chip active={vaccinatedOnly} onClick={() => changeFilter(() => setVaccinatedOnly(!vaccinatedOnly))}>
              💉 Vaccinated
            </Chip>
            <Chip active={neuteredOnly} onClick={() => changeFilter(() => setNeuteredOnly(!neuteredOnly))}>
              ✂️ Neutered
            </Chip>
          </div>
        )}
      </div>

      {error ? (
        <EmptyState
          emoji="😿"
          title="Couldn't load the pals"
          hint="Something went wrong on our side. Try again in a moment."
          action={
            <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : !data ? (
        <p className="py-16 text-center text-sm text-text-muted">Loading pals…</p>
      ) : count === 0 && hasFilters ? (
        <EmptyState
          emoji="🔍"
          title="No pals match those filters"
          hint="Try clearing the search — someone fluffy is out there."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : count === 0 ? (
        <EmptyState
          emoji="🐾"
          title="No pals listed yet"
          hint="Be the first to find a pet a new home."
          action={
            <Button variant="secondary" onClick={() => navigate('rehome')}>
              Rehome a pet
            </Button>
          }
        />
      ) : (
        <>
          <div aria-busy={loading} className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {results.map((p) => (
              <Card key={p.id} hover className="relative overflow-hidden has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-primary">
                <div className="relative flex h-40 items-center justify-center bg-secondary">
                  {p.photo ? (
                    <img src={p.photo} alt={p.name} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    <span className="text-7xl" aria-hidden>
                      {p.species === 'dog' ? '🐕' : '🐈'}
                    </span>
                  )}
                  {p.adopted_by && (
                    <Badge tone="success" className="absolute left-3 top-3">
                      adopted 🎉
                    </Badge>
                  )}
                  {user && p.owner.id === user.id && (
                    <Badge className="absolute right-3 top-3">your listing</Badge>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-xl font-bold">
                      <a
                        href={viewHref('pet', { id: p.id })}
                        onClick={(e) => openPet(e, p.id)}
                        className="after:absolute after:inset-0 focus-visible:outline-none"
                      >
                        {p.name}
                      </a>
                    </h3>
                    <span className="text-xs text-text-subtle">{p.city}</span>
                  </div>
                  <p className="text-sm text-text-muted">
                    {p.breed} · {p.age_years === 0 ? 'under 1 yr' : `${p.age_years} ${p.age_years === 1 ? 'yr' : 'yrs'}`} · {p.sex}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex gap-1.5">
                      {p.traits.slice(0, 2).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('profile', { user: p.owner.id })}
                      aria-label={`View ${p.owner.full_name}'s profile`}
                      className="relative z-10 flex cursor-pointer items-center gap-1.5 rounded-full focus-visible:outline-none focus-gradient"
                    >
                      <Avatar name={p.owner.full_name} src={p.owner.avatar} size="sm" />
                      <span className="text-xs text-text-subtle hover:text-text">{p.owner.full_name.split(' ')[0]}</span>
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  )
}
