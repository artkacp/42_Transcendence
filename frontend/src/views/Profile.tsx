import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { ArrowLeft, Camera, Check, PawPrint, Trash2, UserMinus, UserPlus, X } from 'lucide-react'
import { ApiError } from '../api/client'
import { acceptFriendRequest, deleteFriendship, sendFriendRequest } from '../api/friends'
import { getPetOptions } from '../api/pets'
import { getUser, getUserPets, removeAvatar, updateMe, uploadAvatar } from '../api/users'
import { useAuth, type User as Me } from '../auth/auth-context'
import type { Pet, ProfileChanges, UserProfile } from '../data/types'
import { Avatar, Badge, Button, Card, EmptyState, Input, Textarea } from '../ds'
import { useToast } from '../contexts/toast/ToastContext'
import { navigate, useUserParam } from '../routing'
import { SelectField } from './PublishPetModal'

const MAX_AVATAR_MB = 2

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback)

function avatarProblem(file: File) {
  if (!file.type.startsWith('image/')) return 'Avatars must be an image file.'
  if (file.size > MAX_AVATAR_MB * 1024 * 1024) return `Avatars must be under ${MAX_AVATAR_MB} MB.`
  return ''
}

function OnlineLine({ user }: { user: UserProfile }) {
  return (
    <p className="text-sm text-text-muted">
      @{user.handle} ·{' '}
      {user.is_online ? <span className="font-semibold text-on-secondary">online now</span> : 'offline'}
    </p>
  )
}

// ── own profile ─────────────────────────────────────────────────────────

function AvatarEditor({ me }: { me: Me }) {
  const { updateUser } = useAuth()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  // The previous avatar stays until the server accepts the new one
  const save = async (request: () => Promise<Me>, message: string, failure: string) => {
    setBusy(true)
    try {
      updateUser(await request())
      toast({ kind: 'update', title: 'Profile updated', message })
    } catch (err) {
      const reason = err instanceof ApiError ? err.fieldErrors.avatar ?? err.message : 'Please try again.'
      toast({ kind: 'delete', title: failure, message: reason })
    } finally {
      setBusy(false)
    }
  }

  const pick = (file: File) => {
    const problem = avatarProblem(file)
    if (problem) toast({ kind: 'delete', title: 'Avatar rejected', message: problem })
    else void save(() => uploadAvatar(file), 'Your avatar was updated.', 'Avatar rejected')
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative">
        <Avatar name={me.full_name} src={me.avatar} size="xl" online />
        <button
          type="button"
          aria-label="Change avatar"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="absolute -right-1 -bottom-1 flex size-9 cursor-pointer items-center justify-center rounded-full bg-primary text-on-primary transition-transform hover:scale-110 hover:bg-primary-hover focus-visible:outline-none focus-gradient disabled:cursor-default disabled:opacity-60"
        >
          <Camera className="size-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) pick(file)
          }}
        />
      </div>
      <div>
        <p className="font-display text-2xl font-bold">{me.full_name}</p>
        <p className="text-sm text-text-muted">@{me.handle}</p>
        {me.avatar && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Trash2 className="size-3.5" />}
            className="mt-2"
            disabled={busy}
            onClick={() => void save(removeAvatar, 'Your avatar was removed.', 'Could not remove avatar')}
          >
            Remove avatar
          </Button>
        )}
      </div>
    </div>
  )
}

const draftOf = (me: Me): ProfileChanges => ({ full_name: me.full_name, city: me.city, bio: me.bio })

