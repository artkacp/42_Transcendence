import { useEffect, useRef, useState } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { SlidersHorizontal, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { getPlatformAnalytics, type AnalyticsResponse, type AnalyticsFilters } from '../api/analytics'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/auth-context'
import { useSocketFrame, useSocketReconnect, useSocketSend } from '../socket/SocketContext'
import { CITIES, BREEDS_BY_SPECIES, ALL_TRAITS, AGE_BUCKETS } from '../data/constants'
import type { Species } from '../data/types'
import { Button, Card, Chip, Select, EmptyState, Input, Badge } from '../ds'
import { navigate } from '../routing'

const C1 = 'var(--color-chart-1)'
const C2 = 'var(--color-chart-2)'
const C3 = 'var(--color-chart-3)'
const C1_FILL = 'var(--color-chart-1-fill)'
const C2_FILL = 'var(--color-chart-2-fill)'
const GRID = 'var(--color-border)'
const AXIS_TICK = 'var(--color-text-subtle)'
const DELTA_UP = 'var(--color-success)'
const DELTA_DOWN = 'var(--color-danger)'

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return String(n)
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatPct(delta: number | null): string {
  if (delta == null) return '—'
  const abs = Math.abs(delta).toFixed(0)
  return `${delta >= 0 ? '+' : '−'}${abs}%`
}

const formatLabel = (l: unknown) => (typeof l === 'string' ? formatDate(l) : '')

// KPI tile
function KpiTile({ label, value, delta }: { label: string; value: number; delta: number | null }) {
  const isUp = delta != null && delta > 0
  const isFlat = delta == null || delta === 0
  const color = isFlat ? AXIS_TICK : isUp ? DELTA_UP : DELTA_DOWN

  return (
    <Card className="flex flex-col gap-1 p-5">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <span className="font-display text-3xl font-bold tabular-nums text-text">
        {formatK(value)}
      </span>
      <span
        className="flex items-center gap-1 text-xs font-semibold"
        style={{ color }}
        aria-label={`${formatPct(delta)} vs previous period`}
      >
        {isFlat ? (
          <Minus className="size-3" aria-hidden />
        ) : isUp ? (
          <TrendingUp className="size-3" aria-hidden />
        ) : (
          <TrendingDown className="size-3" aria-hidden />
        )}
        {formatPct(delta)} vs prev period
      </span>
    </Card>
  )
}

// ChartCard wrapper
function ChartCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`p-5 ${className}`}>
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-text-muted">{subtitle}</p>}
      </div>
      {children}
    </Card>
  )
}

//  Shared axis / grid props 
const axisProps = {
  tick: { fill: AXIS_TICK, fontSize: 11 },
  axisLine: false as const,
  tickLine: false as const,
}

function XDateAxis() {
  return (
    <XAxis
      dataKey="date"
      tickFormatter={formatDate}
      {...axisProps}
      interval="preserveStartEnd"
    />
  )
}

function YCountAxis() {
  return <YAxis tickFormatter={formatK} width={36} {...axisProps} />
}

const gridProps = {
  stroke: GRID,
  strokeWidth: 1,
  vertical: false,
}

