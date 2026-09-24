import { useState, type CSSProperties, type ReactNode } from 'react'
import { Heart, Plus, Trash2 } from 'lucide-react'
import { TOKEN_NAMES } from '../palettes/tokens'
import { Badge, Button, Card, IconButton, Progress } from '../ds'

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

/* ★ミ( ･)ﾉ TEMPORARY — crayon tone lab. Remove before the PR, together with
   the 'lab' tone in Progress.tsx.

   [░] → [▒] → [▓] → [█] (◔ ◑) HOW TO USE
   1. Click a bar to make that tone active — all four stay on screen so you
      judge each colour against its neighbours, not in isolation.
   2. Click one of the three swatches to pick which stop you are editing
      (start / middle / end).
   3. Click a palette preset to load that step, or drag L / C / H.
      Chroma is the pigment knob: 0.03-0.08 reads as crayon, above 0.12 it
      starts looking like a screen colour. Palette steps run hot because they
      were tuned for solid fills — expect to pull C down after loading one.
   4. Copy all puts the whole crayonStops block on the clipboard.

   OKLCH rather than a native colour picker: the picker is sRGB hex only, and
   there is no lossless way back. Sliders wear accent-text-subtle so the
   browser default blue does not fight the palette while you judge colour. */

type Triple = [number, number, number]
type LabTone = 'primary' | 'success' | 'warning' | 'danger'

const LAB_DEFAULTS: Record<LabTone, [Triple, Triple, Triple]> = {
  primary: [
    [0.855, 0.06, 218],
    [0.76, 0.065, 196],
    [0.935, 0.038, 190],
  ],
  success: [
    [0.94, 0.025, 122],
    [0.84, 0.05, 122],
    [0.595, 0.105, 122],
  ],
  warning: [
    [0.7, 0.14, 90],
    [0.88, 0.065, 90],
    [0.7, 0.14, 90],
  ],
  danger: [
    [0.82, 0.145, 35],
    [0.73, 0.16, 35],
    [0.6, 0.19, 35],
  ],
}

const LAB_TONES: LabTone[] = ['primary', 'success', 'warning', 'danger']

const LAB_PRESETS: [string, Triple][] = [
  ['cream-50', [0.965, 0.035, 85]],
  ['cream-200', [0.845, 0.065, 85]],
  ['terra-50', [0.935, 0.038, 190]],
  ['terra-100', [0.855, 0.06, 218]],
  ['terra-400', [0.6, 0.12, 218]],
  ['terra-500', [0.48, 0.135, 218]],
  ['sage-50', [0.945, 0.03, 121]],
  ['sage-100', [0.875, 0.065, 122]],
  ['sage-300', [0.735, 0.09, 122]],
  ['sage-500', [0.595, 0.105, 122]],
  ['honey-100', [0.945, 0.092, 90]],
  ['honey-400', [0.83, 0.12, 90]],
  ['honey-500', [0.7, 0.14, 90]],
  ['danger-100', [0.9, 0.12, 35]],
  ['danger-200', [0.82, 0.145, 35]],
  ['danger-300', [0.73, 0.16, 35]],
  ['danger-400', [0.6, 0.19, 35]],
]

const css = (s: Triple) => `oklch(${s[0]} ${s[1]} ${s[2]})`

