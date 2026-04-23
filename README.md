# MerchPad by Moshly

Offline-first merchandise sales tool for live shows. Part of the Moshly ecosystem.

---

## Architecture Overview

| Layer | Technology |
|---|---|
| UI | React 19 + Tailwind 4 + shadcn/ui |
| Routing | Wouter |
| Local storage | IndexedDB via `idb` |
| State | React Context + useReducer |
| IDs | UUID v4 (device-scoped) |
| Auth | **Auth-free MVP** — device ID only |
| Sync | Sync queue in IndexedDB (future backend) |

---

## Project System

MerchPad supports up to **3 local project slots** plus an unlimited number of **Hub Projects** pulled from the user's Moshly Hub dashboard.

Each project is a fully isolated workspace: its own products, shows, sessions, stock, and audit trail. Switching projects reloads the entire app context.

### Local Projects

- Max 3 slots, stored in `localStorage` under `mp_projects`
- Each slot has a name, description, and accent colour
- Managed via **Settings → Projects**

### Hub Projects Integration (PLACEHOLDER — NOT YET IMPLEMENTED)

> **Status:** Placeholder UI only. Requires Moshly OAuth / API key integration.

#### What it will do

When implemented, Hub Projects will pull the user's projects from the Moshly Hub dashboard API and display them alongside local slots in the Project Picker. Hub projects are **read-only** in MerchPad (products and shows are managed in Hub; MerchPad handles the sales layer).

#### Integration spec

**Authentication:** Moshly OAuth 2.0 flow (PKCE). The user connects their Moshly account once in Settings. The access token is stored in `localStorage` under `mp_hub_token`.

**Endpoint (to be confirmed with Moshly backend team):**

```
GET https://api.moshly.io/v1/projects
Authorization: Bearer <access_token>
```

**Expected response shape:**

```json
{
  "projects": [
    {
      "id": "hub_abc123",
      "name": "Summer Tour 2026",
      "description": "Main tour merch stand",
      "status": "active",
      "plan": "pro",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

**Implementation steps:**

1. Add OAuth PKCE flow in `client/src/lib/hubAuth.ts`
2. Add `fetchHubProjects()` in `client/src/lib/hubApi.ts`
3. Replace `HUB_PROJECTS_PLACEHOLDER` in `client/src/lib/projects.ts` with the real fetch
4. Store hub token refresh logic (token expiry, silent refresh)
5. Add "Disconnect Hub" option in Settings → Projects

**Number of Hub projects:** Determined by the user's Moshly plan. No hard cap in MerchPad — all hub projects are listed after the 3 local slots.

---

## Stop Sale / Archive Flow

1. Seller taps **Stop Sale** (red button in the Tally session bar)
2. A confirmation sheet appears: "Keep Selling" or "Review & Archive"
3. Tapping "Review & Archive" navigates to `/end-sale`
4. The Archive screen shows: session duration, total batches, total units, total revenue, top 5 items
5. Seller taps **Archive Session** (red gradient CTA) to permanently close the session
6. Session is marked `status: 'completed'` in IndexedDB and pushed to the sync queue

---

## Stock Stroke Colors

Card border colors on the Tally screen reflect the **stock snapshot taken at "Start Sale"**, not real-time global inventory.

| Color | Meaning |
|---|---|
| Green | Stock ≥ yellow threshold |
| Yellow | Stock < yellow threshold (configurable, default 30%) |
| Red + pulse | Stock < red threshold (configurable, default 10%) |
| Grey (no stroke) | Out of stock at this location |
| Blue dashed | Available at another location (not in this session's snapshot) |

Thresholds are configurable in **Settings → Stock Stroke Thresholds**.

---

## Offline-First Guarantees

- All writes go to IndexedDB first; the UI never waits for a network response
- A sync queue (`syncQueue` object store) holds pending operations
- When connectivity is restored, the queue drains in FIFO order
- Idempotency: every operation has a UUID; the backend must deduplicate by `operationId`

---

## Auth Roadmap

| Phase | Status |
|---|---|
| Auth-free device ID | ✅ MVP |
| Moshly Hub OAuth (Hub Projects) | 🔲 Planned |
| Per-device PIN lock | 🔲 Planned |
| Multi-rep session sharing | 🔲 Planned |

---

## Development

```bash
pnpm install
pnpm dev
```

TypeScript check:

```bash
pnpm exec tsc --noEmit
```
