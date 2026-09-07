import type { ReactNode } from 'react'
import { Heart, Plus, Trash2 } from 'lucide-react'
import { Badge, Button, Card, IconButton } from '../ds'

const TOKENS = [
  'cream-50', 'cream-100', 'cream-200', 'cream-300',
  'ink-900', 'ink-700', 'ink-500', 'ink-400',
  'terra-50', 'terra-100', 'terra-400', 'terra-500', 'terra-600',
  'sage-50', 'sage-100', 'sage-500', 'sage-600',
  'honey-100', 'honey-400',
  'danger-100', 'danger-600',
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-ink-900 mb-4">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="text-xs uppercase tracking-wide text-ink-400 mb-2">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export function DesignSystem() {
  return (
    <div className="max-w-3xl px-6 py-8">
      <h1 className="font-display text-4xl text-ink-900 mb-8">Design system</h1>

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-7">
          {TOKENS.map((name) => (
            <div key={name}>
              <div
                className="h-12 rounded-xl border border-cream-300"
                style={{ background: `var(--color-${name})` }}
              />
              <p className="mt-1 text-[10px] text-ink-500">{name}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-3xl text-ink-900">Fraunces — display</p>
        <p className="font-sans text-base text-ink-700 mt-1">
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
            <p className="text-ink-700 mb-3">A plain surface.</p>
            <Button size="sm">Action</Button>
          </Card>
          <Card hover className="p-5">
            <p className="text-ink-700 mb-3">This one lifts on hover.</p>
            <Button size="sm" variant="secondary">Action</Button>
          </Card>
        </div>
      </Section>
    </div>
  )
}