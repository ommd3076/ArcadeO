# V1 system contract

Status: implementation baseline, 2026-09-30. Product questions are resolved. Library/runtime measurements remain implementation gates. This document defines boundaries; it does not claim a deployed system.

## Architecture and dependencies

One Cloudflare Worker serves Vite-built React/TypeScript assets and a same-origin API. One SQLite Durable Object (DO) per match or solo attempt is the saved referee. D1 stores accounts, sessions, appearance, Sudoku catalog/solutions, discovery and result projections. Native WebSockets deliver updates; authenticated HTTP uses the same DO acceptance path as fallback. No Express, Socket.IO, framework-sized game engine, global state library, ORM or animation library.

Use React Router for explicit client routes/history, local React reducers for screens, shared pure TypeScript engines, CSS/SVG motion, and Lucide icons. Toolchain: npm, TypeScript, Vite, Wrangler, ESLint, Prettier, Vitest plus Cloudflare's Workers test integration, and Playwright for browser flows. Pin mutually compatible versions and a lockfile during scaffolding; no unverified version numbers are mandated here.

DO owns all live rules state, lifecycle, private choices, action receipts and final outcomes. D1 is never an alternate active-match authority. Its result/archive data can lag and be rebuilt from saved DO projections. No per-move D1 round trip is required for gameplay persistence; session authorization checks are a separate concern.

## Engine boundary

Per-game module exports initial-state construction, input validation/reduction, legal-action derivation and role-filtered views. State is plain serializable data, never DOM nodes, EventEmitters, closures or timers. Use explicit discriminated unions, not a generic plugin framework.

Accepted event includes saved dice/toss outcome, server time when relevant, actor seat/account and deterministic effects. Reducers produce new state and effects; effects describe paths, captured token IDs, scored lines/boxes and phase/turn changes. The server commits those facts; UI consumes them. `Math.random`, `Date.now`, browser storage and network calls are forbidden inside reducers. Random dice use server cryptographic sampling with rejection to avoid modulo bias.

## Identity and login

Two preseeded stable accounts A/B, no signup or email. Usernames/display names are configuration, not game seat IDs. Prefer passwords to short PINs. Store only salted versioned password verifiers and opaque session-token hashes. Real credentials are supplied through local/deployment secrets during setup, never tracked or sent to the frontend. Manual owner reset is a maintenance operation, not an app recovery feature.

Select a vetted Worker-compatible password KDF during foundation qualification, following [OWASP password storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). First candidate: Argon2id at at least 19 MiB, two iterations and parallelism one. A different documented KDF is permitted only with its recommended work factor and known-vector/runtime resource evidence; algorithm choice is an engineering adoption gate, not another product question. Measure against the configured CPU/memory budget. Do not silently reduce work factors to pass; inability to qualify a secure affordable option blocks production login with a documented technical resolution. No custom cryptographic implementation.

Session cookie: `__Host-arcade-session`, HttpOnly, Secure, SameSite=Lax, Path=/, no Domain; random 256-bit token, fixed 30-day expiry, rotate on login. Check expiry/revocation for every write. Logout revokes the session, clears browser private state and closes matching sockets; another device's distinct session remains valid. Use D1's primary session for auth/revocation checks rather than stale replica reads. During auth-store failure, deny new writes with a retryable error; show saved state instead of pretending logout or acceptance succeeded.

Mutating HTTP requests require exact allowed Origin plus session-bound CSRF token/header. Derive the token reproducibly using Web Crypto HMAC-SHA-256 with a separate configured CSRF secret, a purpose tag and the raw opaque session cookie; store/check its hash. This permits authenticated session bootstrap to return the token after refresh without storing plaintext or making up a new unmatched token. Use standard primitives, not custom cryptography; rotation invalidates/rotates affected sessions deliberately. WebSocket upgrade checks Origin and cookie; attachment holds account/session ID, expiry and controller generation, never credentials or choices. Socket openness is not ongoing authorization. Unknown usernames and wrong passwords share one error. Rate-limit login by normalized account and IP with persistent bounded counters; initial default five failed attempts per account per 15 minutes, 20 per IP, with no permanent lockout.

## Remote and together control

Remote actor seat is derived from authenticated membership; reject a claimed different seat. Together explicitly grants one controlling session authority for both fixed seats, with the active/expected seat still validated by rules. Log host account and acting seat separately. This is trusted pass-and-play, not repeated authentication.

