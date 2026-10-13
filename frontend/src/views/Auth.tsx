import { useState } from 'react'
import { AuthForm } from './AuthForm'

type Mode = 'login' | 'register'
type Status = 'typing' | 'submitting' | 'success' | 'error'
type Values = { email: string; password: string }
type Errors = { email?: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// fake server: password "wrong" → error, anything else → success
function fakeSubmit(values: Values): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => (values.password === 'wrong' ? reject() : resolve()), 800)
  })
}

export function Auth() {
  const [mode, setMode] = useState<Mode>('login')
  const [values, setValues] = useState<Values>({ email: '', password: '' })
  const [status, setStatus] = useState<Status>('typing')
  const [errors, setErrors] = useState<Errors>({})

  function handleChange(field: keyof Values, value: string) {
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
    }
  }

  return (
    <AuthForm
      mode={mode}
      values={values}
      status={status}
      errors={errors}
      onModeChange={setMode}
      onChange={handleChange}
      onSubmit={handleSubmit}
    />
  )
}