// src/api/client.ts
// One door for every request to the backend.┌│ │┐
// No React inside: plain TypeScript, so it can be reused as-is in other project

const REFRESH_PATH = '/api/auth/refresh/';

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

// ── errors: DRF answer → one message + errors per form field ────────────
export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  status: number;
  fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// DRF sends { detail: "..." } or { field: ["msg"], non_field_errors: [...] }
function toApiError(status: number, body: unknown): ApiError {
  let message = `Request failed (${status})`;
  const fields: FieldErrors = {};

  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      const text = Array.isArray(value) ? value.join(' ') : String(value);
      if (key === 'detail' || key === 'non_field_errors') message = text;
      else fields[key] = text;
    }
  }
  return new ApiError(status, message, fields);
}

// ── refresh: only ONE refresh at a time, even if 5 requests get 401 ─────
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
  if (res.status === 401 && !retried) {
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
