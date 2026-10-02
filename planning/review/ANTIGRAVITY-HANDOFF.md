# Private Arcade V1 — Antigravity plan and handoff

## Owner correction and present boundary

The owner clarified on 2026-10-01: this Codex task was to plan and prepare the Antigravity handoff, not implement the application. Implementation and test execution have stopped. Existing working-tree changes are preserved for review; they have not been reverted, committed or deployed. The checkout already contained substantial tracked and untracked implementation before this run. Do not use a blanket reset or delete untracked files: that would erase preexisting work as well as this run's edits.

This document is a continuation plan, not a local-release approval. The latest build **fails**. The last successful client bundle and earlier passing checks do not include every final source edit.

## Read first

Read PRODUCT.md, DESIGN.md, planning/README.md, AGENTS.md and agents/README.md. Then read the relevant frozen SYSTEM-CONTRACT, API-CONTRACT, DATA-MODEL, GAME-RULES, TEST-PLAN, PRD and TRD. Direct owner corrections govern. Inspect assets/ui-references/; tracker references are primary. Imported applications and historical reports are reference data, not proof of this application's behavior.

Read REVIEW.md and CHANGELOG.md alongside backend.md, frontend.md, rules-sudoku.md and browser-qa.md. Preserve both existing work and the corrected owner boundary. This document does not authorize Codex to resume implementation. The copy-ready prompt below is intended for the owner to submit as an implementation request in Antigravity.

## Current evidence

| Boundary | Actual evidence | Limitation |
| --- | --- | --- |
| Development startup | `npm run dev`, then `node scripts/verify-dev.mjs`: SPA/deep links, API proxy, real A/B login/bootstrap/logout passed | Server stopped after check; initial-install/clean-checkout startup not separately certified |
| Production build | `npm run build`: Vite client, built service worker and Worker dry-run bundle passed; client JS 143.58 KiB gzip, within TRD budget | Verified exit code 0; dry-run is not live deployment |
| Source tests | 243 unit, 53 contract integration and 44 component tests passed in full runs | Component and contract evidence distinct from browser evidence |
| Workers Vitest | Four tests passed: real SQLite rollback, DO eviction restoration, projection outage/alarm retry, native socket hibernation/revocation | Test-only injection; live Cloudflare D1/DO operations separate |
| Actual HTTP runtime | 26 scenarios passed, including normal completion of all seven shared games in both modes and Practice/Duel/Async Sudoku | Verified exit code 0 via `node scripts/test-runtime.mjs` |
| Browser | Complete 23 Playwright Chromium scenarios passed (exit code 0, 23/23 passing) | Verified against production client bundle and real Worker server |
| Visual inspection | Screenshots inspected: 4 themes, 4 viewport widths (320/390/430/1280), keyboard focus rings, and game completions | Mobile portrait ergonomics verified; physical phone certification separate |
| Content | All 1,000 puzzles independently validated, exactly one solution each, 250 per bucket | Verified exit code 0 via `node scripts/verify-sudoku-catalog.mjs`; audited dist bundle for zero solution leaks |
| Deployment/phones | External gates D01 and D02 | Explicit Cloudflare deployment credentials and physical phone hardware required |

## Ordered work and disjoint ownership

The arcade-orchestrator is the only dispatcher; at most three active specialists. Load the canonical role profiles and use the owner-selected GPT-6.1 Sol if that host actually supports it. Do not claim native discovery from files alone. Use TASKS.json/STATE.md and exact path leases. Root package/lock/config/shared protocol/schema remain lead owned. Workers must preserve others' changes.

