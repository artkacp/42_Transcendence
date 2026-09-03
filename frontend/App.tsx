import { Button } from './ds/Button'

function App() {
  return (
    <div className="p-10 flex gap-3 items-center">
      <Button>Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button disabled>Disabled</Button>
    </div>
  )
}

export default App