Persist `controllerGeneration` and controlling session. Continue on this device increments generation atomically; old devices become read-only. Sudoku similarly has one editing controller per account/attempt. Turn games on several tabs remain safe through version/turn checks. Read-only tabs can request takeover deliberately; never transfer just because a tab received focus. Together and remote modes cannot switch midmatch.

## Protocol

Client action envelope: `protocolVersion`, `matchId`, UUID `actionId`, discriminated `action`, `payload`, and the applicable guard: `expectedVersion`, `turnId`, `roundId`, `progressRevision`, `controllerGeneration`. The client cannot supply an authoritative actor, random outcome, score or timestamp.

Server response: `accepted`/`rejected`, `actionId`, stable error code if rejected, accepted event ID/version, `serverTime`, and the caller's filtered view. Events have account/seat, server timestamp, rules/schema version and effects. Use contiguous delivery versions for snapshots/events, but game-specific concurrency guards for legality.

Validation order: authenticate/access-check; read any matching durable receipt; return explicit superseded rejection if that ID was recovered/cancelled before acceptance; otherwise compare its canonical payload digest and return it if identical; reject ID reuse with different payload; validate controller and game-specific guards; reduce; commit. Receipts contain no raw secret values. Payload digests are private server data, never returned, since small choice sets are guessable from hashes. Keep accepted receipts and explicit recovery tombstones for the match lifetime; ordinary invalid retries do not reserve a successfully accepted action ID.

Together actor derivation uses the saved active seat for turn games and the saved next-choice seat for secret games; do not accept a freely claimed seat. Alternate first-choice seat by round/delivery. The trusted controller can acknowledge readiness for both seats where the contract specifies it. Narrow exception: together `match.resign` requires an explicit strict A/B `resigningSeat`, because the controller represents both people and forfeiting the active seat without asking would be ambiguous. Remote resignation always derives the seat from authentication.

### Action vocabulary and stored tables

| Action | Payload | Guard / meaning |
| --- | --- | --- |
| `match.accept`, `match.decline`, `match.cancel`, `match.ready` | none | Lifecycle version, account membership and readiness slot |
| `match.resign`, `match.request-abandon`, `match.agree-abandon` | together resign only: resigningSeat A/B; otherwise none | Current lifecycle version; server records actor and outcome |
| `dice.roll` | none | Turn/version; server supplies saved die, never the client |
| `ludo.move` | token ID 0–3 | Pending accepted roll plus turn/version |
| `connect-four.drop` | column 0–6 | Turn/version |
| `dots-boxes.edge` | two dot coordinates | Turn/version; canonical adjacent edge |
| `sos.place` | cell coordinate, S or O | Turn/version |
| `secret.lock` | RPS choice or cricket number | Round ID, per-seat empty submission slot |
| `secret.reveal` | none | Together controller, resolved unrevealed round |
| `secret.next` | none | Resolved/revealed round, per-seat readiness; together represents both |
| `cricket.choose-role` | bat or bowl | Toss-winning seat and phase version |
| `sudoku.edit` | cell, set-digit/erase/toggle-note operation | Own progress revision and controller generation |
| `sudoku.undo`, `sudoku.check`, `sudoku.pause`, `sudoku.resume` | none | Own revision and mode/phase; practice-only check/pause/resume |
| `challenge.publish` | eligible completed sender attempt ID | Creation pipeline validates server-owned result/puzzle and initializes a new challenge idempotently; not a move on the completed attempt |

Completion is evaluated atomically on accepted board edits; there is no client-trusted Finish or score submission. Takeover is an authenticated controller endpoint, not a reducer action. Publishing a challenge creates a new waiting match from an immutable eligible sender result; it never reopens or edits the terminal sender attempt. Schema validates integer coordinates/ranges and exact payload shape before reduction; unknown fields/actions reject.

D1 tables: `accounts` (fixed ID, normalized username, verifier/version, display name, accent, paletteFamily, preferenceVersion), `sessions` (token hash, account, CSRF hash, expiry/revocation), `login_limits`, `puzzles` (stable ID, manifest version, givens, private solution, rating/bucket/provenance), `match_registry`, `active_slots` (unique slot key, match/creation ID), `results` (unique match ID, version, game/mode, winner/reason/times), and `sudoku_records` (attempt/account/puzzle, assistance/replay eligibility, duration/completion). Results and Sudoku records are projections, not active progress. Preference writes are versioned and atomically enforce distinct account accent families. Palette family is account-level; Light/Dark/System mode stays in account-scoped local device preferences. Initial A=Standard-dark, B=Romantic-dark.

