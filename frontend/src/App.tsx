import { DesignSystem } from './views/DesignSystem'
import { PaletteLab } from './dev/PaletteLab.tsx'

function App() {
  return (
    <>
      <div className="pr-80">
        <DesignSystem />
      </div>
      <PaletteLab />
    </>
  )
}

export default App