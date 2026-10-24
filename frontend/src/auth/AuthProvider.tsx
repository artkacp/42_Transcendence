// src/auth/AuthProvider.tsx
// Wraps the whole app. On start it asks the server "who am I?".
// No token yet → 401 → apiClient refreshes via the cookie → asks again.
// So a hard reload lands signed in, without a logout flash.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, setAccessToken, setOnSessionExpired } from '../api/client';
import { AuthContext, type AuthStatus, type User } from './auth-context';

// Paths checked against feature/b1-auth-session (B1)
const ME_PATH = '/api/auth/me/';
const LOGIN_PATH = '/api/auth/login/';
const LOGOUT_PATH = '/api/auth/logout/';
const REGISTER_PATH = '/api/auth/register/';

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

    // Boot: ask /me/ once on mount.
    // useEffect can't be async (React wants a cleanup, not a Promise), so two
    // equal ways exist — same behaviour, both keep the `cancelled` guard:
    //   a) get(ME).then(...).catch(...)              — promise chain
    //   b) async function boot() { try { await } }   — used here, matches client.ts
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
  
  // register gives no session → sign in right after
  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      await post(REGISTER_PATH, { email, password, full_name: fullName });
      await signIn(email, password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    try {
      await post(LOGOUT_PATH); // server clears the refresh cookie
    } finally {
      dropSession(); // forget locally even if the server call failed
    }
  }, [dropSession]);

  // same object between renders unless something really changed
  const value = useMemo(
    () => ({ status, user, signIn, register, signOut, updateUser: setUser }),
    [status, user, signIn, register, signOut],
  );

  // React 19: <Context> works as a provider directly
  return <AuthContext value={value}>{children}</AuthContext>;
}
