import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Heart, Plus, Trash2 } from 'lucide-react'
import { TOKEN_NAMES } from '../palettes/tokens'
import { Badge, Button, Card, IconButton, Progress, Select, Chip, Toggle, Avatar, EmptyState, Pagination } from '../ds'

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

export function DesignSystem() {
  const [selectValue, setSelectValue] = useState('medium')
  const [toggleValue, setToggleValue] = useState(true)
  const [chipValue, setChipValue] = useState('dog')
  const [page, setPage] = useState(5)
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
      <Section title="Pagination">
        <Row label="Many pages">
          <Pagination page={page} totalPages={12} onChange={setPage} />
        </Row>
        <Row label="Few pages">
          <Pagination page={1} totalPages={3} onChange={() => {}} />
        </Row>
      </Section>
      <Section title="Progress">
        <Row label="Tones">
          <div className="w-full max-w-sm space-y-3">
            <Progress value={35} label="Upload progress" />
            <Progress value={72} tone="success" label="Complete" />
            <Progress value={18} tone="danger" label="Failed upload" />
          </div>
        </Row>

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