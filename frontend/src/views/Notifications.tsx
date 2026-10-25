import { useAuth } from '../auth/auth-context'
import { Button, EmptyState } from '../ds'
import { navigate } from '../routing'

export function Notifications() {
  const { status } = useAuth()

  if (status === 'loading')
    return null

  if (status === 'signed-out') {
    return (
      <div className="p-8">
        <EmptyState
          emoji="🔒"
          title="Sign in to see your notifications"
          hint="Notifications are visible to signed-in members only."
          action={<Button onClick={() => navigate('auth')}>Sign in</Button>}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-display text-4xl font-black tracking-tight">Notifications</h1>
    </div>
  )
}