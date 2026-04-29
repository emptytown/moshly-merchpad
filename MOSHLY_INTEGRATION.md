# Moshly Hub ↔ MerchPad Integration

## Overview

MerchPad authenticates users via Moshly Hub SSO. Users log in to the Hub (moshly.io) and are
redirected to MerchPad with a short-lived token. MerchPad validates the token server-side and
creates its own session cookie.

**Full checklist for connecting any Moshly app:** see `Moshly-Site/docs/APP_CONNECTION.md`.

---

## Flow

```
Hub (moshly.io/dashboard)
  └─ User clicks MerchPad slot
      └─ Hub calls POST /api/auth/sso/token → { token, expiresIn: 60 }
          └─ Hub redirects → https://merchpad.moshly.io/auth/callback?token=TOKEN
              └─ AuthCallback.tsx reads token from URL
                  └─ POST /api/auth/moshly-verify (Express, server-side)
                      └─ Express calls POST https://moshly.io/api/auth/sso/verify
                          └─ { success: true, user: { id, email, role, plan } }
                              └─ Express sets HttpOnly cookie mp_session
                                  └─ React navigates to /
```

> **Note:** The Hub API is served by Cloudflare Pages at `moshly.io` — there is no
> `api.moshly.io` subdomain. All Hub API calls go to `https://moshly.io/api/...`.

---

## Files Added / Modified

| File | Purpose |
|---|---|
| `server/index.ts` | Express routes: `POST /api/auth/moshly-verify`, `GET /api/auth/me`, `POST /api/auth/logout` |
| `client/src/contexts/MoshlyAuthContext.tsx` | React context: `user`, `loading`, `logout` — rehydrated from cookie on mount |
| `client/src/pages/AuthCallback.tsx` | Wouter route `/auth/callback` — consumes token, calls verify, redirects |
| `client/src/App.tsx` | Added `MoshlyAuthProvider` wrapper + `/auth/callback` route |
| `.env` | Production Moshly SSO env vars |
| `.env.local` | Dev overrides pointing to `localhost:8788` |

---

## Environment Variables

**Production (`.env` or Fly.io secrets):**
```
VITE_MOSHLY_HUB_URL=https://moshly.io
MOSHLY_SSO_VERIFY_URL=https://moshly.io/api/auth/sso/verify
```

**Dev (`.env.local`, not committed):**
```
VITE_MOSHLY_HUB_URL=http://localhost:8788
MOSHLY_SSO_VERIFY_URL=http://localhost:8788/api/auth/sso/verify
```

`MOSHLY_SSO_VERIFY_URL` is a server-side env var (no `VITE_` prefix). The Express server reads
it, not the browser. Set it on Fly.io with: `fly secrets set MOSHLY_SSO_VERIFY_URL=https://moshly.io/api/auth/sso/verify`

---

## API Contracts

### `POST /api/auth/moshly-verify` (MerchPad Express)
Called by `AuthCallback.tsx` after receiving the SSO token from the Hub redirect.

Request:
```json
{ "token": "<uuid>" }
```
Response (200):
```json
{ "ok": true, "user": { "id": "...", "email": "...", "role": "...", "plan": "..." } }
```
Sets `mp_session` HttpOnly cookie (7-day expiry).

### `GET /api/auth/me` (MerchPad Express)
Called on app mount by `MoshlyAuthContext` to rehydrate session.

Response (200):
```json
{ "user": { "id": "...", "email": "...", "role": "...", "plan": "..." } }
```
Returns 401 if no valid cookie.

### `POST /api/auth/logout` (MerchPad Express)
Clears `mp_session` cookie. No body required.

### `POST https://moshly.io/api/auth/sso/verify` (Hub API — called by Express)
One-time use. Token is deleted after first successful call.

Request:
```json
{ "token": "<uuid>" }
```
Response (200):
```json
{ "success": true, "user": { "id": "...", "email": "...", "role": "...", "plan": "..." } }
```
Errors: `400` missing token, `401` invalid/expired token, `500` server error.

---

## Using the Auth Context

```tsx
import { useMoshlyAuth } from "@/contexts/MoshlyAuthContext";

function MyComponent() {
  const { user, loading, logout } = useMoshlyAuth();
  if (loading) return <Spinner />;
  if (!user) return <p>Not signed in</p>;
  return <p>Hello {user.email} — Plan: {user.plan}</p>;
}
```

---

## Dev Testing

1. Start Hub: `npm run dev` (port 8788, in Moshly-Site repo)
2. Start MerchPad: `pnpm dev` (port 3000)
3. Log in to Hub at `http://localhost:8788/login`
4. Go to Dashboard, connect MerchPad, then click the slot
5. Should land at `http://localhost:3000/auth/callback?token=...`
6. After callback: redirected to `/`, check DevTools → Application → Cookies → `mp_session`
7. Refresh page: `GET /api/auth/me` should return user from cookie

---

## Notes

- Tokens are 60-second TTL and single-use — never retry a successful verify
- `mp_session` cookie is `SameSite=Strict; HttpOnly` — not accessible from JS
- `MOSHLY_SSO_VERIFY_URL` must NOT have a trailing slash
- `cookie-parser` is required in Express (`pnpm add cookie-parser`)
