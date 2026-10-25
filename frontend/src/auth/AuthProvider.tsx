// Wraps the whole app. On start it asks the server "who am I?".
// No token yet → 401 → apiClient refreshes via the cookie → asks again.
// So a hard reload lands signed in, without a logout flash.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, setAccessToken, setOnSessionExpired } from '../api/client';
import { AuthContext, type AuthStatus, type User } from './auth-context';

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

    // `cancelled` stops a late answer from setting state after unmount.
    let cancelled = false;

    async function boot() {
      try {
        const me = await get<User | null>(ME_PATH);
        if (cancelled) return;
        if (!me) return dropSession(); // e.g. dev server answered with HTML
        setUser(me);
        setStatus('signed-in');
      } catch {
        if (!cancelled) dropSession();
      }
    }

    void boot(); // void = not awaiting on purpose
    return () => {
      cancelled = true;
    };
  }, [dropSession]);

  // ── actions ───────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { access } = await post<{ access: string }>(LOGIN_PATH, { email, password });
    setAccessToken(access);
    const me = await get<User>(ME_PATH); // login gives no user → ask /me/
    setUser(me);
    setStatus('signed-in');
  }, []);
  
  const signOut = useCallback(async () => {
    try {
      await post(LOGOUT_PATH); // server clears the refresh cookie
    } finally {
      dropSession(); // forget locally even if the server call failed
    }
  }, [dropSession]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, updateUser: setUser }),
    [status, user, signIn, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}