import { useEffect, useId, useRef, useState, type ComponentProps } from 'react'
import { ImagePlus, X } from 'lucide-react'
import { ApiError } from '../api/client'
import { createPet, getPetOptions, type PetOptions } from '../api/pets'
import type { NewPet, Pet, PetSex, PetSize, Species } from '../data/types'
import { Button, Chip, Input, Modal, Select, Textarea, Toggle } from '../ds'

const FORM_ID = 'publish-pet-form'
const MAX_TRAITS = 4
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_PHOTO_MB = 5

const SPECIES_LABELS: Record<Species, string> = { dog: '🐶 Dog', cat: '🐱 Cat' }

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

const toOptions = (values: string[]) => values.map((value) => ({ value, label: capitalize(value) }))

const AGE_OPTIONS = Array.from({ length: 21 }, (_, age) => ({
  value: String(age),
  label: age === 0 ? 'Under 1 year' : age === 1 ? '1 year' : `${age} years`,
}))

type FieldName = keyof NewPet | 'photo'
type FieldErrors = Partial<Record<FieldName, string>>

const emptyDraft = (petOptions: PetOptions): NewPet => ({
  name: '',
  species: 'dog',
  breed: '',
  age_years: 1,
  size: 'medium',
  sex: 'female',
  city: petOptions.cities[0],
  story: '',
  traits: [],
  is_vaccinated: false,
  is_neutered: false,
})

function validate(draft: NewPet): FieldErrors {
  const errors: FieldErrors = {}
  if (draft.name.trim().length < 2) errors.name = 'Name needs at least 2 characters.'
  if (!draft.breed) errors.breed = 'Choose a breed.'
  if (draft.story.trim().length < 20) errors.story = 'Story needs at least 20 characters.'
  return errors
}

