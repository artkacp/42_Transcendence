
import { useState, type ReactNode } from 'react'
import { Heart, Plus, Trash2 } from 'lucide-react'
import { TOKEN_NAMES } from '../palettes/tokens'
import { Badge, Button, Card, IconButton, Progress, Select, Chip, Toggle, Avatar, EmptyState} from '../ds'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-text mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-text-subtle mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

/* ★ミ( ･)ﾉ CRAYON TONE LAB — a keeper, not scratch.

   The lab stays in the design kit on purpose. Picking a crayon tone is not a
   one-off: the palette will move, the page background will move, and every
   time it does these three bars have to be judged again, side by side, on the
   real background. A screenshot cannot answer that; this can. It also answers
   the defence question "custom design system or shadcn" better than any
   component does — the tool that produced the colours ships with them.

   [░] → [▒] → [▓] → [█] (◔ ◑) HOW TO USE
   1. Toggle to Lab mode at the top of the page.
   2. Click a bar to make that tone active — all three stay on screen so you
      judge each colour against its neighbours, not in isolation.
   3. Click one of the three swatches to pick which stop you are editing
      (start / middle / end).
   4. Click a palette preset to load that step, or drag L / C / H.
      Chroma is the pigment knob: 0.03-0.08 reads as crayon, above 0.12 it
      starts looking like a screen colour. Palette steps run hot because they
      were tuned for solid fills — expect to pull C down after loading one.
   5. Save final copies a ready-to-paste block; paste the values over
      crayonStops in ds/Progress.tsx and update LAB_DEFAULTS below to match.

   WHY OKLCH AND NOT A COLOUR PICKER
   The native picker is sRGB hex only and there is no lossless way back. More
   importantly, in a picker saturation and lightness move together, so hitting
   the pigment range is guesswork. Here chroma is one slider.

   PRESETS mirror spaniel_in_dunes.css by hand. If the palette changes they
   drift — acceptable for a tuning aid, but worth a glance when the palette is
   next touched. */

type Triple = [number, number, number]
type LabTone = 'primary' | 'success' | 'danger'

/* Keep in sync with crayonStops in ds/Progress.tsx — the lab should always
   open on what actually ships. */
const LAB_DEFAULTS: Record<LabTone, [Triple, Triple, Triple]> = {
  primary: [
    [0.6, 0.12, 218],
    [0.855, 0.06, 218],
    [0.48, 0.135, 218],
  ],
  success: [
    [0.875, 0.065, 122],
    [0.6, 0.12, 218],
    [0.595, 0.105, 122],
  ],
  danger: [
    [0.82, 0.145, 35],
    [0.82, 0.145, 35],
    [0.385, 0.21, 35],
  ],
}

const LAB_TONES: LabTone[] = ['primary', 'success', 'danger']

const LAB_PRESETS: [string, Triple][] = [
  ['cream-50', [0.965, 0.035, 85]],
  ['cream-100', [0.895, 0.05, 85]],
  ['cream-200', [0.845, 0.065, 85]],
  ['cream-300', [0.775, 0.078, 88]],
  ['ink-400', [0.66, 0.026, 64]],
  ['ink-500', [0.555, 0.028, 64]],
  ['ink-700', [0.41, 0.028, 65]],
  ['ink-900', [0.3, 0.03, 64]],
  ['terra-50', [0.935, 0.038, 190]],
  ['terra-100', [0.855, 0.06, 218]],
  ['terra-400', [0.6, 0.12, 218]],
  ['terra-500', [0.48, 0.135, 218]],
  ['terra-600', [0.38, 0.12, 218]],
  ['sage-50', [0.945, 0.03, 121]],
  ['sage-100', [0.875, 0.065, 122]],
  ['sage-300', [0.735, 0.09, 122]],
  ['sage-500', [0.595, 0.105, 122]],
  ['sage-600', [0.38, 0.105, 122]],
  ['honey-100', [0.945, 0.092, 90]],
  ['honey-400', [0.83, 0.12, 90]],
  ['honey-500', [0.7, 0.14, 90]],
  ['honey-600', [0.55, 0.12, 90]],
  ['danger-100', [0.9, 0.12, 35]],
  ['danger-200', [0.82, 0.145, 35]],
  ['danger-300', [0.73, 0.16, 35]],
  ['danger-400', [0.6, 0.19, 35]],
  ['danger-500', [0.49, 0.21, 35]],
  ['danger-600', [0.385, 0.21, 35]],
]

const cssLab = (s: Triple) => `oklch(${s[0]} ${s[1]} ${s[2]})`

