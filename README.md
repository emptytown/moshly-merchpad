# MerchPad by Moshly

[![Moshly Ecosystem](https://img.shields.io/badge/Moshly-Ecosystem-purple?style=for-the-badge)](https://moshly.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Offline-First](https://img.shields.io/badge/Offline--First-Guaranteed-green?style=for-the-badge)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

**MerchPad** is a high-velocity, offline-first merchandise sales tool designed specifically for merch reps at live shows. Built to handle the pressure of dark, loud, and high-stakes environments, it ensures that not a single sale is lost due to poor connectivity.

---

## 🚀 Features

- 📶 **Offline-First Architecture**: All data is stored locally in IndexedDB. Transactions are queued and synced automatically when connectivity returns.
- ⚡ **High-Velocity Tally**: Optimized for fast-paced environments with a tactile, high-density tally interface.
- 📦 **Local Project Slots**: Support for up to 3 isolated local project workspaces.
- 🔗 **Moshly Hub Integration**: (In Progress) Pull professional projects directly from your Moshly Hub dashboard.
- 📊 **Real-time Stock Tracking**: Visual stock thresholds (Green/Yellow/Red) based on session snapshots.
- 📁 **Product editor**: Products, variants, tags, unit cost and profit per project.
- 📉 **Review & Archive**: End-of-sale summary with session duration, revenue breakdown, and top-performing items.
- 🎨 **Two skins, light & dark**: Neo Brut (default, shared with the Moshly Site) and Legacy Purple.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Tailwind CSS 4, a few shadcn/ui primitives |
| **Routing** | Wouter |
| **State Management** | React Context + useReducer |
| **Local Database** | IndexedDB via `idb` |
| **API/Server** | Express, Node.js |
| **Build Tool** | Vite, esbuild |
| **Type Safety** | TypeScript |
| **Package Manager** | pnpm |

---

## 🏁 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (v9+)

### Installation

```bash
git clone https://github.com/moshly/merchpad.git
cd merchpad
pnpm install
```

### Development

Start the Vite development server:

```bash
pnpm dev
```

### Build & Production

Build both the client and the server:

```bash
pnpm build
```

Start the production server:

```bash
pnpm start
```

---

## 🏗 Project Structure

```text
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # UI components (shadcn/ui + custom)
│   │   ├── contexts/    # React Contexts (Global state, Projects, Theme)
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Database logic (db.ts), API helpers, utils
│   │   └── pages/       # Screen definitions (Tally, Settings, etc.)
├── server/              # Express server for serving the static app
├── shared/              # Shared types and constants
├── public/              # Static assets
└── package.json         # Project dependencies and scripts
```

---

## 🔋 Offline-First & Sync

MerchPad is designed to be fully functional without an internet connection:

1. **Local-First Writes**: Every transaction, stock adjustment, or audit entry is written to **IndexedDB** first.
2. **Sync Queue**: Operations are added to a `syncQueue` object store.
3. **Background Sync**: When the app detects an "online" state, it drains the queue in FIFO order to the Moshly API.
4. **Idempotency**: Every operation carries a UUID to prevent duplicate processing on the backend.

---

## 🎨 Skins

Every screen supports two skins, each in light and dark (Settings → Appearance):

- **Neo Brut** (`data-skin="neo"`, default): the Moshly Site look. Lime for the one primary action and "you are here", purple for identity, everything else neutral; Inter Tight display type. Light mode uses cream paper, ink outlines and hard offset shadows; dark mode uses flat blocks, hairlines and pill controls. Tokens are vendored in `client/src/styles/neo-brut.tokens.css` from `moshly-design-tokens` — change them upstream, not here.
- **Legacy Purple** (`data-skin="legacy"`): the original dark-glass look with purple/magenta accents.

Skin ids follow the cross-app contract in `moshly-days/docs/MOSHLY_SKINS.md`.

---

## 🛣 Roadmap

- [x] **Phase 1**: Device-scoped offline MVP (Active)
- [ ] **Phase 2**: Moshly Hub OAuth & Hub Projects Integration
- [ ] **Phase 3**: Multi-rep session sharing & synchronization
- [ ] **Phase 4**: Advanced analytics and per-device PIN locks

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

*Part of the [Moshly](https://moshly.io) Ecosystem — Empowering artists and their teams.*
