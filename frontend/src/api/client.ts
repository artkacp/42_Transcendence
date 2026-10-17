// src/api/client.ts
// One door for every request to the backend.┌│ │┐
// No React inside: plain TypeScript, so it can be reused as-is in other project

const REFRESH_PATH = '/api/auth/refresh/';

// auth endpoints answer 401 for "wrong password" — never refresh on them
const NO_REFRESH = ['/api/auth/login/', '/api/auth/register/', REFRESH_PATH];

// ── access token: kept in memory only (never localStorage) ──────────────
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// Called when the session is really over (refresh failed).
// AuthContext will plug its signOut() in here.
let onSessionExpired: () => void = () => {};

export function setOnSessionExpired(fn: () => void): void {
  onSessionExpired = fn;
}

// ── errors: backend answer → one message + errors per form field ────────
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  status: number;
  code: string; // backend "error" field, e.g. 'validation_failed', 'no_active_account'
  fieldErrors: FieldErrors;

  constructor(status: number, message: string, code = 'unknown', fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const toText = (value: unknown): string =>
  Array.isArray(value) ? value.join(' ') : String(value);

// Backend (core/exceptions.py) sends:
//   400 → { error: 'validation_failed', detail: 'Invalid input.', fields: { email: ['msg'], non_field_errors: [...] } }
//   other → { error: 'no_active_account', detail: 'No active account ...' }
function toApiError(status: number, body: unknown): ApiError {
  let message = `Request failed (${status})`;
  let code = 'unknown';
  const fieldErrors: FieldErrors = {};

  if (body && typeof body === 'object') {
    const data = body as { error?: unknown; detail?: unknown; fields?: unknown };
    if (typeof data.error === 'string') code = data.error;
    if (data.detail !== undefined) message = toText(data.detail);

    if (data.fields && typeof data.fields === 'object') {
      for (const [key, value] of Object.entries(data.fields)) {
        if (key === 'non_field_errors') message = toText(value); // form-level, shown above the form
        else fieldErrors[key] = toText(value);
      }
    }
  }
  return new ApiError(status, message, code, fieldErrors);
}

// ── refresh: only ONE refresh at a time, even if 5 requests get 401 ─────
// The backend rotates refresh tokens and blacklists the old one, so two
// parallel refreshes would log the user out. One shared promise prevents it.
let refreshing: Promise<boolean> | null = null;

function refresh(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch(REFRESH_PATH, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = (await res.json()) as { access?: string };
        setAccessToken(data.access ?? null);
        return Boolean(data.access);
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

// ── the request itself ──────────────────────────────────────────────────
export async function api<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // relative path → same origin through nginx, no CORS
  const res = await fetch(path, { ...options, headers, credentials: 'include' });

  // 401 → try refresh once, then repeat the same request once
  if (res.status === 401 && !retried && !NO_REFRESH.includes(path)) {
    if (await refresh()) return api<T>(path, options, true);
    setAccessToken(null);
    onSessionExpired();
  }

  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

// ── short helpers ───────────────────────────────────────────────────────
export const get = <T>(path: string) => api<T>(path);

export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data === undefined ? undefined : JSON.stringify(data) });

export const patch = <T>(path: string, data: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
