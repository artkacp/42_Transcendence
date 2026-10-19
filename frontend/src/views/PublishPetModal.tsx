import { useId, useState, type ComponentProps } from 'react'
import { ALL_TRAITS, BREEDS_BY_SPECIES, CITIES } from '../data/constants'
import type { PetSex, PetSize, Species } from '../data/types'
import { Button, Chip, Input, Modal, Select, Textarea, Toggle } from '../ds'

const FORM_ID = 'publish-pet-form'
const MAX_TRAITS = 4

const SPECIES_OPTIONS = [
  { value: 'dog', label: '🐶 Dog' },
  { value: 'cat', label: '🐱 Cat' },
]

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
]

const SEX_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
]

const AGE_OPTIONS = Array.from({ length: 21 }, (_, age) => ({
  value: String(age),
  label: age === 0 ? 'Under 1 year' : age === 1 ? '1 year' : `${age} years`,
}))

const CITY_OPTIONS = CITIES.map((city) => ({ value: city, label: city }))

export interface PetDraft {
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

type DraftErrors = Partial<Record<keyof PetDraft, string>>

const EMPTY_DRAFT: PetDraft = {
  name: '',
  species: 'dog',
  breed: '',
  age_years: 1,
  size: 'medium',
  sex: 'female',
  city: CITIES[0],
  story: '',
  traits: [],
  is_vaccinated: false,
  is_neutered: false,
}

function validate(draft: PetDraft): DraftErrors {
  const errors: DraftErrors = {}
  if (draft.name.trim().length < 2) errors.name = 'Name needs at least 2 characters.'
  if (!draft.breed) errors.breed = 'Choose a breed.'
  if (draft.story.trim().length < 20) errors.story = 'Story needs at least 20 characters.'
  return errors
}

function SelectField({ label, error, ...rest }: ComponentProps<typeof Select> & { label: string; error?: string }) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      <Select
        id={id}
        className="w-full"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function PublishForm() {
  const [draft, setDraft] = useState<PetDraft>(EMPTY_DRAFT)
  const [errors, setErrors] = useState<DraftErrors>({})

  const update = <K extends keyof PetDraft>(key: K, value: PetDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const changeSpecies = (species: Species) => {
    setDraft((prev) => ({ ...prev, species, breed: '' }))
    setErrors((prev) => ({ ...prev, breed: undefined }))
  }

  const toggleTrait = (trait: string) =>
    update('traits', draft.traits.includes(trait) ? draft.traits.filter((t) => t !== trait) : [...draft.traits, trait])

  const breedOptions = [
    { value: '', label: 'Choose a breed' },
    ...BREEDS_BY_SPECIES[draft.species].map((breed) => ({ value: breed, label: breed })),
  ]

  return (
    <form
      id={FORM_ID}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        setErrors(validate(draft))
      }}
    >
      <Input
        label="Name"
        placeholder="e.g. Cookie"
        maxLength={100}
        value={draft.name}
        onChange={(e) => update('name', e.target.value)}
        error={errors.name}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Species"
          options={SPECIES_OPTIONS}
          value={draft.species}
          onChange={(e) => changeSpecies(e.target.value as Species)}
        />
        <SelectField
          label="Breed"
          options={breedOptions}
          value={draft.breed}
          onChange={(e) => update('breed', e.target.value)}
          error={errors.breed}
        />
        <SelectField
          label="Age"
          options={AGE_OPTIONS}
          value={String(draft.age_years)}
          onChange={(e) => update('age_years', Number(e.target.value))}
        />
        <SelectField
          label="Size"
          options={SIZE_OPTIONS}
          value={draft.size}
          onChange={(e) => update('size', e.target.value as PetSize)}
        />
        <SelectField
          label="Sex"
          options={SEX_OPTIONS}
          value={draft.sex}
          onChange={(e) => update('sex', e.target.value as PetSex)}
        />
        <SelectField
          label="City"
          options={CITY_OPTIONS}
          value={draft.city}
          onChange={(e) => update('city', e.target.value)}
        />
      </div>

      <Textarea
        label="Story"
        placeholder="What should adopters know about them?"
        value={draft.story}
        onChange={(e) => update('story', e.target.value)}
        error={errors.story}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-text">
          Traits <span className="font-normal text-text-muted">({draft.traits.length}/{MAX_TRAITS})</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {ALL_TRAITS.map((trait) => {
            const active = draft.traits.includes(trait)
            return (
              <Chip
                key={trait}
                active={active}
                disabled={!active && draft.traits.length >= MAX_TRAITS}
                onClick={() => toggleTrait(trait)}
              >
                {trait}
              </Chip>
            )
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <Toggle label="Vaccinated" checked={draft.is_vaccinated} onChange={(value) => update('is_vaccinated', value)} />
        <Toggle label="Neutered" checked={draft.is_neutered} onChange={(value) => update('is_neutered', value)} />
      </div>
    </form>
  )
}

export function PublishPetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Rehome a pet"
      description="Adopters will see this in Browse and on the pet's page."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID}>
            Publish
          </Button>
        </>
      }
    >
      {open && <PublishForm />}
    </Modal>
  )
}