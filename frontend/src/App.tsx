import { Button } from './ds/Button'
import { Card } from './ds/Card'

function App() {
  return (
    <div className="p-10 space-y-6">
      <h1 className="font-display text-4xl text-terra-500">Pawfect Match</h1>

      <div className="flex gap-3 items-center">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div className="flex gap-3 items-center">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>

      <Card className="p-6" hover>
        <p className="text-ink-700 mb-4">A card holds content.</p>
        <Button>Action</Button>
      </Card>
    </div>
  )
}

export default App