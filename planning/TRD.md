# Technical requirements document — V1

Use [SYSTEM-CONTRACT](SYSTEM-CONTRACT.md) for authority and [TDD](TDD.md) for module design. This document describes measurable requirements, not a claim that runtime or deployment checks passed.

## Functional technical requirements

| ID | Requirement | Verification |
| --- | --- | --- |
| T01 | One authoritative SQLite Durable Object per match/attempt | Restart/hibernation recovery produces identical legal actions and snapshot; D1 cannot alter active score |
| T02 | Pure versioned rules for eight games | Deterministic fixtures, serialization round trips, legal/illegal/terminal checks for each game |
| T03 | Acceptance follows durable atomic commit | Failure injection at snapshot/event/receipt/outbox boundaries; no accepted-but-unsaved response |
| T04 | Idempotency and correct concurrency guards | Same ID/payload returns original safe outcome; mismatched reuse rejects; simultaneous secret locks/independent Sudoku edits both work |
| T05 | Fixed-account session authorization on every write | Unauthorized account/seat, revoked/expired socket, Origin/CSRF and controller-transfer tests |
| T06 | Private views across all delivery paths | HTTP/snapshot/socket/event/receipt/log/cache tests before lock resolution and together reveal |
| T07 | Versioned discovery/results with repair | Concurrent creation, partial initialization, stale projection, archive lag and double-count tests |
| T08 | Reconnect and offline input pause | Lost acknowledgment, refresh/background, delivery gap, WS failure/HTTP fallback and secret masking |
| T09 | Continuous server competition time | Reload/offline/background cannot reduce duration; practice-only pause measured server-side |
| T10 | Verified Sudoku content and eligibility | 1,000 unique puzzles, exactly one solution each, 250 per bucket; no private solution in client bundle |
| T11 | Small responsive PWA | Same-origin Worker assets/API, versioned public-only shell caching, standalone safe-area navigation |
| T12 | UI state and motion separated from authority | Skip/interruption/duplicate event/reduced-motion cannot change turn/score/phase |
| T13 | Theme family/mode and player identity separated | Standard/Romantic × Light/Dark, account/device persistence, midmatch changes and accent collision tests |
| T14 | Honest release evidence | Local functional, visual, actual-device and deployed status recorded independently |

## Dependencies and performance

Use the minimal stack in SYSTEM-CONTRACT: React/TypeScript/Vite/Router, Worker/DO/D1, Lucide, CSS/SVG, Vitest/Workers integration/Playwright. No full game application, state-management framework, ORM, multiplayer framework or animation library. Pin compatible stable versions from current primary docs and lock installed dependencies. KDF qualification may need one vetted library; document why and retain notices.

Measure rather than promise network latency. UI press feedback starts within one paint; accepted movement normally 200–600 ms, long travel capped about 1,200 ms. Input waiting must display pending/reconnecting state rather than a frozen board. Two players never wait for the other's rendering queue. Avoid per-frame React global updates and per-match server intervals; use native WebSocket hibernation and alarms for retry.

Initial engineering budgets: public app JS at most 250 KiB gzip excluding self-hosted font files, no all-puzzle client payload, no all-icon imports, no unbounded polling/history rendering. Record measured size and explain any justified exception. This is a target, not a reason to omit a game or security requirement. Paginate history/puzzle lists; retain durable accepted receipts/events for V1 rather than invent deletion jobs.

## Security and configuration

Qualify a vetted password KDF with known vectors and measured Worker CPU/memory at documented recommended parameters; see SYSTEM-CONTRACT and [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). A runtime mismatch blocks production auth, not unrelated UI/rules work. Never weaken parameters silently. No custom crypto, default real passwords, development bypass deployed to production, public puzzle solutions or trusted client finish times.

Use secure opaque session cookies, session-bound CSRF, exact Origin checks and ongoing socket write authorization. Primary D1 consistency is required for revocation checks. Login failures have generic copy and bounded persistent rate limits. Fixed account provisioning reads environment input without echoing secrets; seed repeatably without overwriting existing credentials unless explicitly reset.

Supply an example config with names only: account usernames/display names, local/deployed origin, D1/DO bindings and credential provisioning inputs. Keep .dev.vars/.env and session/database dumps untracked; static config has no password. Logs include IDs/categories/durations, not choices, entries, solutions, cookies or credentials. Avoid external telemetry in V1.

## Reliability and compatibility

All external awaits happen outside the atomic rules transaction. A response can be lost after commit; the original action ID/receipt is the recovery path. DO snapshots pin schema/rules/board/puzzle versions. Migrate explicitly with fixtures; unsupported data becomes readable recovery state, never reset. D1 failures leave saved moves intact and retry projections through outbox/alarm.

Initial supported browsers are current Chrome on Pixel 7, Safari on iPhone 16 Pro Max, and current laptop Chrome/Safari where available. Automated Chromium/WebKit tests approximate browser behavior, not actual phone/PWA certification. Navigation must work without browser chrome. Android Back dismisses top route/modal before navigation; iPhone has visible Back/Close. Responsive checks include 320–430 px portrait, short heights, safe areas and text scaling.

The service worker caches public assets only. API/auth/solution payloads use no-store; SPA fallback never swallows API errors. Updates during gameplay require safe reload, protocol compatibility and resync. Offline launch may show shell but never imply an authenticated playable match without server verification.

## Adoption gates and unresolved external checks

No further broad product discussion is required. During implementation measure: selected KDF/runtime budget, dependency licensing and bindings, puzzle-bank validation, rendered contrast/fidelity and PWA behavior. Deployment needs actual credentials/account access and current Cloudflare limits; hardware certification needs the phones. Record unavailable external checks with exact evidence and next action while completing independent tasks.

All tests/checks are specified in [TEST-PLAN](TEST-PLAN.md); task evidence is recorded in execution reports. A build pass alone fulfills none of T03/T06/T08/T14.
