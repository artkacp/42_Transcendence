import { Button } from '../ds/Button'
import { Card } from '../ds/Card'
import { Badge } from '../ds/Badge'

export function DesignSystem() {
  return (
    <div className="p-10 space-y-10">
      <h1 className="font-display text-4xl text-terra-500">Design system</h1>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-ink-900">Button</h2>

        <div className="flex gap-3 items-center flex-wrap">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button disabled>Disabled</Button>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-ink-900">Badge</h2>

        <div className="flex gap-2 items-center flex-wrap">
          <Badge>neutral</Badge>
          <Badge tone="success">adopted</Badge>
          <Badge tone="warning">pending</Badge>
          <Badge tone="danger">denied</Badge>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-2xl text-ink-900">Card</h2>

        <div className="flex gap-4 flex-wrap">
          <Card className="p-6 max-w-xs">
            <p className="text-ink-700 mb-4">A plain surface.</p>
            <Button size="sm">Action</Button>
          </Card>

          <Card className="p-6 max-w-xs" hover>
            <p className="text-ink-700 mb-4">This one lifts on hover.</p>
            <Button size="sm" variant="secondary">Action</Button>
          </Card>
        </div>
      </section>
    </div>
  )
}