//  Main view
export function Analytics() {
  const { status } = useAuth()

  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [species, setSpecies] = useState<Species | ''>('')
  const [sex, setSex] = useState('')
  const [size, setSize] = useState('')
  const [ageBucket, setAgeBucket] = useState('')
  const [city, setCity] = useState('')
  const [breed, setBreed] = useState('')
  const [trait, setTrait] = useState('')
  const [vaccinated, setVaccinated] = useState(false)
  const [neutered, setNeutered] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [data, setData] = useState<AnalyticsResponse | null>(null)
  const [settledKey, setSettledKey] = useState('')
  const [errorKey, setErrorKey] = useState('')
  const [retry, setRetry] = useState(0)

  const requestKey = JSON.stringify([start, end, species, sex, size, ageBucket, city, breed, trait, vaccinated, neutered, retry])
  const loading = settledKey !== requestKey && status === 'signed-in'
  const error = errorKey === requestKey

  const send = useSocketSend()

  // Join the analytics group while on this page; leave on unmount
  useEffect(() => {
    send({ type: 'analytics.subscribe' })
    return () => { send({ type: 'analytics.unsubscribe' }) }
  }, [send])

  // Live updates: refetch on analytics.ping (opt-in group above)
  // and on reconnect (catches missed events + re-joins the group). 60s interval covers page visits.
  // Pings are throttled: the first one starts a 2s window, the rest of the burst joins that one refetch
  const pingTimer = useRef<number | undefined>(undefined)
  useSocketFrame('analytics.ping', () => {
    if (pingTimer.current !== undefined) return
    pingTimer.current = window.setTimeout(() => {
      pingTimer.current = undefined
      setRetry((r) => r + 1)
    }, 2_000)
  })
  useEffect(() => () => window.clearTimeout(pingTimer.current), [])
  useSocketReconnect(() => {
    send({ type: 'analytics.subscribe' })
    setRetry((r) => r + 1)
  })
  useEffect(() => {
    if (status !== 'signed-in') return
    const id = setInterval(() => setRetry((r) => r + 1), 60_000)
    return () => clearInterval(id)
  }, [status])

  const breedOptions =
    species === 'dog' || species === 'cat'
      ? BREEDS_BY_SPECIES[species]
      : [...BREEDS_BY_SPECIES.dog, ...BREEDS_BY_SPECIES.cat]

  const activeFilterCount =
    [sex, size, ageBucket, city, breed, trait].filter(Boolean).length +
    (vaccinated ? 1 : 0) +
    (neutered ? 1 : 0)

  useEffect(() => {
    if (status !== 'signed-in') return
    let ignore = false

    const filters: AnalyticsFilters = {}
    if (start) filters.start = start
    if (end) filters.end = end
    if (species) filters.species = species
    if (sex) filters.sex = sex
    if (size) filters.size = size
    if (ageBucket) filters.age_bucket = ageBucket
    if (city) filters.city = city
    if (breed) filters.breed = breed
    if (trait) filters.trait = trait
    if (vaccinated) filters.vaccinated = true
    if (neutered) filters.neutered = true

    getPlatformAnalytics(filters)
      .then((res) => {
        if (!ignore) { setData(res); setSettledKey(requestKey) }
      })
      .catch((err) => {
        if (!ignore) {
          if (!(err instanceof ApiError && err.status === 401)) setErrorKey(requestKey)
          else setSettledKey(requestKey)
        }
      })

    return () => {
      ignore = true
    }
  }, [status, requestKey, start, end, species, sex, size, ageBucket, city, breed, trait, vaccinated, neutered])

  if (status !== 'signed-in') {
    return (
      <div className="p-8">
        {status === 'loading' ? (
          <p className="py-16 text-center text-sm text-text-muted">Loading…</p>
        ) : (
          <EmptyState
            emoji="🔒"
            title="Sign in to view analytics"
            hint="Platform analytics are for members only."
            action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
          />
        )}
      </div>
    )
  }

  const charts = data?.charts
  const kpis = data?.kpis

  return (
    <div className="space-y-6 p-8">
      {/* ── header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-tight">
            Platform <span className="text-primary">analytics</span>.
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Adoption activity, engagement, and community trends.
          </p>
        </div>
        {loading && data && (
          <Badge className="text-xs">Refreshing…</Badge>
        )}
      </div>

      {/* ── filters ── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={start}
            max={end || undefined}
            onChange={(e) => setStart(e.target.value)}
            aria-label="Start date"
            className="w-auto text-sm"
          />
          <span className="text-xs text-text-muted">to</span>
          <Input
            type="date"
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
            aria-label="End date"
            className="w-auto text-sm"
          />
          <div className="flex items-center gap-2 ml-1">
            <Chip active={species === ''} onClick={() => { setSpecies(''); setBreed('') }}>
              All species
            </Chip>
            <Chip active={species === 'dog'} onClick={() => { setSpecies('dog'); setBreed('') }}>
              🐶 Dogs
            </Chip>
            <Chip active={species === 'cat'} onClick={() => { setSpecies('cat'); setBreed('') }}>
              🐱 Cats
            </Chip>
          </div>
          <Button
            size="sm"
            variant="ghost"
            icon={<SlidersHorizontal className="size-4" />}
            onClick={() => setFiltersOpen(!filtersOpen)}
            aria-expanded={filtersOpen}
            aria-controls="analytics-filters"
          >
            {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
          </Button>
        </div>

        {filtersOpen && (
          <div id="analytics-filters" className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="Sex"
              options={[
                { value: '', label: 'Any sex' },
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
              ]}
              value={sex}
              onChange={(e) => setSex(e.target.value)}
            />
            <Select
              aria-label="Size"
              options={[
                { value: '', label: 'Any size' },
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
            <Select
              aria-label="Age"
              options={[
                { value: '', label: 'Any age' },
                ...AGE_BUCKETS.filter((b) => b.id !== 'all').map((b) => ({
                  value: b.id,
                  label: b.label,
                })),
              ]}
              value={ageBucket}
              onChange={(e) => setAgeBucket(e.target.value)}
            />
            <Select
              aria-label="City"
              options={[
                { value: '', label: 'Any city' },
                ...CITIES.map((c) => ({ value: c, label: c })),
              ]}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Select
              aria-label="Breed"
              options={[
                { value: '', label: 'Any breed' },
                ...breedOptions.map((b) => ({ value: b, label: b })),
              ]}
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
            />
            <Select
              aria-label="Trait"
              options={[
                { value: '', label: 'Any trait' },
                ...ALL_TRAITS.map((t) => ({ value: t, label: t })),
              ]}
              value={trait}
              onChange={(e) => setTrait(e.target.value)}
            />
            <Chip active={vaccinated} onClick={() => setVaccinated(!vaccinated)}>
              💉 Vaccinated
            </Chip>
            <Chip active={neutered} onClick={() => setNeutered(!neutered)}>
              ✂️ Neutered
            </Chip>
          </div>
        )}
      </div>

      {/* ── error / loading skeleton ── */}
      {error && (
        <EmptyState
          emoji="😿"
          title="Couldn't load analytics"
          hint="Something went wrong fetching data. Try again."
          action={
            <Button variant="secondary" onClick={() => setRetry((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      )}

      {!error && !data && (
        <p className="py-16 text-center text-sm text-text-muted">Loading analytics…</p>
      )}

      {!error && data && (
        <div className={`space-y-6 ${loading ? 'opacity-60 pointer-events-none' : ''}`} aria-busy={loading}>

          {/* ── KPI row ── */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiTile label="Listing visits" value={kpis!.listing_visits.value} delta={kpis!.listing_visits.delta_pct} />
            <KpiTile label="Applications" value={kpis!.applications.value} delta={kpis!.applications.delta_pct} />
            <KpiTile label="Adoptions" value={kpis!.adoptions.value} delta={kpis!.adoptions.delta_pct} />
            <KpiTile label="Messages" value={kpis!.messages.value} delta={kpis!.messages.delta_pct} />
          </div>

          {/* ── charts ── */}
          <div className="grid gap-6 xl:grid-cols-2">

            {/* 1. listing visits over time */}
            <ChartCard title="Listing visits" className="xl:col-span-2">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts!.listing_visits_over_time}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v) => [formatK(Number(v ?? 0)), 'Visits']}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke={C1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 2. adoptions by species */}
            <ChartCard title="Adoptions by species">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={charts!.adoptions_by_species}
                  layout="vertical"
                  barCategoryGap="30%"
                >
                  <CartesianGrid {...gridProps} horizontal={false} vertical />
                  <XAxis type="number" tickFormatter={formatK} {...axisProps} />
                  <YAxis type="category" dataKey="species" width={44} {...axisProps} />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v) => [formatK(Number(v ?? 0)), 'Adoptions']}
                  />
                  <Bar dataKey="count" fill={C1} radius={[0, 4, 4, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 3. offers over time (running total of published listings) */}
            <ChartCard
              title="Listings published"
              subtitle={`Running total${charts!.offers_over_time.length > 0 ? ` · ${formatK(charts!.offers_over_time[charts!.offers_over_time.length - 1]?.running_total ?? 0)} cumulative` : ''}`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts!.offers_over_time}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v, name) => [
                      formatK(Number(v ?? 0)),
                      name === 'running_total' ? 'Cumulative' : 'Daily new',
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="running_total"
                    stroke={C1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 4. users over time */}
            <ChartCard title="User activity" subtitle="Active users and new sign-ups">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts!.users_over_time}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v, name) => [
                      formatK(Number(v ?? 0)),
                      name === 'active_users' ? 'Active users' : 'New sign-ups',
                    ]}
                  />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    formatter={(name) => (name === 'active_users' ? 'Active users' : 'New sign-ups')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="active_users"
                    stroke={C1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="new_signups"
                    stroke={C2}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 5. seekers vs rehomers */}
            <ChartCard title="Seekers vs rehomers" subtitle="Users by primary activity">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={charts!.seekers_vs_rehomers}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v, name) => [
                      formatK(Number(v ?? 0)),
                      name === 'seekers' ? 'Seekers' : 'Rehomers',
                    ]}
                  />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    formatter={(name) => (name === 'seekers' ? 'Seekers' : 'Rehomers')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="seekers"
                    stroke={C1}
                    strokeWidth={2}
                    fill={C1_FILL}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rehomers"
                    stroke={C2}
                    strokeWidth={2}
                    fill={C2_FILL}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 6. applications per adopted pet */}
            <ChartCard
              title="Applications per adoption"
              subtitle={(() => {
                const avg = charts!.applications_per_adopted_pet.average
                return avg != null
                  ? `Distribution · avg ${avg.toFixed(1)} applications`
                  : 'Distribution · no adoptions yet'
              })()}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={charts!.applications_per_adopted_pet.distribution}
                  barCategoryGap="20%"
                >
                  <CartesianGrid {...gridProps} />
                  <XAxis dataKey="bucket" {...axisProps} />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    formatter={(v) => [formatK(Number(v ?? 0)), 'Pets']}
                    labelFormatter={(l) => `${typeof l === 'string' ? l : ''} application${l === '1' ? '' : 's'}`}
                  />
                  <Bar dataKey="count" fill={C1} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  {(() => {
                    const avg = charts!.applications_per_adopted_pet.average
                    if (avg == null) return null
                    const dist = charts!.applications_per_adopted_pet.distribution
                    const last = dist[dist.length - 1]?.bucket ?? '1'
                    const avgKey = Math.round(avg) >= parseInt(last) ? last : String(Math.round(avg))
                    return (
                      <ReferenceLine
                        x={avgKey}
                        stroke={C2}
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        label={{ value: 'avg', position: 'top', fontSize: 10, fill: AXIS_TICK }}
                      />
                    )
                  })()}
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 7. applications vs adoptions */}
            <ChartCard title="Applications vs adoptions" subtitle="Conversion over time">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={charts!.applications_vs_adoptions}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v, name) => [
                      formatK(Number(v ?? 0)),
                      name === 'applications' ? 'Applications' : 'Adoptions',
                    ]}
                  />
                  <Legend
                    iconType="line"
                    iconSize={12}
                    formatter={(name) => (name === 'applications' ? 'Applications' : 'Adoptions')}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="applications"
                    stroke={C1}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="adoptions"
                    stroke={C3}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* 8. community messages */}
            <ChartCard title="Community messages">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={charts!.community_messages}>
                  <CartesianGrid {...gridProps} />
                  <XDateAxis />
                  <YCountAxis />
                  <Tooltip
                    contentStyle={{ fontSize: 12 }}
                    labelFormatter={formatLabel}
                    formatter={(v) => [formatK(Number(v ?? 0)), 'Messages']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={C1}
                    strokeWidth={2}
                    fill={C1_FILL}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-surface)' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

          </div>
        </div>
      )}
    </div>
  )
}
