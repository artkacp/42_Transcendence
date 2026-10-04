// src/auth/AuthProvider.tsx
// Wraps the whole app. On start it asks the server "who am I?".
// No token yet → 401 → apiClient refreshes via the cookie → asks again.
// So a hard reload lands signed in, without a logout flash.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, setAccessToken, setOnSessionExpired } from '../api/client';
import { AuthContext, type AuthStatus, type User } from './auth-context';

// TODO: check the exact paths and the login answer shape in the TRD (task B1)
const ME_PATH = '/api/auth/me/';
const LOGIN_PATH = '/api/auth/login/';
const LOGOUT_PATH = '/api/auth/logout/';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // one place that forgets the session
  const dropSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('signed-out');
  }, []);

  // ── boot: who am I? ───────────────────────────────────────────────────
  useEffect(() => {
    setOnSessionExpired(dropSession);

    let cancelled = false; // the page may close before the answer comes
    get<User | null>(ME_PATH)
      .then((me) => {
        if (cancelled) return;
        if (!me) return dropSession(); // e.g. dev server answered with HTML
        setUser(me);
        setStatus('signed-in');
      })
      .catch(() => {
        if (!cancelled) dropSession();
      });

    return () => {
      cancelled = true;
    };
  }, [dropSession]);

  // ── actions ───────────────────────────────────────────────────────────
  const signIn = useCallback(async (username: string, password: string) => {
    const data = await post<{ access: string; user: User }>(LOGIN_PATH, { username, password });
    setAccessToken(data.access);
    setUser(data.user);
    setStatus('signed-in');
  }, []);

  const signOut = useCallback(async () => {
    try {
      await post(LOGOUT_PATH); // server clears the refresh cookie
    } finally {
      dropSession(); // forget locally even if the server call failed
    }
  }, [dropSession]);

  // same object between renders unless something really changed
  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );

  // React 19: <Context> works as a provider directly
  return <AuthContext value={value}>{children}</AuthContext>;
}