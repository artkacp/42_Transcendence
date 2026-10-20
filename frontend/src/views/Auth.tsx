// src/views/Auth.tsx
// F1 · state machine: typing → submitting → success | error
// AuthForm is look-only, so this file translates our 4 states into its props.

import { useState } from 'react'
import { AuthForm, type AuthMode, type AuthField, type AuthValues, type AuthErrors } from './AuthForm'

type Status = 'typing' | 'submitting' | 'success' | 'error'

const EMPTY: AuthValues = { email: '', password: '', full_name: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// fake server: password "wrong" → error, anything else → success
function fakeSubmit(values: AuthValues): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (values.password === 'wrong' ? reject() : resolve()), 800)
  })
}

export function Auth() {
  const [mode, setMode] = useState<AuthMode>('signin')
  const [values, setValues] = useState<AuthValues>(EMPTY)
  const [status, setStatus] = useState<Status>('typing')
  const [errors, setErrors] = useState<AuthErrors>({})

  function handleModeChange(next: AuthMode) {
    setMode(next)
    setErrors({})
    setStatus('typing')
  }

  function handleFieldChange(field: AuthField, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    setErrors({})
    setStatus('typing')
  }

  async function handleSubmit() {
    if (!EMAIL_RE.test(values.email)) {
      setErrors({ email: 'Enter a valid email' })
      return
    }
    setStatus('submitting')
    try {
      await fakeSubmit(values)
      setStatus('success')
    } catch {
      setStatus('error')
      setErrors({ form: 'Wrong email or password' })
    }
  }

  if (status === 'success') {
    return <p className="mx-auto max-w-sm">Done (fake). Real API comes in F1 part 2.</p>
  }

  return (
    <AuthForm
      mode={mode}
      status={status === 'submitting' ? 'submitting' : 'typing'}
      values={values}
      errors={errors}
      onModeChange={handleModeChange}
      onFieldChange={handleFieldChange}
      onSubmit={handleSubmit}
    />
  )
}