function CrayonLab() {
  const [all, setAll] = useState(LAB_DEFAULTS)
  const [tone, setTone] = useState<LabTone>('primary')
  const [stop, setStop] = useState(0)
  const [v, setV] = useState(100)
  const [saved, setSaved] = useState(false)

  const stops = all[tone]

  const finalBlock =
    'const crayonStops: Record<CrayonTone, [string, string, string]> = {\n' +
    LAB_TONES.map((t) => {
      const row = all[t].map((s) => `'${cssLab(s)}'`).join(', ')
      return `  ${t}: [${row}],`
    }).join('\n') +
    '\n}'

  const set = (k: 0 | 1 | 2, val: number) =>
    setAll((prev) => ({
      ...prev,
      [tone]: prev[tone].map((s, j) => (j === stop ? (s.map((x, m) => (m === k ? val : x)) as Triple) : s)) as [
        Triple,
        Triple,
        Triple,
      ],
    }))

  const load = (preset: Triple) =>
    setAll((prev) => ({
      ...prev,
      [tone]: prev[tone].map((s, j) => (j === stop ? preset : s)) as [Triple, Triple, Triple],
    }))

  const saveFinal = async () => {
    try {
      await navigator.clipboard.writeText(finalBlock)
      setSaved(true)
      window.setTimeout(() => setSaved(false), 1200)
    } catch {
      /* clipboard blocked — the block is printed below, select it by hand */
    }
  }

  const stopNames = ['start', 'middle', 'end']
  const ranges: [string, 0 | 1 | 2, number, number, number][] = [
    ['L', 0, 0.5, 1, 0.005],
    ['C', 1, 0, 0.2, 0.005],
    ['H', 2, 0, 360, 1],
  ]

  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="space-y-2">
        {LAB_TONES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTone(t)}
            aria-label={`Edit ${t}`}
            aria-pressed={tone === t}
            className={`block w-full rounded-lg p-1 text-left ${tone === t ? 'bg-surface-raised' : ''}`}
          >
            <span className="mb-0.5 block font-mono text-[10px] text-text-subtle">{t}</span>
            <Progress
              value={v}
              variant="crayon"
              crayonStopsOverride={[cssLab(all[t][0]), cssLab(all[t][1]), cssLab(all[t][2])]}
              label={`${t} preview`}
            />
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 text-xs text-text-muted">
        <input
          type="range"
          min={0}
          max={100}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          className="flex-1 accent-text-subtle"
          aria-label="Fill amount"
        />
        <span className="w-8">{v}%</span>
      </div>

      <div className="flex items-center gap-2">
        {stops.map((s, i) => (
          <button
            key={stopNames[i]}
            type="button"
            onClick={() => setStop(i)}
            title={stopNames[i]}
            aria-label={`Edit ${stopNames[i]} stop`}
            aria-pressed={stop === i}
            className={`size-8 rounded border ${stop === i ? 'border-text' : 'border-border'}`}
            style={{ backgroundColor: cssLab(s) }}
          />
        ))}
        <span className="font-mono text-[10px] text-text-subtle">
          {tone} · {stopNames[stop]}
        </span>
      </div>

      <div className="space-y-1">
        {ranges.map(([name, k, min, max, step]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="w-3 font-mono text-[10px] text-text-subtle">{name}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={stops[stop][k]}
              onChange={(e) => set(k, Number(e.target.value))}
              className="flex-1 accent-text-subtle"
              aria-label={`${tone} ${stopNames[stop]} ${name}`}
            />
            <span className="w-10 font-mono text-[10px] text-text-muted">{stops[stop][k]}</span>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-text-subtle">Load palette step</p>
        <div className="flex flex-wrap gap-1">
          {LAB_PRESETS.map(([name, preset]) => (
            <button
              key={name}
              type="button"
              onClick={() => load(preset)}
              title={name}
              aria-label={`Load ${name}`}
              className="size-6 rounded border border-border"
              style={{ backgroundColor: cssLab(preset) }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={saveFinal}>
          {saved ? 'Saved' : 'Save final'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAll(LAB_DEFAULTS)}>
          Reset
        </Button>
      </div>

      <pre className="overflow-x-auto rounded border border-border bg-surface p-2 font-mono text-[10px] text-text-muted">
        {finalBlock}
      </pre>
    </div>
  )
}

export function DesignSystem() {
  const [labMode, setLabMode] = useState(false)
  const [selectValue, setSelectValue] = useState('medium')
  const [toggleValue, setToggleValue] = useState(true)
  const [chipValue, setChipValue] = useState('dog')

  return (
    <div className="max-w-3xl px-6 py-8">
      {/* Label shows the CURRENT state, not the target — a button that reads
          "Final mode" while the lab is open is a coin flip to interpret. */}
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setLabMode((x) => !x)}
          aria-pressed={labMode}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            labMode ? 'bg-text text-surface' : 'bg-surface-raised text-text'
          }`}
        >
          {labMode ? 'Design lab' : 'Lab mode'}
        </button>
        <span className="text-xs text-text-muted">
          {labMode ? 'Tap to see the result' : 'Tap to tune the crayon tones'}
        </span>
      </div>

      <h1 className="font-display text-4xl text-text mb-8">Design system</h1>

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {TOKEN_NAMES.map((name) => (
            <div key={name}>
              <div
                className="h-12 rounded-xl border border-border"
                style={{ backgroundColor: `var(--color-${name})` }}
              />
              <p className="mt-1 text-[10px] text-text-muted">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-3xl text-text">Fraunces — display</p>
        <p className="font-sans text-base text-text mt-1">
          Outfit — body text. A calm senior cat looking for a reading corner.
        </p>
      </Section>

      <Section title="Button">
        <Row label="Variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </Row>

        <Row label="Sizes — geometry only, colour stays the same">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </Row>

        <Row label="Variants × sizes — independent axes">
          <Button size="sm" variant="secondary">Small secondary</Button>
          <Button size="md" variant="ghost">Medium ghost</Button>
          <Button size="lg" variant="danger">Large danger</Button>
        </Row>

        <Row label="With icon">
          <Button icon={<Plus size={16} />}>Rehome a pet</Button>
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />}>
            Remove
          </Button>
        </Row>

        <Row label="IconButton">
          <IconButton label="Add to favourites">
            <Heart size={18} />
          </IconButton>
          <IconButton label="Delete listing">
            <Trash2 size={18} />
          </IconButton>
        </Row>
      </Section>

      <Section title="Select">
        <Row label="Sizes">
          <Select
            aria-label="Example select"
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
            value={selectValue}
            onChange={(e) => setSelectValue(e.target.value)}
          />
        </Row>
      </Section>

      <Section title="Chip">
        <Row label="Selectable">
          <Chip active={chipValue === 'dog'} onClick={() => setChipValue('dog')}>
            🐕 Dogs
          </Chip>
          <Chip active={chipValue === 'cat'} onClick={() => setChipValue('cat')}>
            🐈 Cats
          </Chip>
        </Row>
      </Section>

      <Section title="Toggle">
        <Row label="States">
          <Toggle checked={toggleValue} onChange={setToggleValue} label="Vaccinated" />
          <Toggle checked={false} onChange={() => {}} label="Disabled example" disabled />
        </Row>
      </Section>

      <Section title="Avatar">
        <Row label="Sizes & states">
          <Avatar name="Artur Kacprzycki" size="sm" online />
          <Avatar name="Oleksiy Ostapenko" size="md" online />
          <Avatar name="Sarait Hernandez" size="lg" online />
          <Avatar name="Isshak" size="md" online={false} />
          <Avatar name="Faizan Khan" size="md" />
        </Row>
      </Section>

      <Section title="EmptyState">
        <Row label="Variants">
          <div className="w-full space-y-4">
            <EmptyState
              emoji="🔍"
              title="No pals match those filters"
              hint="Try clearing the search — someone fluffy is out there."
              action={<Button variant="secondary" size="sm">Clear filters</Button>}
            />
            <EmptyState title="Nothing here yet" />
          </div>
        </Row>
      </Section>

      <Section title="Progress">
        <Row label={labMode ? 'Crayon — tone lab' : 'Crayon — pastel'}>
          {labMode ? (
            <CrayonLab />
          ) : (
            <div className="w-full max-w-sm space-y-3">
              <Progress value={100} variant="crayon" label="Crayon, primary" />
              <Progress value={100} variant="crayon" tone="success" label="Crayon, success" />
              <Progress value={100} variant="crayon" tone="danger" label="Crayon, danger" />
            </div>
          )}
        </Row>
        <Row label="Crayon — edge values">
          <div className="w-full max-w-sm space-y-3">
            <Progress value={0} variant="crayon" label="Crayon, empty" />
            <Progress value={1} variant="crayon" label="Crayon, 1%" />
            <Progress value={1} variant="crayon" tone="danger" label="Crayon danger, 1%" />
          </div>
        </Row>
      </Section>

      <Section title="Badge">
        <Row label="Tones">
          <Badge>neutral</Badge>
          <Badge tone="success">adopted</Badge>
          <Badge tone="warning">pending</Badge>
          <Badge tone="danger">denied</Badge>
        </Row>
      </Section>

      <Section title="Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <p className="text-text mb-3">A plain surface.</p>
            <Button size="sm">Action</Button>
          </Card>
          <Card hover className="p-5">
            <p className="text-text mb-3">This one lifts on hover.</p>
            <Button size="sm" variant="secondary">Action</Button>
          </Card>
        </div>
      </Section>
    </div>
  )
}
