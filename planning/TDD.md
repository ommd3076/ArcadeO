# Technical design document — V1

This TDD means Technical Design Document. Test strategy is in [TEST-PLAN](TEST-PLAN.md). It refines [SYSTEM-CONTRACT](SYSTEM-CONTRACT.md) without introducing a second source of game rules.

## Modules and ownership seams

Proposed structure (create during implementation, not present merely because listed):

```text
src/app/                         routes, auth bootstrap, shell
src/components/                  small shared controls/surfaces
src/theme/                       semantic tokens, family/mode resolver
src/sync/                        match session, transport, recovery, pending metadata
src/screens/                     Home, Games, detail, Us, appearance
src/games/<game-id>/              board/controls and event-effect rendering
shared/protocol/                 action/envelope/view schema and errors
shared/games/<game-id>/           pure state/reducer/legal actions/filtered view
worker/auth/                     verifiers, sessions, authorization, rate limit
worker/api/                      same-origin routes
worker/matches/                  DO, creation/reservation, views, projections
worker/sudoku/                   catalog issuance, private solution checks
migrations/                      D1 migrations
scripts/                         fixed-account provisioning, verified content import
public/                          manifest/icons/self-hosted fonts
tests/fixtures/                  deterministic rule/recovery fixtures
tests/unit/ tests/integration/ tests/e2e/
```

Orchestrator owns shared protocol/config/package/lock/schema integration unless explicitly leased. Game-engineer owns assigned shared/games modules; frontend worker owns distinct src/games screens. Backend owns worker paths; QA tests disjoint paths. No two writers own one file. Components remain few and functional; do not invent a general plugin/scene framework.

## Engine contract

Use explicit per-game discriminated types with a small exhaustive registry/switch. Common context contains rules version and supplied accepted time/random data, not a clock service embedded in the reducer.

Conceptual exports: createInitialState(config, suppliedStartFacts), validateAndReduce(state, command, acceptedFacts), legalActions(state, seat), toPublicView(state, viewer). Reduction returns either typed rejection with unchanged state, or new serializable state plus deterministic effects/outcome. Secret engines' internal state remains server-only. Public view types cannot accidentally include private entries/solutions.

Shared reducer context is not permitted to call I/O, Math.random, Date.now or animation. The acceptance layer supplies dice/toss/time. Persist and test exact accepted command facts; compare replayed state in rule fixtures. Store full snapshots rather than rebuilding every read from events. Events support delivery/effects/debugging, not a V1 replay feature.

Effects form explicit game unions: accepted die, token path/captured ID, disc destination/winning cells, edge/box owners, placed letter/scored line IDs, secret round result, cricket roles/innings/target, Sudoku own-cell diff/progress/terminal. Viewer filtering removes secret facts from every path before delivery. Event effects never grant authority to the UI.

## Match state and activation

Snapshot contains match ID, game/mode, schema/rules/board version, lifecycle, participants, active phase/turn/round, current game state, readiness, controllers, eligibility and terminal result where present. Terminal result IDs are match IDs; rematch creates a new ID.

waiting → active → completed/resigned/abandoned; waiting may become cancelled. Accept/decline/cancel serialize through DO. Remote invitation acceptance and both Ready are distinct; together We are both here represents both. Duel Ready schedules a start three seconds ahead. Snapshot sent before start omits givens, entries and solutions; a request at/after server start can activate/deliver them. Timer correctness cannot depend on an alarm firing exactly on time. Use an alarm or later access to materialize scheduled activation idempotently.

Solo practice/sender creation fixes a server start when the attempt is accepted. Published async receiver Accept fixes receiver start; sender result is immutable input. Replay receiver is explicitly unranked; completion is saved but does not increment competitive records. Declined/cancelled/abandoned are unscored; active resignation gives forfeit as documented.

Together secret readiness is presentation state plus saved next-choice seat. A Ready UI may remain ephemeral because the server validates expected seat on lock; saved locks/reveal permission are authoritative. Refresh/focus covers first, fetches state, then offers outstanding chooser or Reveal together. For together resign, a strict A/B resigning-seat payload is permitted only on match.resign under trusted controller; other game actions derive seat from state. Remote ignores/rejects seat claims.

## Acceptance pipeline

1. Worker authenticates current session/access, validates protocol/payload and Origin/CSRF where relevant.
2. DO obtains durable snapshot and looks up actor + action ID receipt. Return identical canonical payload receipt; reject different payload reuse.
3. Validate current session/controller and applicable guard. No network request occurs inside the rules transaction.
4. Supply cryptographic random facts/time, reduce and generate safe effects/outcome. Serial acceptance must not yield between guard/reduction/commit; concurrent handlers cannot both consume a turn.
5. Atomically write snapshot/event/receipt/private choices/outbox through SQLite transaction APIs. Wait for documented durable storage synchronization.
6. Return filtered accepted response and broadcast filtered views/events. Then attempt D1 projection outside the transaction; schedule capped retry if necessary.

