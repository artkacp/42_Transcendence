// src/views/Auth.tsx
// F1 · state machine: typing → submitting → browse | error
// AuthForm is look-only, so this file translates our states into its props.

import { useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { ApiError } from '../api/client'
import { navigate } from '../routing'
import { AuthForm, type AuthMode, type AuthField, type AuthValues, type AuthErrors } from './AuthForm'

type Status = 'typing' | 'submitting' | 'error'

const EMPTY: AuthValues = { email: '', password: '', full_name: '' }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Auth() {
  const { signIn, register } = useAuth()
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
      if (mode === 'signin') await signIn(values.email, values.password)
      else await register(values.full_name, values.email, values.password)
      navigate('browse')
    } catch (err) {
      setStatus('error')
      if (!(err instanceof ApiError)) {
        setErrors({ form: 'Something went wrong, try again' })
        return
      }
      const fields: AuthErrors = {}
      for (const f of ['email', 'password', 'full_name'] as const) {
        if (err.fieldErrors[f]) fields[f] = err.fieldErrors[f]
      }
      if (Object.keys(fields).length > 0) setErrors(fields)
      else setErrors({ form: err.status === 401 ? 'Wrong email or password' : err.message })
    }
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