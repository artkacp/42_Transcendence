import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { getMyAnalytics, type UserAnalytics } from '../api/analytics'
import { navigate } from '../routing'
import { Button, Card, EmptyState } from '../ds'

const percentOf = (part: number, whole: number, of: string) =>
  whole === 0 ? undefined : `${Math.round((part / whole) * 100)}% of ${of}`

const isEmpty = (data: UserAnalytics) =>
  [...Object.values(data.as_seeker), ...Object.values(data.as_rehomer)].every((n) => n === 0)

function StatTile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="font-display text-3xl font-bold tabular-nums text-text">{value}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </Card>
  )
}

function ActivityStats({ data }: { data: UserAnalytics }) {
  const seeker = data.as_seeker
  const rehomer = data.as_rehomer

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">As an adopter</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <StatTile label="Pets viewed" value={seeker.pets_viewed} />
          <StatTile
            label="Applications sent"
            value={seeker.applications_sent}
            hint={percentOf(seeker.applications_sent, seeker.pets_viewed, 'pets viewed')}
          />
          <StatTile
            label="Adoptions completed"
            value={seeker.adoptions_completed}
            hint={percentOf(seeker.adoptions_completed, seeker.applications_sent, 'applications')}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">As a rehomer</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Listings published" value={rehomer.listings_published} />
          <StatTile label="Views received" value={rehomer.views_received} />
          <StatTile
            label="Inquiries received"
            value={rehomer.inquiries_received}
            hint={percentOf(rehomer.inquiries_received, rehomer.views_received, 'views')}
          />
          <StatTile
            label="Pets adopted out"
            value={rehomer.pets_adopted_out}
            hint={percentOf(rehomer.pets_adopted_out, rehomer.listings_published, 'listings')}
          />
        </div>
      </section>
    </div>
  )
}

export function Activity() {
  const { status } = useAuth()
  const [data, setData] = useState<UserAnalytics | null>(null)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (status !== 'signed-in') return
    let ignore = false
    getMyAnalytics()
      .then((res) => {
        if (!ignore) setData(res)
      })
      .catch(() => {
        if (!ignore) setError(true)
      })
    return () => {
      ignore = true
    }
  }, [status, retry])

  const tryAgain = () => {
    setError(false)
    setRetry((n) => n + 1)
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">
            Your <span className="text-primary">activity</span>.
          </h1>
          <p className="mt-1 text-sm text-text-muted">Your own numbers, all time.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => navigate('analytics')}>
          Platform analytics
        </Button>
      </div>

      {status === 'loading' ? (
        <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
      ) : status !== 'signed-in' ? (
        <EmptyState
          emoji="🔒"
          title="Sign in to see your activity"
          hint="Your stats are private and only visible to you."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      ) : error ? (
        <EmptyState
          emoji="😿"
          title="Could not load your activity"
          hint="Something went wrong on our side."
          action={<Button onClick={tryAgain}>Try again</Button>}
        />
      ) : data === null ? (
        <p role="status" className="py-16 text-center text-sm text-text-muted">Loading your activity…</p>
      ) : (
        isEmpty(data) ? (
          <EmptyState
            emoji="🐾"
            title="No activity yet"
            hint="Browse pets or list one for adoption, your numbers will show up here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate('browse')}>Browse pets</Button>
                <Button variant="secondary" onClick={() => navigate('rehome')}>
                  Rehome a pet
                </Button>
              </div>
            }
          />
        ) : (
          <ActivityStats data={data} />
        )
      )}
    </div>
  )
}