DO tables: singleton `match_snapshot` (complete state/schema/rules/board versions), `events` (unique sequence and event ID), `action_receipts` (unique authenticated actor/action ID, private digest, safe receipt), `private_round_choices` (unique round/seat), `projection_outbox` (latest required archive version) and controller/readiness data either in snapshot or keyed rows under the same transaction. Do not duplicate current progress in an independently writable D1 table.

Turn games require the current turn ID and expected version. Secret submissions require round ID and that seat's empty slot, not a shared expected version, so simultaneous locks both succeed. Sudoku edits require that player's progress revision/controller, not the opponent's revision. Lifecycle transitions serialize under DO authority. Rejections such as `STALE_STATE`, `NOT_YOUR_TURN`, `CHOICE_LOCKED`, `CONTROL_TRANSFERRED`, `MATCH_FINISHED`, `AUTH_REQUIRED`, `UNAVAILABLE` leave rules unchanged and carry recovery guidance.

## Atomic acceptance and archiving

Each DO stores one current snapshot, append-only accepted events, action receipts, private submissions, schema/rules versions and a pending D1 projection record. Use synchronous SQLite transaction APIs for related SQL writes; no network work inside the transaction. Explicitly wait for durable storage synchronization before acceptance or broadcast. Never send via an unconfirmed-write path. [Cloudflare storage transaction and sync documentation](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

Commit snapshot/event/receipt/outbox together. An uncertain response is retried with the same action ID. Dice are sampled once for that acceptance and written into the event; a transaction failure does not produce a publicly claimed roll. Client messages never trigger a second roll for an already accepted request.

After acceptance, write a versioned D1 projection. An older version cannot overwrite a newer one; result rows are unique per match and stats derive from distinct terminal rows. A DO alarm retries pending projection with capped exponential backoff; also retry on later match activity. Projection failure delays records, not accepted moves. Retain events/snapshots without automatic V1 deletion. No distributed transaction is assumed.

## Creation, slots and lifecycle

D1 match registry fields include match ID, creation ID, game/mode, participants, slot keys, initialization status, DO ID, projected lifecycle/version, rules/board version and timestamps. Reserve slots atomically before initializing the DO. Match/slot reservation uses one D1 transaction/batch and unique constraints. Initialize idempotently by creation ID, then mark discoverable/playable. A crash before completion leaves a retryable reservation. A reservation without a DO expires after ten minutes only after checking initialization; no active DO is automatically deleted. A mismatched repeated creation payload rejects.

Slots: one remote and one together match per game; separate Sudoku duel slot, one practice attempt per account, one async sender attempt per account and one pending/active published challenge per direction. Challenge receiver attempts belong to that challenge's slot. Different games/modes may coexist. A resume card names game, mode and active seat/phase. An occupied slot offers Resume, never reset. Terminal projection lag may temporarily hold a slot; reconciliation reads the DO and releases it safely before replacement.

Lifecycle: `waiting`, `active`, `completed`, `resigned`, `abandoned`, `cancelled`. Invitation rejection maps to cancelled with reason `declined`. Waiting invitation accepts/declines explicitly and allows creator cancellation. Both remote seats Ready before activation; together uses We are both here. Async receiver acceptance is readiness/start for their attempt. Cancellation and acceptance races are decided in the DO; terminal transitions cannot be reopened.

Remote abandonment needs both seats' agreement; reject proposals while any action is uncertain and clearly show the pending request. Resignation is unilateral and gives a forfeit. Together controller can agree for both. Solo discard/abandon is unscored. No automatic expiry of active matches; seven days without a game action shows Dormant as a label only. New-device login discovers saved matches through D1; registry failure shows unavailable rather than an empty list.

## Secret rounds and privacy

RPS and Hand Cricket store choices privately until both lock. Prior locks are immutable. All remote views expose only the caller's current unsubmitted selection locally and public lock status; opponent values never appear before resolution. Together views omit even earlier submitted own-seat values. Clear local selection before handing off. Never persist raw choices in URLs, local/session storage, app-shell caches, telemetry, errors or action receipts.

One saved result is calculated when both locks exist. Fresh remote responses may then include both revealed values. Together remains masked until its explicit Reveal together action; filter every snapshot, event and receipt accordingly. Reveal is persisted as presentation permission so navigation cannot accidentally disclose a saved but unrevealed result. It does not change scores. Refresh/focus starts on a neutral panel. After resolved/revealed result, both remote seats Ready or one together Next starts a new round exactly once. Invalid late locks cannot land in a later round. No animation callback advances rounds.

Protect ordinary handoff/refresh flows; the shared-device owner remains trusted. There is no screenshot, shoulder-surfing or developer-tools anti-cheat claim.

## Recovery, offline and HTTP fallback

On load, refresh, reconnect, `pageshow`, focus after suspension, or takeover: mask secrets, request latest filtered snapshot, reconcile pending action receipt, then enable input. Drop old versions. A missing delivery version triggers a full snapshot, not guessed replay. Catch-up renders the latest board without replaying a long animation queue.

Persist only nonsecret pending action metadata in account/match-scoped session storage; clear on acceptance/logout. Secret metadata may retain actionId/roundId/controller generation, never choice. An uncertain secret lock is recovered through an authenticated atomic recovery endpoint: if already accepted, return lock status/current filtered view; otherwise persist a superseded tombstone for that actor/action ID before permitting reselection. A late original request then rejects instead of locking the abandoned choice. Empty snapshot alone is not proof that an in-flight request cannot still arrive. If recovery is uncertain, keep input paused and retry recovery; if locked, preserve it. One pending board command per local controller; immediate press feedback is allowed but board/score commits wait for acceptance.

Offline disables submissions in every V1 mode. Show last saved state and Reconnecting/Offline, with retry. Competitive Sudoku time continues; an accepted practice pause remains paused. No offline action queue. Back remains available while offline. If WebSocket fails, HTTP snapshot/action endpoints use the identical server pipeline; poll only while the match is visible, initially every three seconds with capped backoff. Include server time in snapshots to synchronize visible timers; background tabs do not poll continuously.

Hibernation attachments retain only connection identity/metadata; rules always load from DO storage. Connections or in-memory variables are not saved state. Use the native hibernation API, avoid per-match intervals and preserve attachments explicitly. [Cloudflare WebSocket guidance](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## Routes, storage and PWA

Client routes: `/login`, `/`, `/games`, `/games/:game`, `/matches/:id`, `/us`, `/us/appearance`. Server verifies match ownership on every read/write. Unknown/inaccessible IDs show a neutral unavailable screen and Games action; completed matches show saved result. Login preserves only a validated internal return route. Browser Back and visible Back/Close never resign.

API groups: auth/session/login/logout; profile/preferences; catalog; match discovery/create; per-match snapshot/actions/receipt/controller/socket; results/history. All match mutation endpoints delegate to the same DO. Static routing must never return the SPA HTML for `/api/*` failures.

Service worker caches versioned public shell/fonts/icons only. `/api/*`, private snapshots, solutions, auth responses and logged-in HTML data are `no-store`; nothing private in precache. Offline launch shows cached shell with sign-in/connectivity requirements. Update available is applied after leaving gameplay or explicit safe reload, with accepted state already saved. Protocol mismatch disables writes and requests update; retain reducers/migrations for existing saved rules versions. Manifest includes standalone display, working icons and launch route; installation is verified on the actual target phones before release.

## Records and failures

Basic V1: weekly shared finished games, overall/per-game head-to-head wins/draws, recent results, separate solo Sudoku completion/best times, current shared play-day streak and per-game win streak. Asia/Calcutta, Monday-start weeks. Competitive/together filters remain explicit. Cancelled/abandoned attempts do not count as played; forfeits count as shared finished games, flagged in history, but cannot set normal speed records. A draw ends a win streak; abandonment/cancellation leaves it unchanged. Current play-day streak counts consecutive days ending today or yesterday with a scored shared completion; otherwise zero. No extra milestone economy or replay UI.

Outbox lag may label statistics syncing. Authority/auth outage disables moves without fabricating results. Distinguish waiting, pending, reconnecting and terminal states. Logs contain request/event IDs, error categories and timings; exclude passwords, cookies, choices, Sudoku entries/solutions. Quota/pricing and deployment limits must be rechecked at deployment; no free-cost guarantee is asserted.

Schema migration and engine qualification are required implementation checks. A saved unsupported version yields recoverable read-only state, never silent reset. Tests must prove crash/retry/idempotency, stale-controller rejection, filtered secrets, D1 lag recovery, DO reload and terminal immutability. [Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) is the selected runtime test approach.