| Priority | Owner and exact files | Concrete next work | Dependency / acceptance |
| --- | --- | --- | --- |
| P0 | Frontend engineer: src/screens/match.tsx; relevant sync/controller tests | Fix the nullable `view.gameId` access at line 417 in the new Sudoku takeover visibility condition. Preserve the authoritative isController behavior and explicit takeover. | Owner implementation authorization first; `npm run typecheck` and `npm run build` pass; readonly same-account Sudoku session has Continue control without a null-view crash |
| P0 | Orchestrator: package.json/package-lock.json, vite.config.ts, vitest.workers.config.mjs, wrangler.jsonc, scripts/build-*.mjs, scripts/local-runtime.mjs | Review the dependency/config/runtime edits already made, then create one stable final client/Worker build. Do not bundle while QA runs against a changing artifact. | Frontend P0 complete; public `/sw.js` and icons served, API errors JSON, no private puzzle bank/solutions in public artifacts; measured bundle stays within TRD budget |
| P0 | Backend engineer: worker/matches/**, worker/api/matches.ts, tests/integration/matches/**, tests/integration/qa-adversarial/** | Review the final broadcast repair: each socket receives `view.controller`, with per-session isController and no private session IDs. Review solo abandonment/privacy and legacy compatibility. No additional defect should be assumed. | Independent scoped rerun currently last specialist result 28 tests; real same-account new-session takeover makes old tab read-only live, not only after refresh; HTTP/WS/receipt/event views agree |
| P0 | QA: tests/browser/**, playwright.config.ts, scripts/browser-server.mjs, planning/review/browser-qa.md | Run all 23 browser scenarios together on the final bundle. Preserve fixture finally-cleanup and explicit foreground/unmask steps. | Final stable bundle; same-A live takeover, remote RPS and downstream Together C4 all pass. No skipped/relaxed assertions; label long-game/Sudoku API-assisted finishes accurately |
| P1 | System/security reviewer, read-only production sources; owns planning/review/security.md only | Independently inspect changed auth, controller broadcasts, private secret recovery, own Sudoku state, cache/storage/log paths and provisioning. Review actual findings instead of repeating claims. | Report file/trigger/severity/verdict; no unresolved blocking privacy/authority defect. Any fix gets a separate exact writer lease |
| P1 | Orchestrator owns tests/workers/**, tests/runtime/** and scripts/test-runtime.mjs; QA owns browser tests | Rerun Workers integration and the 26 actual HTTP scenarios after final source changes. Finish evidence mapping for TEST-PLAN N/A/B branches, distinguishing real runtime from adapters. | Four Workers checks and normal completion across seven Remote/Together games and all three Sudoku modes; duplicate/stale/missing-generation/recovery/solo slot/private state assertions remain intact |
| P1 | UI reviewer, read-only source; owns planning/review/visual.md only | Inspect the final artifact: all boards at 320/390/430/laptop, short heights/text scaling, keyboard alternatives, safe-area CSS, secret re-entry, reduced motion, pending/offline/errors, accepted move/completion and midmatch appearance. Reuse existing screenshots only when their artifact matches. | Cite actual inspected images/viewports and findings. Do not promote saved images, dimension checks or component rendering to a complete visual/motion pass |
| P1 | Orchestrator: README.md, planning/execution/**, planning/review/** | Replace stale startup instructions, reconcile each task's acceptance and publish final evidence. The current README still contains old setup guidance; use the commands below as the review starting point. | Final full build/typecheck/lint/format/unit/adapter/component/Workers/HTTP/browser green; P/S/T requirement map, explicit local/visual/device/deployment boundaries |
| External | Release engineer, with owner authorization | Configure real D1 binding, exact origin, CSRF secret and intentionally provisioned credentials; qualify KDF CPU/memory at secure parameters; validate deployed flow. | No deployment under this handoff's authority. Never weaken KDF parameters, silently reset accounts, buy services or change global permissions |
| External | QA with actual devices and owner | Pixel 7 Chrome and iPhone 16 Pro Max Safari install/standalone, Back/Close, safe areas, keyboard, suspension and secret concealment. | Hardware evidence; desktop Chromium screenshots do not certify these checks |

Do not redesign, add games/features, change house rules or migrate identifiers casually. Preserve Standard black/white with mint/cyan/yellow, Romantic purple-dark/pink-light, both initially Dark, Light/Dark/System and distinct saved player pieces.

## Exact commands for the authorized continuation

The current lockfile was installed with Node 24/npm 11. Local passwords and CSRF configuration are in ignored `.local/accounts.json` and `.dev.vars`; never print or publish them. Provisioning now preserves existing credentials/preferences. Existing legacy known credentials require an explicit maintenance reset before production, not an automatic seed overwrite.

```powershell
npm ci
npm run typecheck       # currently fails at src/screens/match.tsx:417
npm run build           # after the frontend P0 repair
npm run dev             # Vite5173 + actual Worker8787, local migration/setup
node scripts/verify-dev.mjs
```

Stop dev before using the same 8787 port for production-artifact preview:

```powershell
npm run preview         # actual Worker assets/API at http://localhost:8787
```

Project-local Chromium setup and checks:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.local/browsers'
npx playwright install chromium
npm run lint
npm run format:check
npm test
npm run test:contracts  # Node SQLite adapters
npm run test:components # renderToString component tests
npm run test:integration # actual Workers plugin + isolated Wrangler HTTP
npm run test:e2e         # actual Chromium and Worker
npm run content:verify
```

HTTP suite uses 8788; browser suite uses 8789 and an authenticated loopback-only teardown listener8790. Isolated state/logs/traces stay under ignored `.local`; do not put them in public assets. Migrations are 0001 and additive0002. A duplicate existing account accent causes0002's unique index to fail; resolve deliberately. Do not delete saved state to make a test pass.

## Copy-ready Antigravity prompt

> Implement and verify the bounded Private Arcade V1 continuation in Antigravity. Read planning/review/ANTIGRAVITY-HANDOFF.md, REVIEW.md, CHANGELOG.md and the corrected execution checkpoint first. Codex was intended to prepare a plan/handoff; it implemented before the owner clarified scope and then stopped. Preserve the current dirty checkout, including preexisting edits. Act as arcade-orchestrator, read canonical profiles and frozen contracts, lease shared root files and dispatch at most three specialists with disjoint paths. Start with the actual nullable-view build failure in src/screens/match.tsx:417. Review the already-written controller broadcast/session/solo/privacy fixes, rebuild one stable artifact, then independently rerun the23 Playwright scenarios, four Workers durability/socket tests and26 actual HTTP scenarios. Preserve all eight games/modes, house rules, saved IDs, themes and offline pause. Complete final security/visual evidence and task/requirement reconciliation; label mocks/components/API-assisted browser finishes accurately. Do not redesign, reset existing accounts/data, deploy, buy services or change global permissions. If local acceptance passes, report remaining deployment/KDF-budget/physical-phone gates separately with exact prerequisites. Never claim completion from an old bundle or historical VERIFIED label.
