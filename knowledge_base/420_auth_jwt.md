# 420 — Authentication & JWT

How authentication works across the stack.

---

## Token pattern

We use two tokens with different lifespans and storage:

| Token | Lifespan | Where stored | How sent |
|-------|----------|--------------|----------|
| Access token | Short (~15 min) | JS memory | `Authorization: Bearer <token>` header |
| Refresh token | Longer (~7 days) | `httpOnly` cookie | Sent automatically by browser |

**Why not `localStorage` for the access token?** It's readable by any JS on the page, which makes XSS attacks trivial to exploit. Memory is gone on tab close, which is acceptable given the short lifespan.

**Why `httpOnly` cookie for refresh?** JS cannot read it at all, so XSS cannot steal it. The browser sends it automatically on requests to the right path (`/api/auth/`, so refresh and logout both receive it). CSRF is mitigated by requiring the access token header on all state-changing calls.

---

## Token lifecycle

```
Register / Login → server returns access token + sets refresh cookie
App boot         → POST /auth/refresh/ → get a fresh access token
Any 401          → try refresh → if refresh expired, redirect to login
Logout           → POST /auth/logout/ → server blacklists refresh token, clears cookie
```

The frontend should call refresh on every app boot, not just on 401. This keeps the user logged in across page reloads without storing anything.

---

## Django implementation

`djangorestframework-simplejwt` is the standard library for JWT in DRF. It handles token generation, validation, and blacklisting. Key config decisions: token lifespans, cookie name, rotating refresh tokens (each use returns a new refresh token).

OAuth (if we claim that module) plugs in at the login step — it returns the same access+refresh pair after verifying the OAuth code. The rest of the flow is identical.

---

## Open decisions

2FA and OAuth are under consideration (see note 010). Either adds a step in the login flow but doesn't change the token pattern after authentication succeeds.
