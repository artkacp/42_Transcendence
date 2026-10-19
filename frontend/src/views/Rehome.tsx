import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ApiError } from '../api/client'
import { deletePet, getMyPets } from '../api/pets'
import { useAuth } from '../auth/auth-context'
import type { Pet } from '../data/types'
import { Badge, Button, Card, EmptyState, useToast } from '../ds'
import { navigate } from '../routing'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

const inquiryLabel = (count: number) => (count === 1 ? '1 inquiry' : `${count} inquiries`)

function PetThumb({ pet }: { pet: Pet }) {
  return (
    <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
      {pet.photo ? (
        <img src={pet.photo} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="text-2xl" aria-hidden>
          {pet.species === 'dog' ? '🐕' : '🐈'}
        </span>
      )}
    </div>
  )
}

interface ListingsTableProps {
  pets: Pet[]
  busy: boolean
  onRemove: (pet: Pet) => void
}

function ListingsTable({ pets, busy, onRemove }: ListingsTableProps) {
  return (
    <Card className="overflow-x-auto">
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
                {pet.adopted_by ? (
                  <Badge tone="success">adopted 🎉</Badge>
                ) : (
                  <Badge>{inquiryLabel(pet.inquiry_count)}</Badge>
                )}
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="secondary" disabled title="Opens with the pet page">
                    View & reply
                  </Button>
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
    }
  }

  const openPublish = () => {}

  return (
    <div className="space-y-6 p-8">
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
        <EmptyState emoji="😿" title="Something went wrong" hint={error} />
      ) : pets === null ? (
        <p role="status" className="text-sm text-text-muted">Loading your listings…</p>
      ) : pets.length === 0 ? (
        <EmptyState
          emoji="🏡"
          title="No listings yet"
          hint="Publish your first pet and adopters will find them in Browse."
          action={<Button onClick={openPublish}>Rehome a pet</Button>}
        />
      ) : (
        <ListingsTable pets={pets} busy={removing} onRemove={removePet} />
      )}
    </div>
  )
}

export function Rehome() {
  const { status, user } = useAuth()

  if (status === 'loading') return null

  if (status === 'signed-out') {
    return (
      <div className="p-8">
        <EmptyState
          emoji="🔒"
          title="Sign in to rehome a pet"
          hint="Your listings and the publish form live behind your account."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return <YourListings key={user?.id} />
}
