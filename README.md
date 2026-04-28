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
- 📁 **Master Catalogue**: Manage products, variants, and categories across different shows.
- 📉 **Review & Archive**: End-of-sale summary with session duration, revenue breakdown, and top-performing items.
- 🎨 **Neon Ledger Design**: A dark, electric aesthetic optimized for readability in concert venues.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, Tailwind CSS 4, shadcn/ui, Framer Motion |
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

## 🎨 Design Philosophy: "Neon Ledger"

The UI follows the **Neon Ledger** approach:
- **Dark Base**: Uses `#0E0F14` to minimize eye strain and save battery on OLED screens.
- **High Contrast**: Neon accents (Purple/Magenta) highlight primary actions.
- **Tactile Feedback**: Every interaction provides immediate visual feedback, critical when haptic feedback might be missed in a loud venue.
- **Information Density**: Numeric data uses `JetBrains Mono` for maximum clarity and alignment.

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
