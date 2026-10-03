# ArcadeO V1

Private, installable arcade for exactly two people. Supports remote (two devices) and together (single device) play with server-authoritative rules and offline input pause.

## Readiness and repository hygiene

The current product is **ArcadeO**. Read [production analysis](planning/review/ARCADEO-PRODUCTION-READINESS.md) for exact current validation, cleanup measurements and deployment prerequisites. Cloudflare deployment and physical-phone certification are separate stages. The GitHub default/release branch is `master`; `main` is a historical baseline.

Use `npm ci` for reproducible dependency installation. Browser/runtime evidence is generated under ignored `.local/evidence`; tracked evidence contains intentionally retained summaries and representative captures. Do not commit credentials, local databases, traces, seed SQL or compiler caches. Run `node scripts/verify-production.mjs` after `npm run build` to validate the public identity, notices, privacy boundaries and initial JavaScript budget.

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
npm ci

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

For phone/PC testing, both devices must use the same exact LAN origin. In PowerShell, replace the example IP with this PC's Wi-Fi address:

```powershell
$env:ARCADE_DEV_ORIGIN = 'http://192.168.1.12:5173'
npm run dev
```

Open that URL on both devices; sign in separately as A and B, choose Remote, accept the invitation and confirm Ready on each device. Together uses one shared controller. HTTP LAN uses development cookies and the safe UUID helper; production requires HTTPS and exact Origin validation.

To test without touching existing accounts or matches, use isolated state and free ports:

```powershell
$env:ARCADE_DEV_PORT = '5183'
$env:ARCADE_WORKER_PORT = '8793'
$env:ARCADE_DEV_ORIGIN = 'http://192.168.1.12:5183'
$env:ARCADE_DEV_STATE = '.local/isolated-phone-test'
npm run dev
```

Synthetic credentials are written privately under the isolated state path. Do not share or commit those files. Omit `ARCADE_DEV_STATE` only when you intentionally want the existing local saved state. An exact LAN Origin applies to the PC too, so use the LAN URL rather than localhost during the same test. Stop the test server and clear the task-specific environment variables afterward.

Cloudflare account/database/secret preparation and the separate deployment and hardware gates are documented in [Arcade release preparation](planning/review/ARCADE-RELEASE-PREPARATION.md).
