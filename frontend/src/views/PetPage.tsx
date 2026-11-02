// src/views/PetPage.tsx
// F3a · one pet: loading → ready | error. F3b · "Ask about" opens the adopter's chat under the pet;
// the owner gets the inquiries for the pet instead.
import { useEffect, useState, type MouseEvent } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from '../ds'
import { getPet } from '../api/pets'
import { getMyInquiries, startInquiry } from '../api/inquiries'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { navigate, useIdParam, viewHref } from '../routing'
import type { Inquiry, Pet } from '../data/types'
import { useSocketFrame } from '../socket/SocketContext'
import { PetChat } from './PetChat'
import { PetInquiries } from './PetInquiries'

type Result = { id: string; pet: Pet } | { id: string; error: string }

function BackToBrowse() {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    navigate('browse')
  }
  return (
    <a
      href={viewHref('browse')}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text focus-visible:outline-1 focus-visible:outline-text"
    >
      <ArrowLeft className="size-4" />
      Back to Browse
    </a>
  )
}

function Message({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <BackToBrowse />
      <p role="alert" className="text-text-muted">
        <span aria-hidden="true" className="mr-1 font-logo">≧◉_◉≦</span>
        {text}
      </p>
    </div>
  )
}

export function PetPage() {
  const id = useIdParam()
  const { user } = useAuth()
  const [result, setResult] = useState<Result | null>(null)
  // kept with its pet id, so another pet's thread is never shown here
  const [inquiry, setInquiry] = useState<{ petId: string; inquiry: Inquiry } | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    getPet(id)
      .then((pet) => {
        if (!cancelled) setResult({ id, pet })
      })
      .catch((err) => {
        if (cancelled) return
        const gone = err instanceof ApiError && err.status === 404
        setResult({ id, error: gone ? 'This pet is not here anymore' : 'Could not load this pet' })
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const loaded = result && 'pet' in result && result.id === id ? result.pet : null
  // adopted pets too: the adopter still sees how their thread ended
  const canFind = !!user && !!loaded && loaded.owner.id !== user.id
  const loadedId = loaded?.id
  const loadedAdopted = !!loaded?.adopted_by

  // an earlier "Ask about" shows its chat right away. Errors stay silent: the button still works
  useEffect(() => {
    if (!canFind || !loadedId) return
    let cancelled = false
    getMyInquiries()
      .then((mine) => {
        const found = mine.find((inq) => inq.pet.id === loadedId)
        if (!cancelled && found) setInquiry({ petId: loadedId, inquiry: found })
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [canFind, loadedId])

  // "Already adopted" and the Ask button follow live; a second frame finds the pet already adopted
  useSocketFrame('pet.adopted', ({ pet_id }) => {
    if (pet_id !== loadedId || loadedAdopted) return
    getPet(pet_id)
      .then((pet) => setResult((r) => (r && r.id === id ? { id, pet } : r)))
      .catch(() => undefined)
  })

  const ask = (petId: string) => {
    setAsking(true)
    setAskError(null)
    startInquiry(petId)
      .then((inq) => setInquiry({ petId, inquiry: inq }))
      .catch((err) => setAskError(err instanceof ApiError ? err.message : 'Could not start the conversation'))
      .finally(() => setAsking(false))
  }

  if (!id) return <Message text="No pet selected" />
  // derived, not stored: an answer for another id means we are still loading
  if (!result || result.id !== id) {
    return <p role="status" className="text-text-muted">Loading…</p>
  }
  if ('error' in result) return <Message text={result.error} />

  const { pet } = result
  const mine = user?.id === pet.owner.id
  const myInquiry = inquiry?.petId === pet.id ? inquiry.inquiry : null

  return (
    <div className="flex flex-col gap-4">
      <BackToBrowse />
      <article className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-3xl bg-surface-raised">
          {pet.photo ? (
            <img src={pet.photo} alt={`${pet.name}, ${pet.breed}`} className="aspect-square w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="grid aspect-square place-items-center font-logo text-4xl text-text-subtle">
              ₍^◕◕^₎
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <header>
            <h1 className="font-display text-3xl font-bold tracking-tight text-text wrap-anywhere">{pet.name}</h1>
            <p className="text-text-muted">
              {pet.breed} · {pet.age_years} yr · {pet.sex} · {pet.size} · {pet.city}
            </p>
          </header>

          {pet.traits.length > 0 && (
            <ul aria-label="Traits" className="flex flex-wrap gap-2">
              {pet.traits.map((t) => (
                <li key={t} className="rounded-full bg-ink-900/5 px-3 py-1 text-xs font-medium text-text">
                  {t}
                </li>
              ))}
            </ul>
          )}

          {pet.story && <p className="whitespace-pre-line text-text wrap-anywhere">{pet.story}</p>}

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-text-muted">Vaccinated</dt>
            <dd className="text-text">{pet.is_vaccinated ? 'yes' : 'no'}</dd>
            <dt className="text-text-muted">Neutered</dt>
            <dd className="text-text">{pet.is_neutered ? 'yes' : 'no'}</dd>
            <dt className="text-text-muted">Listed by</dt>
            <dd className="text-text">{pet.owner.full_name}</dd>
          </dl>

          {pet.adopted_by ? (
            <p className="text-sm text-text-muted">Already adopted</p>
          ) : mine ? (
            <p className="text-sm text-text-muted">This is your listing</p>
          ) : myInquiry ? (
            <p className="text-sm text-text-muted">You asked about {pet.name}</p>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <Button type="button" disabled={asking} onClick={() => ask(pet.id)}>
                Ask about {pet.name}
              </Button>
              {askError && (
                <p role="alert" className="text-sm text-danger">
                  {askError}
                </p>
              )}
            </div>
          )}
        </div>
      </article>

      {myInquiry && <PetChat key={myInquiry.id} inquiry={myInquiry} />}
      {mine && <PetInquiries petId={pet.id} />}
    </div>
  )
}
