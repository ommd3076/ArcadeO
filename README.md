# Private Arcade V1

Private, installable arcade for exactly two people. Supports remote (two devices) and together (single device) play with server-authoritative rules and offline input pause.

## Games Included
- **Connect Four**
- **Rock Paper Scissors**
- **Ludo**
- **Snakes & Ladders**
- **Dots & Boxes**
- **SOS**
- **Hand Cricket**
- **Sudoku** (Solo Practice, Live Duel, Asynchronous Challenge)

## Architecture
- **Frontend**: React 19, TypeScript, Vite, React Router, Lucide icons, semantic CSS token system (Standard & Romantic families with Dark & Light variants).
- **Backend**: Cloudflare Worker with same-origin JSON API and static SPA assets.
- **State & Authority**: Cloudflare Durable Objects with SQLite storage for live match authority, atomic commits, and idempotent action receipts.
- **Projection & Storage**: Cloudflare D1 for accounts, sessions, puzzle catalog, match registry, and result projections.

## Local Development Commands

```bash
# Install dependencies
npm install

# Start development servers
npm run dev

# Run unit tests
npm test

# Run worker integration tests
npm run test:integration

# Typecheck codebase
npm run typecheck

# Lint and format check
npm run lint
npm run format:check

# Verify Sudoku puzzle catalog
npm run content:verify
```

## Ports and Proxy
- **Vite Dev Server**: `http://localhost:5173`
- **Wrangler Worker**: `http://localhost:8787` (proxied automatically via `/api` in Vite)