function CrayonLab() {
  const [all, setAll] = useState(LAB_DEFAULTS)
  const [tone, setTone] = useState<LabTone>('primary')
  const [stop, setStop] = useState(0)
  const [v, setV] = useState(72)
  const [copied, setCopied] = useState(false)

  const stops = all[tone]
  const line = (t: LabTone) => `  ${t}: [${all[t].map((s) => `'${css(s)}'`).join(', ')}],`
  const block = LAB_TONES.map(line).join('\n')

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
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
      {/* All four bars, always visible. Click one to edit it. */}
      <div className="space-y-2">
        {LAB_TONES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTone(t)}
            aria-label={`Edit ${t}`}
            className={`block w-full rounded-lg p-1 text-left ${tone === t ? 'bg-surface-raised' : ''}`}
          >
            <span className="mb-0.5 block font-mono text-[10px] text-text-subtle">{t}</span>
            <Progress
              value={v}
              variant="crayon"
              tone="lab"
              label={`${t} preview`}
              style={
                {
                  '--lab-a': css(all[t][0]),
                  '--lab-b': css(all[t][1]),
                  '--lab-c': css(all[t][2]),
                } as CSSProperties
              }
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

      {/* Which stop of the active tone the sliders and presets write to. */}
      <div className="flex items-center gap-2">
        {stops.map((s, i) => (
          <button
            key={stopNames[i]}
            type="button"
            onClick={() => setStop(i)}
            title={stopNames[i]}
            aria-label={`Edit ${stopNames[i]} stop`}
            className={`size-8 rounded border ${stop === i ? 'border-text' : 'border-border'}`}
            style={{ backgroundColor: css(s) }}
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
              style={{ backgroundColor: css(preset) }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={copy}>
          {copied ? 'Copied' : 'Copy all'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAll(LAB_DEFAULTS)}>
          Reset
        </Button>
      </div>

      <pre className="overflow-x-auto rounded border border-border bg-surface p-2 font-mono text-[10px] text-text-muted">
        {block}
      </pre>
    </div>
  )
}
/* ★ミ( ･)ﾉ TEMPORARY — crayon tone lab END */

export function DesignSystem() {
  return (
    <div className="max-w-3xl px-6 py-8">
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

      <Section title="Progress">
        {/* [░] → [▒] → [▓] → [█] (◔ ◑) FILL — value is the only knob.
            0 empty · 50 half · 100 full · anything above 100 clamps to 100.
            Showcase values are fixed on purpose: a living style guide shows
            states, it does not let the reader change them. */}
        <Row label="Tones">
          <div className="w-full max-w-sm space-y-3">
            <Progress value={100} label="Upload progress" />
            <Progress value={72} tone="success" label="Complete" />
            <Progress value={18} tone="danger" label="Failed upload" />
          </div>
        </Row>

        {/* ★ミ( ･)ﾉ NOTE: this row overrides --gradient-warning with the danger
            gradient inline, so the bars read red while the tone says warning.
            Drop the style block once warning has its own tuned gradient. */}
        <Row label="Edge values — clamped">
          <div className="w-full max-w-sm space-y-3">
            {[
              { value: 0, label: 'Not started' },
              { value: 1, label: 'Barely started' },
              { value: 3, label: 'Just started' },
              { value: 100, label: 'Done' },
              { value: 150, label: 'Over 100, clamped' },
            ].map(({ value, label }) => (
              <Progress
                key={label}
                value={value}
                tone="warning"
                label={label}
                style={
                  {
                    '--gradient-warning': 'var(--gradient-danger)',
                  } as CSSProperties
                }
              />
            ))}
          </div>
        </Row>

        {/* ★ミ( ･)ﾉ crayon variant — start
            [░] → [▒] → [▓] → [█] (◔ ◑) Set value per bar to inspect the fill:
            [░] value={3}    entry ramp and the left rounded end
            [▒] value={35}   leading edge mid-groove, skew clearly visible
            [▓] value={72}   most of the hatching, right end still open
            [█] value={100}  full groove, both ends closed
            The hatching is rolled once per mounted bar, so changing value
            moves the edge over stationary strokes — they never re-scatter. */}
        <Row label="Crayon variant">
          <div className="w-full max-w-sm space-y-3">
            <Progress value={100} variant="crayon" label="Crayon, primary" />
            <Progress value={100} variant="crayon" tone="success" label="Crayon, success" />
            <Progress value={108} variant="crayon" tone="warning" label="Crayon, warning" />
            <Progress value={100} variant="crayon" tone="danger" label="Crayon, danger" />
          </div>
        </Row>

        {/* ★ミ( ･)ﾉ TEMPORARY tone lab — remove before the PR */}
        <Row label="Tone lab — scratch">
          <CrayonLab />
        </Row>
        {/* ★ミ( ･)ﾉ crayon variant — end */}
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