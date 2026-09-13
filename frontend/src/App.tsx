import { lazy, Suspense } from 'react'
import { DesignSystem } from './views/DesignSystem'

const PaletteLab = import.meta.env.DEV
  ? lazy(() => import('./dev/PaletteLab').then((m) => ({ default: m.PaletteLab })))
  : null

function App() {
  const labOpen = PaletteLab !== null && new URLSearchParams(window.location.search).has('lab')

  return (
    <>
      <div className={labOpen ? 'pr-80' : ''}>
        <DesignSystem />
      </div>
      {labOpen && (
        <Suspense fallback={null}>
          <PaletteLab />
        </Suspense>
      )}
    </>
  )
}

export default App