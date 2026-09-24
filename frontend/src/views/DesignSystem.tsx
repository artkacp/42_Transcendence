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
   [░] → [▒] → [▓] → [█] (◔ ◑) Three colour pickers feed --lab-a/b/c, which
   the 'lab' tone reads as its gradient stops; the slider drives the fill.
   Tune here with the other bars in view, then paste the printed triple into
   crayonStops. Native colour inputs are sRGB hex — once a tone feels right,
   convert it to OKLCH in Progress.tsx and drop the chroma a notch: the same
   colour reads more like pigment and less like a screen. */
function CrayonLab() {
  const [a, setA] = useState('#CDE8EC')
  const [b, setB] = useState('#5EA7A7')
  const [c, setC] = useState('#A9D3E6')
  const [v, setV] = useState(72)
  return (
    <div className="w-full max-w-sm space-y-3">
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <input type="color" value={a} onChange={(e) => setA(e.target.value)} aria-label="Start colour" />
        <input type="color" value={b} onChange={(e) => setB(e.target.value)} aria-label="Middle colour" />
        <input type="color" value={c} onChange={(e) => setC(e.target.value)} aria-label="End colour" />
        <input
          type="range"
          min={0}
          max={100}
          value={v}
          onChange={(e) => setV(Number(e.target.value))}
          className="flex-1"
          aria-label="Fill amount"
        />
        <span className="w-8">{v}%</span>
      </div>
      <Progress
        value={v}
        variant="crayon"
        tone="lab"
        label="Tone lab"
        style={{ '--lab-a': a, '--lab-b': b, '--lab-c': c } as CSSProperties}
      />
      <p className="font-mono text-[10px] text-text-muted">
        {a} · {b} · {c}
      </p>
    </div>
  )
}

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