function ProfileForm({ me, cities }: { me: Me; cities: string[] }) {
  const { updateUser } = useAuth()
  const toast = useToast()
  const [draft, setDraft] = useState(() => draftOf(me))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const saved = draftOf(me)
  const changed = (Object.keys(draft) as (keyof ProfileChanges)[]).some((key) => draft[key] !== saved[key])
  const canSave = changed && draft.full_name.trim().length >= 2 && !saving

  const update = <K extends keyof ProfileChanges>(key: K, value: ProfileChanges[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  const submit = async () => {
    setSaving(true)
    try {
      const next = await updateMe({ ...draft, full_name: draft.full_name.trim() })
      updateUser(next)
      setDraft(draftOf(next))
      toast({ kind: 'update', title: 'Profile updated', message: 'Your profile changes were saved.' })
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) setErrors(err.fieldErrors)
      else toast({ title: 'Could not save your profile', message: errorText(err, 'Please try again.') })
    } finally {
      setSaving(false)
    }
  }

  const cityOptions = [{ value: '', label: 'No city' }, ...cities.map((city) => ({ value: city, label: city }))]

  return (
    <form
      noValidate
      className="mt-6 space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <Input
        label="Display name"
        maxLength={100}
        value={draft.full_name}
        onChange={(e) => update('full_name', e.target.value)}
        error={errors.full_name}
      />
      <SelectField
        label="City"
        options={cityOptions}
        value={draft.city ?? ''}
        onChange={(e) => update('city', e.target.value || null)}
        error={errors.city}
      />
      <Textarea
        label="About you"
        value={draft.bio}
        onChange={(e) => update('bio', e.target.value)}
        error={errors.bio}
      />
      <Button type="submit" disabled={!canSave}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}

function OwnProfile({ me }: { me: Me }) {
  const [cities, setCities] = useState<string[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPetOptions()
      .then((options) => {
        if (!cancelled) setCities(options.cities)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err, 'Could not load the form options.'))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-black tracking-tight">Your profile</h1>
        <Button size="sm" variant="secondary" onClick={() => navigate('activity')}>
          Your activity
        </Button>
      </div>
      <Card className="p-6">
        <AvatarEditor me={me} />
        {error ? (
          <p role="alert" className="mt-6 rounded-2xl bg-danger-soft px-4 py-2 text-sm text-danger">
            {error}
          </p>
        ) : cities === null ? (
          <p role="status" className="mt-6 text-sm text-text-muted">Loading your profile…</p>
        ) : (
          <ProfileForm me={me} cities={cities} />
        )}
      </Card>
    </div>
  )
}

// ── other users ─────────────────────────────────────────────────────────

interface FriendActionProps {
  user: UserProfile
  onChanged: () => void
  size?: ComponentProps<typeof Button>['size']
}

export function FriendAction({ user, onChanged, size }: FriendActionProps) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<{ from: typeof user.friendship; to: typeof user.friendship } | null>(null)
  // The result of an action applies only until the refetched friendship arrives
  const friendship = local?.from === user.friendship ? local.to : user.friendship
  const firstName = user.full_name.split(' ')[0]

  const run = async (
    request: () => Promise<unknown>,
    next: typeof user.friendship,
    title: string,
    message: string,
  ) => {
    setBusy(true)
    try {
      await request()
      setLocal({ from: user.friendship, to: next })
      toast({ kind: 'update', title, message })
    } catch (err) {
      toast({ title: 'Could not update friendship', message: errorText(err, 'Please try again.') })
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  if (!friendship) {
    const addFriend = async () => {
      setBusy(true)
      try {
        const result = await sendFriendRequest(user.id)
        setLocal({ from: user.friendship, to: { id: result.id, status: result.status, requested_by_me: true } })
        toast({ kind: 'update', title: 'Friend request sent', message: `${firstName} will see your request.` })
        onChanged()
      } catch (err) {
        toast({ title: 'Could not update friendship', message: errorText(err, 'Please try again.') })
      } finally {
        setBusy(false)
      }
    }
    return (
      <Button
        size={size}
        icon={<UserPlus className="size-4" />}
        disabled={busy}
        aria-label={`Add friend ${user.full_name}`}
        onClick={() => void addFriend()}
      >
        Add friend
      </Button>
    )
  }

  const remove = (title: string, message: string) => () => void run(() => deleteFriendship(friendship.id), null, title, message)

  if (friendship.status === 'accepted') {
    return (
      <Button size={size} variant="ghost" icon={<UserMinus className="size-4" />} disabled={busy} aria-label={`Remove friend ${user.full_name}`} onClick={remove('Friend removed', `${firstName} is no longer your friend.`)}>
        Remove friend
      </Button>
    )
  }

  if (friendship.requested_by_me) {
    return (
      <Button size={size} variant="ghost" icon={<X className="size-4" />} disabled={busy} aria-label={`Cancel request to ${user.full_name}`} onClick={remove('Request cancelled', `Your request to ${firstName} was withdrawn.`)}>
        Cancel request
      </Button>
    )
  }

  return (
    <>
      <Button
        size={size}
        icon={<Check className="size-4" />}
        disabled={busy}
        aria-label={`Accept request from ${user.full_name}`}
        onClick={() => void run(() => acceptFriendRequest(friendship.id), { ...friendship, status: 'accepted' }, 'Friend added', `You and ${firstName} are now friends.`)}
      >
        Accept request
      </Button>
      <Button size={size} variant="ghost" icon={<X className="size-4" />} disabled={busy} aria-label={`Decline ${user.full_name}`} onClick={remove('Request declined', `You declined ${firstName}'s request.`)}>
        Decline
      </Button>
    </>
  )
}

function RehomingPets({ pets }: { pets: Pet[] }) {
  return (
    <Card className="p-6">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
        <PawPrint className="size-4 text-primary" aria-hidden /> Pets they are rehoming
      </h2>
      <div className="flex flex-wrap gap-3">
        {pets.map((pet) => (
          // TODO(F3): link each tile to the pet page once it exists
          <div key={pet.id} className="flex items-center gap-2.5 rounded-2xl bg-secondary py-2 pr-4 pl-2.5">
            {pet.photo ? (
              <img src={pet.photo} alt="" className="size-8 rounded-xl object-cover" />
            ) : (
              <span className="text-2xl" aria-hidden>
                {pet.species === 'dog' ? 'U・ᴥ・U' : '=^ ◗ ◗^='}
              </span>
            )}
            <span className="text-left">
              <span className="block text-sm font-semibold">{pet.name}</span>
              <span className="block text-[11px] text-text-muted">{pet.breed}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  )
}

function OtherProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [pets, setPets] = useState<Pet[]>([])
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.all([getUser(userId), getUserPets(userId)])
      .then(([profile, listings]) => {
        if (cancelled) return
        setUser(profile)
        setPets(listings)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof ApiError && err.status === 404 ? 'This user does not exist.' : errorText(err, 'Could not load this profile.'))
      })
    return () => {
      cancelled = true
    }
  }, [userId, reload])

  if (error) return <EmptyState emoji="≧◒_◒≦" title="Profile not available" hint={error} />
  if (!user) return <p role="status" className="text-sm text-text-muted">Loading profile…</p>

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" icon={<ArrowLeft className="size-4" />} onClick={() => window.history.back()}>
        Back
      </Button>
      <Card className="p-8 text-center">
        <div className="flex flex-col items-center gap-3">
          <Avatar name={user.full_name} src={user.avatar} size="xl" online={user.is_online} />
          <div>
            <h1 className="font-display text-3xl font-black">{user.full_name}</h1>
            <OnlineLine user={user} />
          </div>
          {user.city && <Badge>{user.city}</Badge>}
          {user.bio && <p className="max-w-md text-[15px] text-text">{user.bio}</p>}
          <div className="mt-2 flex gap-2">
            <FriendAction user={user} onChanged={() => setReload((n) => n + 1)} />
          </div>
        </div>
      </Card>
      {pets.length > 0 && <RehomingPets pets={pets} />}
    </div>
  )
}

export function Profile() {
  const { status, user } = useAuth()
  const userId = useUserParam()

  if (status === 'loading') return null

  if (status === 'signed-out' || !user) {
    return (
      <div className="p-8">
        <EmptyState
          emoji="(︶ᴥ ...   ･ﾟ✧"
          title="Sign in to see profiles"
          hint="Profiles are visible to signed-in members only."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  if (userId && userId !== user.id) return <OtherProfile key={userId} userId={userId} />

  return <OwnProfile key={user.id} me={user} />
}
