import { lazy, Suspense, type ComponentType } from 'react'
import { useView, type View } from './routing'
import { Shell } from './components/Shell'
import { Browse } from './views/Browse'
import { DesignSystem } from './views/DesignSystem'
import { PrivacyPolicy, TermsOfService } from './views/Legal'

const PaletteLab = import.meta.env.DEV
  ? lazy(() => import('./dev/PaletteLab').then((m) => ({ default: m.PaletteLab })))
  : null

const PAGES: Record<View, ComponentType> = {
  browse: Browse,
  design: DesignSystem,
  privacy: PrivacyPolicy,
  terms: TermsOfService,
}

function App() {
  const view = useView()
  const Page = PAGES[view]
  const labOpen = PaletteLab !== null && new URLSearchParams(window.location.search).has('lab')

  return (
    <>
      <div className={labOpen ? 'pr-80' : ''}>
        <Shell view={view}>
          <Page />
        </Shell>
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
