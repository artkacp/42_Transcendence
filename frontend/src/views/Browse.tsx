import { useState } from 'react'
import { CITIES, BREEDS_BY_SPECIES, ALL_TRAITS, AGE_BUCKETS } from '../data/constants'
import { SAMPLE_PETS } from '../data/mockData'
import type { Species, PetSize, PetSex } from '../data/types'
import { Select, Chip, Avatar, EmptyState, Button, Card, Badge, Input } from '../ds'

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

  const breedOptions = species === 'all' ? [...BREEDS_BY_SPECIES.dog, ...BREEDS_BY_SPECIES.cat] : BREEDS_BY_SPECIES[species]

  const handleSpeciesChange = (next: Species | 'all') => {
    setSpecies(next)
    if (next !== 'all' && breed !== 'all' && !BREEDS_BY_SPECIES[next].includes(breed)) {
      setBreed('all')
    }
  }

  const activeAgeBucket = AGE_BUCKETS.find((b) => b.id === ageBucket) ?? AGE_BUCKETS[0]

  const results = SAMPLE_PETS.filter((p) => {
    if (species !== 'all' && p.species !== species) return false
    if (sex !== 'all' && p.sex !== sex) return false
    if (size !== 'all' && p.size !== size) return false
    if (city !== 'all' && p.city !== city) return false
    if (breed !== 'all' && p.breed !== breed) return false
    if (!activeAgeBucket.test(p.age_years)) return false
    if (trait !== 'all' && !p.traits.includes(trait)) return false
    if (vaccinatedOnly && !p.is_vaccinated) return false
    if (neuteredOnly && !p.is_neutered) return false
    if (q) {
      const haystack = `${p.name} ${p.breed} ${p.traits.join(' ')}`.toLowerCase()
      if (!haystack.includes(q.toLowerCase())) return false
    }
    return true
  })

  const clearFilters = () => {
    setQ('')
    setSpecies('all')
    setSex('all')
    setSize('all')
    setCity('all')
    setBreed('all')
    setAgeBucket('all')
    setTrait('all')
    setVaccinatedOnly(false)
    setNeuteredOnly(false)
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
          <p className="text-sm text-text-subtle">
            <span className="font-semibold text-text">{results.length}</span> pals available
          </p>
          <Button size="sm" variant="secondary">
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
        <Select
          aria-label="Sex"
          options={[
            { value: 'all', label: 'Any sex' },
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
          ]}
          value={sex}
          onChange={(e) => setSex(e.target.value as PetSex | 'all')}
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
          onChange={(e) => setSize(e.target.value as PetSize | 'all')}
        />
        <Select
          aria-label="City"
          options={[{ value: 'all', label: 'Any city' }, ...CITIES.map((c) => ({ value: c, label: c }))]}
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        <Select
          aria-label="Breed"
          options={[{ value: 'all', label: 'Any breed' }, ...breedOptions.map((b) => ({ value: b, label: b }))]}
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
        />
        <Select
          aria-label="Age"
          options={AGE_BUCKETS.map((b) => ({ value: b.id, label: b.label }))}
          value={ageBucket}
          onChange={(e) => setAgeBucket(e.target.value)}
        />
        <Select
          aria-label="Trait"
          options={[{ value: 'all', label: 'Any trait' }, ...ALL_TRAITS.map((t) => ({ value: t, label: t }))]}
          value={trait}
          onChange={(e) => setTrait(e.target.value)}
        />
      </div>

      {results.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((p) => (
            <Card key={p.id} hover className="cursor-pointer overflow-hidden">
              <div className="relative flex h-40 items-center justify-center bg-secondary">
                <span className="text-7xl" aria-hidden>
                  {p.species === 'dog' ? '🐕' : '🐈'}
                </span>
                {p.adopted_by && (
                  <Badge tone="success" className="absolute left-3 top-3">
                    adopted 🎉
                  </Badge>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
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
                  <div className="flex items-center gap-1.5">
                    <Avatar name={p.owner.full_name} src={p.owner.avatar} size="sm" />
                    <span className="text-xs text-text-subtle">{p.owner.full_name}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}