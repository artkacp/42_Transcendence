import { useEffect, useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ApiError } from '../api/client'
import { deletePet, getMyPets } from '../api/pets'
import { useAuth } from '../auth/auth-context'
import type { Pet } from '../data/types'
import { Badge, Button, Card, EmptyState, Modal } from '../ds'
import { useToast } from '../contexts/toast/ToastContext'
import { navigate } from '../routing'
import { PublishPetModal } from './PublishPetModal'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const inquiryLabel = (count: number) => (count === 1 ? '1 inquiry' : `${count} inquiries`)

function PetThumb({ pet }: { pet: Pet }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
      {pet.photo ? (
        <img src={pet.photo} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="text-[11px] whitespace-nowrap" aria-hidden>
          {pet.species === 'dog' ? 'U・ᴥ・U' : '=^ ◗ ◗^='}
        </span>
      )}
    </div>
  )
}

interface ListingsTableProps {
  pets: Pet[]
  busy: boolean
  onEdit: (pet: Pet) => void
  onRemove: (pet: Pet) => void
}

function RowActions({ pet, busy, onEdit, onRemove }: { pet: Pet } & Omit<ListingsTableProps, 'pets'>) {
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => navigate('pet', { id: pet.id })}>
        View & reply
      </Button>
      {!pet.adopted_by && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Pencil className="size-3.5" />}
          onClick={() => onEdit(pet)}
          aria-label={`Edit ${pet.name}`}
        >
          Edit
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        icon={<Trash2 className="size-3.5" />}
        disabled={busy}
        onClick={() => onRemove(pet)}
        aria-label={`Remove ${pet.name}`}
      >
        Remove
      </Button>
    </>
  )
}

// below sm: one card per listing instead of a sideways-scrolling table
function ListingsCards({ pets, busy, onEdit, onRemove }: ListingsTableProps) {
  return (
    <ul className="space-y-3 sm:hidden">
      {pets.map((pet) => (
        <li key={pet.id}>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <PetThumb pet={pet} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text">{pet.name}</p>
                <p className="truncate text-xs text-text-muted">
                  {pet.breed} · {formatDate(pet.created_at)}
                </p>
              </div>
            </div>
            <Badge>{inquiryLabel(pet.inquiry_count)}</Badge>
            <div className="flex flex-wrap justify-end gap-2">
              <RowActions pet={pet} busy={busy} onEdit={onEdit} onRemove={onRemove} />
            </div>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function ListingsTable({ pets, busy, onEdit, onRemove }: ListingsTableProps) {
  return (
    <Card className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Pet</th>
            <th scope="col" className="px-5 py-3 font-medium">Breed</th>
            <th scope="col" className="px-5 py-3 font-medium">Listed</th>
            <th scope="col" className="px-5 py-3 font-medium">Status</th>
            <th scope="col" className="px-5 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pets.map((pet) => (
            <tr key={pet.id}>
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <PetThumb pet={pet} />
                  <span className="font-semibold text-text">{pet.name}</span>
                </div>
              </td>
              <td className="px-5 py-3 text-text-muted">{pet.breed}</td>
              <td className="px-5 py-3 text-text-muted">{formatDate(pet.created_at)}</td>
              <td className="px-5 py-3">
                <Badge>{inquiryLabel(pet.inquiry_count)}</Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-2">
                  <RowActions pet={pet} busy={busy} onEdit={onEdit} onRemove={onRemove} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function YourListings() {
  const toast = useToast()
  const [pets, setPets] = useState<Pet[] | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState(false)
  const [confirming, setConfirming] = useState<Pet | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [editing, setEditing] = useState<Pet | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMyPets()
      .then((data) => {
        if (!cancelled) setPets(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load your listings.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dropRow = (id: string) => setPets((prev) => prev && prev.filter((p) => p.id !== id))

  const removePet = async (pet: Pet) => {
    setRemoving(true)
    try {
      await deletePet(pet.id)
      dropRow(pet.id)
      toast({ kind: 'delete', title: 'Listing removed', message: `${pet.name} is no longer listed.` })
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        dropRow(pet.id)
        toast({ title: 'Already removed', message: `${pet.name} was not listed anymore.` })
      } else {
        toast({ title: 'Could not remove listing', message: err instanceof ApiError ? err.message : 'Please try again.' })
      }
    } finally {
      setRemoving(false)
      setConfirming(null)
    }
  }

  const openPublish = () => setPublishOpen(true)

  const handlePublished = (pet: Pet) => {
    setPublishOpen(false)
    setPets((prev) => [pet, ...(prev ?? [])])
    toast({ kind: 'create', title: 'Listing published', message: `${pet.name} is now listed for adoption.` })
  }

  const openEdit = (pet: Pet) => {
    setEditing(pet)
    setEditOpen(true)
  }

  const handleSaved = (pet: Pet) => {
    setEditOpen(false)
    setPets((prev) => prev && prev.map((p) => (p.id === pet.id ? { ...pet, inquiry_count: p.inquiry_count } : p)))
    toast({ kind: 'update', title: 'Listing updated', message: `Your changes to ${pet.name} were saved.` })
  }

  return (
    <div className="space-y-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">Your listings</h1>
          <p className="mt-1 text-sm text-text-muted">Pets you put up for adoption, and who asked about them.</p>
        </div>
        <Button icon={<Plus className="size-4" />} onClick={openPublish}>
          Rehome a pet
        </Button>
      </div>

      {error ? (
        <EmptyState emoji="≧◒_◒≦" title="Something went wrong" hint={error} />
      ) : pets === null ? (
        <p role="status" className="text-sm text-text-muted">Loading your listings…</p>
      ) : pets.length === 0 ? (
        <EmptyState
          emoji="︶ᴥ .. ･ﾟ✧"
          title="N° ･ﾟistings yet"
          hint="Publish your first pet and adopters will find them in Browse."
          action={<Button onClick={openPublish}>Rehome a pet</Button>}
        />
      ) : (
        <>
          <ListingsCards pets={pets} busy={removing} onEdit={openEdit} onRemove={setConfirming} />
          <ListingsTable pets={pets} busy={removing} onEdit={openEdit} onRemove={setConfirming} />
        </>
      )}
      {confirming && (
        <Modal
          open
          onClose={() => !removing && setConfirming(null)}
          title={`Remove ${confirming.name}?`}
          description="This permanently deletes the listing, its photo and every conversation about this pet, including messages and attachments. Anyone who asked about them will be notified. This can't be undone."
          footer={
            <>
              <Button variant="secondary" disabled={removing} onClick={() => setConfirming(null)}>
                Cancel
              </Button>
              <Button variant="danger" disabled={removing} onClick={() => void removePet(confirming)}>
                Remove listing
              </Button>
            </>
          }
        />
      )}
      <PublishPetModal open={publishOpen} onClose={() => setPublishOpen(false)} onPublished={handlePublished} />
      <PublishPetModal open={editOpen} pet={editing} onClose={() => setEditOpen(false)} onPublished={handleSaved} />
    </div>
  )
}

export function Rehome() {
  const { status, user } = useAuth()

  if (status === 'loading') return null

  if (status === 'signed-out') {
    return (
      <div className="sm:p-8">
        <EmptyState
          emoji="(︶ᴥ ...   ･ﾟ✧"
          title="Sign in to rehome a pet"
          hint="Your listings and the publish form live behind your account."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return <YourListings key={user?.id} />
}