Uncertain secret recovery is a small atomic metadata path, not a reducer move: current authorized actor supplies pending action ID/round/controller without its raw choice. If the original receipt exists, preserve acceptance and return safe lock status. Otherwise save a superseded receipt tombstone; late original lock rejects ACTION_SUPERSEDED. Guard receipt lookup/tombstone under the same serialization as normal acceptance. Permit a new selection only after confirmed recovery and latest empty own slot, never on an empty snapshot alone. Keep tombstones server-side for match lifetime.

Recheck authorization on every new write, including open sockets. Receipt reads require current authorized membership; prior accepted response recovery does not authorize a new action after revocation. A stored receipt returns the original accepted version/event identity plus the latest filtered snapshot so retries cannot regress the UI or disclose a previously masked value.

Turn games guard expectedVersion + turnId; lifecycle uses its version; secret locks use roundId + empty own-seat slot; Sudoku uses own progressRevision/controller generation. Other-seat events do not invalidate a legal pending secret/Sudoku operation. WS and HTTP use one pipeline; do not implement separate reducers.

## SQLite DO and D1 roles

[DATA-MODEL](DATA-MODEL.md) specifies keys/fields. DO tables are current snapshot, accepted events, receipts, private round choices and projection outbox. SQLite writes are local/atomic. D1 contains accounts/sessions, catalog, discovery, slots and outcome projections; it does not accept independent game moves.

Creation requires creationId + canonical payload digest. Reserve deterministic slot keys and registry row atomically in D1; initialize DO idempotently, then mark discoverable. Discovery includes pending initialization with retry status. After ten minutes, cleanup checks DO status before releasing reservation. Never delete initialized active data. Projection writes have version predicates and unique keys; old outbox replay cannot resurrect active slots after a newer terminal projection.

D1 outbox failure does not undo a move. DO alarm retries latest required projection and slot release with capped backoff. Login/refresh/resume repairs held terminal slots by asking DO before replacing. Records are distinct terminal rows; calculate streaks in a stable chronological order (finishedAt, matchId) in Asia/Calcutta.

## Sudoku internals

Import 250 per bucket from reviewed local bank. Store givens/rating/provenance/puzzle version, private validated solution and catalog selection manifest. Own bounded solution-count solver is an offline import tool; it stops at two solutions. No generator dependency, whole-puzzle client bank or human hint engine.

Progress per account: 81 entries, 81 note masks, own revision, accepted undo stack, startedAt, pausedAt/totalPausedMs, assisted/replay/recordEligible and completedAt. Validate immutable givens, digit range and note masks. Undo stores inverse entry/note diffs; it does not reset clock/assistance. Check returns own incorrect-cell IDs only and permanently sets assisted. Timer derives server timestamps minus accepted practice pause intervals; never trusts a client duration.

For duel, allow independent own revisions despite global delivery sequence. First complete correct board accepted wins atomically and freezes both editing states. Opponent view exposes filled count, lock/readiness and terminal metadata, not board/notes or correctness. Sender target/receiver duration are server-owned; compare floored whole seconds for async draw. Already-completed puzzle eligibility is checked server-side on issuance/acceptance.

## Frontend state and motion

One match-session reducer owns latest filtered snapshot, last delivery version, connection/auth/control status and one pending board command. Keep raw secret selection only in ephemeral screen memory until accepted lock; clear before handoff/logout/route/focus concealment. Nonsecret pending metadata is scoped by account/match in session storage; do not persist password/choices/entries for offline replay.

Transport tries native WS then authenticated HTTP. Missing versions/out-of-order messages trigger snapshot; ignore old deliveries. On focus/pageshow/reconnect mask first, reconcile pending receipt, obtain latest view, then permit input. Catch-up settles board without long animations. Timers extrapolate from server time for display only and resync on focus; terminal duration is server data.

Presentation reducer may track selected cell/token, notes tool, local animation progress and settle requests. It cannot modify authoritative score/position. New accepted effects keyed by event ID create bounded transition; snapshot replacement/Back/reduced motion cancels to saved state. No animation callback sends an automatic game action except an explicitly requested user's Next handled through ordinary acceptance.

## Auth, routes and PWA

Implement current SYSTEM-CONTRACT cookie/CSRF/KDF/authorization requirements. Login returns only fixed profile/session CSRF metadata; no verifiers. WS Origin is checked at upgrade; actions reauthorize. Logout clears pending/private screens and revokes matching session sockets. Auth store failure blocks writes with retry; do not imply successful logout.

Routes are in API-CONTRACT and SYSTEM-CONTRACT. Client navigation never performs resignation. Match pages recover from direct links; server assets fallback excludes /api. Public-shell-only cache has explicit version; auth/API always no-store. Old protocol disables writes and requests safe update. Keep existing rule-version reducers/migrations while saved matches exist.

## Integration gate

A playable Connect Four remote/together slice must prove auth → creation → saved action → filtered delivery → refresh → completion → result projection before repeating UI for every game. RPS then proves simultaneous/private/together locks. Sudoku proves independent revisions/private progress/time. Subsequent games reuse these paths, not cloned backend pipelines. Test details and task dependencies are explicit in TEST-PLAN and IMPLEMENTATION-PLAN.
