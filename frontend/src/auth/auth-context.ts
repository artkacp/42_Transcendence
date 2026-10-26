// src/auth/auth-context.ts
// The "box" that holds who is signed in, plus the hook to read it.
// Kept apart from AuthProvider.tsx so fast refresh lint stays quiet
// (a .tsx file should export only components).
import { createContext, useContext, type Dispatch, type SetStateAction } from 'react';
import type { User as PublicUser } from '../data/types';

export type User = PublicUser & { email: string; unread_notifications: number };

// 'loading' = we don't know yet (page just reloaded) → show nothing, no logout flash
export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

export type AuthValue = {
  status: AuthStatus;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: Dispatch<SetStateAction<User | null>>; // after a profile, avatar or notification change, so every reader re-renders
};

export const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}