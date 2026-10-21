// src/views/AuthForm.mocks.ts
// every AuthForm state for the design view ┌│ │┐

import type { AuthFormProps, AuthValues } from './AuthForm'

const EMPTY: AuthValues = { email: '', password: '', full_name: '' }
const FILLED: AuthValues = { email: 'alex@pawfect.dev', password: 'hunter22', full_name: 'Alex' }

export const AUTH_MOCKS: { name: string; props: AuthFormProps }[] = [
  { name: 'empty', props: { mode: 'signin', status: 'typing', values: EMPTY } },
  { name: 'typing', props: { mode: 'signin', status: 'typing', values: FILLED } },
  {
    name: 'invalid email',
    props: {
      mode: 'signin',
      status: 'typing',
      values: { ...FILLED, email: 'alex@' },
      errors: { email: 'Enter a valid email address.' },
    },
  },
  { name: 'submitting', props: { mode: 'signin', status: 'submitting', values: FILLED } },
  {
    name: 'server error',
    props: {
      mode: 'signin',
      status: 'typing',
      values: FILLED,
      errors: { form: 'No active account found with the given credentials' },
    },
  },
  {
    name: 'register · field errors',
    props: {
      mode: 'register',
      status: 'typing',
      values: { ...FILLED, password: 'abc' },
      errors: {
        email: 'An account with this email already exists.',
        password: 'This password is too short. It must contain at least 8 characters.',
      },
    },
  },
]
