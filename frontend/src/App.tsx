import { lazy, Suspense, type ComponentType } from 'react'
import { useView, type View } from './routing'
import { Shell } from './components/Shell'
import { Auth } from './views/Auth'
import { Browse } from './views/Browse'
import { Friends } from './views/Friends'
import { PetPage } from './views/PetPage'
import { Rehome } from './views/Rehome'
import { Profile } from './views/Profile'
import { DesignSystem } from './views/DesignSystem'
import { Notifications } from './views/Notifications'
import { PrivacyPolicy, TermsOfService } from './views/Legal'

const PaletteLab = import.meta.env.DEV
  ? lazy(() => import('./dev/PaletteLab').then((m) => ({ default: m.PaletteLab })))
  : null

const PAGES: Record<View, ComponentType> = {
  auth: Auth,
  browse: Browse,
  pet: PetPage,
  rehome: Rehome,
  profile: Profile,
  notifications: Notifications,
  friends: Friends,
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
