// Wraps the whole app. On start it refreshes via the cookie, then asks "who am I?".
// Refreshing first avoids a 401 on /me/, which Chrome would log as a console error.
// So a hard reload lands signed in, without a logout flash.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, refresh, setAccessToken, setOnSessionExpired } from '../api/client';
import { AuthContext, type AuthStatus, type User } from './auth-context';

const ME_PATH = '/api/auth/me/';
const LOGIN_PATH = '/api/auth/login/';
const LOGOUT_PATH = '/api/auth/logout/';
const REGISTER_PATH = '/api/auth/register/';

// Marks "this browser has a session". Without it, a signed-out boot would call /refresh/,
// get a 401 and Chrome would log a console error. The cookie itself is http-only, so JS
// cannot check it. If storage is unavailable we fall back to the normal refresh flow.
const SESSION_KEY = 'pawfect.session';

function hasSessionMarker(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) !== null;
  } catch {
    return true;
  }
}

function setSessionMarker(active: boolean): void {
  try {
    if (active) localStorage.setItem(SESSION_KEY, '1');
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // storage blocked: boot just keeps calling /refresh/
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // one place that forgets the session
  const dropSession = useCallback(() => {
    setSessionMarker(false);
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
        const refreshed = hasSessionMarker() && (await refresh());
        if (cancelled) return;
        if (!refreshed) return dropSession();
        const me = await get<User | null>(ME_PATH);
        if (cancelled) return;
        if (!me) return dropSession(); // e.g. dev server answered with HTML
        setSessionMarker(true);
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
    setSessionMarker(true);
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

  const value = useMemo(
    () => ({ status, user, signIn, register, signOut, updateUser: setUser }),
    [status, user, signIn, register, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
