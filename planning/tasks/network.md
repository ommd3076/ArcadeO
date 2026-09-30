# Authority, networking and records packet — B01/C01/B02/B03

Read SYSTEM-CONTRACT, TDD, API-CONTRACT, DATA-MODEL. Use TASKS.json for exact leases/dependencies. Runtime tests must use the Worker/SQLite DO target, not a browser-only mock.

## B01: save before telling clients

Implement one acceptance pipeline: authenticated member/controller → durable receipt check → game-specific guard → pure reducer with server facts → atomic snapshot/event/receipt/private choice/outbox → durable sync → filtered reply/broadcast. No await between guard and commit that lets a second action consume the same state. No network work inside SQLite transaction.

Start with real Connect Four adapter; lead integrates remaining registry modules. WS/HTTP actions share this path. Native hibernation attachment is identity/expiry/generation only. Check current session authorization on each write. Receipt retries return original acceptance identity plus safe current view; mismatched ID/payload rejects.

Creation reserves registry/unique slot keys atomically, initializes DO idempotently and repairs partial initialization. Terminal projection/version/slot release cannot regress when older outbox arrives. Alarm retry does not block accepted moves. Controller takeover is explicit; old writer rejected. Invitation/readiness/resign/abandon/terminal rules exact.

## C01: resync before interacting

One match session reducer holds filtered saved state, delivery version, pending command and connection/auth/control status. Immediate selection/press may respond; board/score waits for acceptance. Scope nonsecret pending metadata to account/match session storage. Do not store secret lock value or queue offline edits.

Load/pageshow/focus/reconnect: conceal secrets first → fetch latest view → reconcile pending receipt → enable legal input. Drop old versions; gap means snapshot. Unknown acceptance is not a rejection. Retry identical nonsecret ID/payload; no reroll. Secret recovery atomically preserves accepted lock or supersedes pending ID before reselecting an empty slot; empty snapshot alone is insufficient. Store only secret action metadata, not value. HTTP fallback uses same authority and visible-only polling/backoff.

Catch-up renders current board immediately; animation cannot replay a backlog. Back works while pending/offline; saved match is preserved.

## B02: register all rules, complete special creation seams

Lead alone changes shared registry/protocol/router seams. All eight adapters/view/effect actions must be typed and actually functional. Integrate S02 private Sudoku without generic shared view leaks. Publish challenge creates a new waiting match from immutable server result, not a mutation of completed sender attempt.

Lifecycle catches explicit together resigning seat, cancellation/acceptance races and unranked replay terminal states. Same rules for remote/together. Unsupported version becomes read-only; no reset. Repeat WS/HTTP and simultaneous private-flow checks after integrating engines.

## B03: projection-backed records/preferences

Account palette family save is versioned; device mode remains local. Enforce distinct player accent atomically, including concurrent requests. Profile changes cannot alter saved match identity.

Results derive once from distinct versioned terminal projections. Separate solo practice, competitive/together, assisted/replay, cancelled/abandoned and forfeits. Explicitly unranked Sudoku scored=false excludes shared played/wins/streaks. Implement Asia/Calcutta/Monday grouping and stable chronological streak ordering. Archive lag labels syncing; discovery failure is not empty.

## Exit evidence

N01–N16/A01–A10 relevant cases: lost ack, duplicate/mismatch, commit fail, hibernation, simultaneous locks/own edits, creation/takeover/lifecycle races, old projection, revoked socket, fallback/version/privacy and uncertain-secret recovery. New mutation endpoints never bypass DO. Record actual resource/config limits.
