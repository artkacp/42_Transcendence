// src/auth/auth-context.ts
// The "box" that holds who is signed in, plus the hook to read it.
// Kept apart from AuthProvider.tsx so fast refresh lint stays quiet
// (a .tsx file should export only components).
import { createContext, useContext } from 'react';

// TODO: match the user shape from the backend (task B2)
export type User = { id: number; username: string };

// 'loading' = we don't know yet (page just reloaded) → show nothing, no logout flash
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export type AuthValue = {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}