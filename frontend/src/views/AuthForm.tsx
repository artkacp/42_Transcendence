// src/views/AuthForm.tsx
// F1 · sign in / create account — LOOK ONLY.┌│ │┐
// No useState here: every visual state comes from props,
// so the same component can be shown in all its states on one page.

import { Button, Input } from '../ds'

export type AuthMode = 'signin' | 'register'
export type AuthStatus = 'typing' | 'submitting'
export type AuthField = 'email' | 'password' | 'full_name' // same names as the backend
export type AuthValues = Record<AuthField, string>
export type AuthErrors = Partial<Record<AuthField | 'form', string>> // 'form' = message above the form

export interface AuthFormProps {
  mode: AuthMode
  status: AuthStatus
  values: AuthValues
  errors?: AuthErrors
  onModeChange?: (mode: AuthMode) => void
  onFieldChange?: (field: AuthField, value: string) => void
  onSubmit?: () => void
}

const noop = () => {}

const MODES: { id: AuthMode; label: string }[] = [
  { id: 'signin', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
]

export function AuthForm({
  mode,
  status,
  values,
  errors = {},
  onModeChange = noop,
  onFieldChange = noop,
  onSubmit = noop,
}: AuthFormProps) {
  const busy = status === 'submitting'

  // derived, not stored (React docs, step 4)
  const isEmpty =
    values.email === '' || values.password === '' || (mode === 'register' && values.full_name === '')

  return (
    // noValidate: our own email check shows the inline error, not the browser bubble
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      noValidate
      className="mx-auto flex w-full max-w-sm flex-col gap-4"
    >
      {/* two modes = toggle group (aria-pressed), simpler than full ARIA tabs */}
      <div
        role="group"
        aria-label="Sign in or create account"
        className="grid grid-cols-2 gap-1 rounded-full bg-ink-900/5 p-1"
      >
        {MODES.map((m) => (
          <Button
            key={m.id}
            type="button"
            variant={mode === m.id ? 'secondary' : 'ghost'}
            aria-pressed={mode === m.id}
            disabled={busy}
            onClick={() => onModeChange(m.id)}
          >
            {m.label}
          </Button>
        ))}
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-danger">
          <span aria-hidden="true" className="mr-1 font-logo">≧◉_◉≦</span>
          {errors.form}
        </p>
      )}

      {mode === 'register' && (
        <Input
          label="Full name"
          name="full_name"
          autoComplete="name"
          value={values.full_name}
          onChange={(e) => onFieldChange('full_name', e.target.value)}
          error={errors.full_name}
          disabled={busy}
        />
      )}

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={values.email}
        onChange={(e) => onFieldChange('email', e.target.value)}
        error={errors.email}
        disabled={busy}
      />

      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        value={values.password}
        onChange={(e) => onFieldChange('password', e.target.value)}
        error={errors.password}
        disabled={busy}
      />

      <Button type="submit" disabled={busy || isEmpty}>
        {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
      </Button>
    </form>
  )
}