function photoProblem(file: File) {
  if (!PHOTO_TYPES.includes(file.type)) return `${file.name} is not a JPG, PNG, WebP or GIF image.`
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return `${file.name} is larger than ${MAX_PHOTO_MB} MB.`
  return ''
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

interface PhotoPickerProps {
  file: File | null
  species: Species
  error?: string
  onChange: (file: File | null) => void
}

function PhotoPicker({ file, species, error, onChange }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [rejected, setRejected] = useState('')

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const select = (next: File) => {
    setPreview(URL.createObjectURL(next))
    onChange(next)
  }

  const remove = () => {
    setPreview(null)
    onChange(null)
    setRejected('')
  }

  const message = rejected || error

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-text">
        Photo <span className="font-normal text-text-muted">(optional)</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-secondary">
          {preview ? (
            <img src={preview} alt="Selected photo" className="absolute inset-0 size-full object-cover" />
          ) : (
            <span className="text-5xl" aria-hidden>
              {species === 'dog' ? '🐕' : '🐈'}
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<ImagePlus className="size-4" />}
              onClick={() => inputRef.current?.click()}
            >
              {file ? 'Change photo' : 'Choose photo'}
            </Button>
            {file && (
              <Button size="sm" variant="ghost" icon={<X className="size-4" />} onClick={remove}>
                Remove
              </Button>
            )}
          </div>
          <p className="truncate text-xs text-text-muted">{file ? file.name : 'JPG, PNG, WebP or GIF, up to 5 MB.'}</p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_TYPES.join(',')}
        hidden
        onChange={(e) => {
          const next = e.target.files?.[0]
          e.target.value = ''
          if (!next) return
          const problem = photoProblem(next)
          setRejected(problem)
          if (!problem) select(next)
        }}
      />
      {message && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}

interface PublishFormProps {
  petOptions: PetOptions
  onPublished: (pet: Pet) => void
  onSubmittingChange: (submitting: boolean) => void
}

function PublishForm({ petOptions, onPublished, onSubmittingChange }: PublishFormProps) {
  const [draft, setDraft] = useState<NewPet>(() => emptyDraft(petOptions))
  const [photo, setPhoto] = useState<File | null>(null)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState('')

  const update = <K extends keyof NewPet>(key: K, value: NewPet[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const changeSpecies = (species: Species) => {
    setDraft((prev) => ({ ...prev, species, breed: '' }))
    setErrors((prev) => ({ ...prev, breed: undefined }))
  }

  const changePhoto = (file: File | null) => {
    setPhoto(file)
    setErrors((prev) => ({ ...prev, photo: undefined }))
  }

  const toggleTrait = (trait: string) =>
    update('traits', draft.traits.includes(trait) ? draft.traits.filter((t) => t !== trait) : [...draft.traits, trait])

  const submit = async () => {
    const found = validate(draft)
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return

    onSubmittingChange(true)
    try {
      onPublished(await createPet(draft, photo))
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors as FieldErrors)
      else setFormError(err instanceof ApiError ? err.message : 'Could not publish. Please try again.')
    } finally {
      onSubmittingChange(false)
    }
  }

  const breedOptions = [
    { value: '', label: 'Choose a breed' },
    ...petOptions.breeds[draft.species].map((breed) => ({ value: breed, label: breed })),
  ]

  return (
    <form
      id={FORM_ID}
      noValidate
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {formError && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger">
          {formError}
        </p>
      )}

      <PhotoPicker file={photo} species={draft.species} error={errors.photo} onChange={changePhoto} />

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
          options={petOptions.species.map((value) => ({ value, label: SPECIES_LABELS[value] }))}
          value={draft.species}
          onChange={(e) => changeSpecies(e.target.value as Species)}
          error={errors.species}
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
          error={errors.age_years}
        />
        <SelectField
          label="Size"
          options={toOptions(petOptions.sizes)}
          value={draft.size}
          onChange={(e) => update('size', e.target.value as PetSize)}
          error={errors.size}
        />
        <SelectField
          label="Sex"
          options={toOptions(petOptions.sexes)}
          value={draft.sex}
          onChange={(e) => update('sex', e.target.value as PetSex)}
          error={errors.sex}
        />
        <SelectField
          label="City"
          options={petOptions.cities.map((city) => ({ value: city, label: city }))}
          value={draft.city}
          onChange={(e) => update('city', e.target.value)}
          error={errors.city}
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
          {petOptions.traits.map((trait) => {
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
        {errors.traits && <p className="text-sm text-danger">{errors.traits}</p>}
      </fieldset>

      <div className="flex flex-wrap gap-6">
        <Toggle label="Vaccinated" checked={draft.is_vaccinated} onChange={(value) => update('is_vaccinated', value)} />
        <Toggle label="Neutered" checked={draft.is_neutered} onChange={(value) => update('is_neutered', value)} />
      </div>
    </form>
  )
}

function PublishFormLoader(props: Omit<PublishFormProps, 'petOptions'>) {
  const [petOptions, setPetOptions] = useState<PetOptions | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let ignore = false
    getPetOptions()
      .then((data) => {
        if (!ignore) setPetOptions(data)
      })
      .catch(() => {
        if (!ignore) setFailed(true)
      })
    return () => {
      ignore = true
    }
  }, [retry])

  if (failed) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
        Could not load the form options.
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setFailed(false)
            setRetry((n) => n + 1)
          }}
        >
          Try again
        </Button>
      </div>
    )
  }

  if (!petOptions) return <p role="status" className="text-sm text-text-muted">Loading the form…</p>

  return <PublishForm petOptions={petOptions} {...props} />
}

interface PublishPetModalProps {
  open: boolean
  onClose: () => void
  onPublished: (pet: Pet) => void
}

export function PublishPetModal({ open, onClose, onPublished }: PublishPetModalProps) {
  const [submitting, setSubmitting] = useState(false)

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
          <Button type="submit" form={FORM_ID} disabled={submitting}>
            {submitting ? 'Publishing…' : 'Publish'}
          </Button>
        </>
      }
    >
      {open && <PublishFormLoader onPublished={onPublished} onSubmittingChange={setSubmitting} />}
    </Modal>
  )
}
