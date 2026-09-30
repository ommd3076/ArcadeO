# Persistent data model

Schema blueprint; migrations/tables do not yet exist. SQL types and indexes are engineering details within these keys/invariants. Use D1 migrations and SQLite DO schema versions. Keep no second writable copy of live progress.

## D1 tables

| Table | Essential fields and invariants |
| --- | --- |
| accounts | fixed A/B primary key; normalized username unique; displayName; versioned salted verifier; accentFamily; paletteFamily; preferenceVersion. Seed A Standard, B Romantic; initial accents teal/violet. |
| sessions | tokenHash primary key; accountId; csrfHash; issuedAt/expiresAt/revokedAt; stable sessionId unique. Never store raw session token. |
| login_limits | bounded account/IP bucket key; windowStart; failures/blockedUntil; prune expired bounded rows during access/maintenance |
| puzzles | stable puzzleId + catalogVersion; displayNumber within bucket unique; givens; private solution; rating; bucket; sourceDigest/provenance. 250 per group. |
| match_registry | matchId primary key; creationId + creator unique; payloadDigest; game/mode/participants; DO name; initialization state; lifecycle/phase/projectedVersion; schema/rules/board/puzzle versions; created/started/finished/lastAction times |
| active_slots | slotKey primary key; matchId; creationId; reservedAt. Multi-slot reservation is atomic; never replace active row blindly. |
| results | matchId primary key; projectedVersion; game/mode; participants; terminal reason/winner/draw/eligibility; scores/durations; finishedAt; starter/rematch reference as needed |
| sudoku_records | attemptId + accountId unique; puzzle/version; mode; elapsedMs; assisted/replay/eligible; completedAt; result/challenge link. Source is DO projection, not posted client score. |

Palette family is server account preference; resolved mode is device-local. Updates to both accounts' accent identity must enforce distinct family atomically, including concurrent preference writes. No independent assignments can pass a stale conflict check.

Slot keys: shared:<game>:remote and shared:<game>:together for seven games; sudoku:duel shared; sudoku:practice:<account>; sudoku:sender:<account>; sudoku:challenge:<sender>:<receiver>. Published challenges may reserve their directional slot without blocking opposite direction. Receiver progress belongs to published challenge. Sender terminal attempt releases sender slot independently. No generic one-match-only global limit.

Creation registry/reservations commit together; initialized DO is discoverable only after successful idempotent initialization. Uninitialized reservation timeout is ten minutes with DO check; terminal projection/reconciliation releases slots by matching match ID, not any row currently occupying that key.

## Per-match/attempt SQLite DO

| Table | Essential fields and invariants |
| --- | --- |
| match_snapshot | singleton; deliveryVersion; schema/rules/board/catalog version; canonical complete state; lifecycle/controller/readiness/result. JSON serializable rules state. |
| events | sequence primary key; eventId unique; actionId/actor account/acting seat; acceptedAt; rulesVersion; accepted facts/effects. Secret fields private until safe projection. |
| action_receipts | actor key + actionId primary key; accepted or superseded disposition; canonical payloadDigest private for accepted actions; accepted version/event ID, or round-bound recovery tombstone. Re-filter current view on delivery; superseded unaccepted ID can never later lock. |
| private_round_choices | roundId + seat primary key; locked value; acceptedAt/actionId. Only server logic reads prior to reveal permission. |
| projection_outbox | projection key primary key; requiredVersion; payload/retry count/nextAttemptAt. Coalesce to newest projection; retain pending terminal outcome until D1 acknowledged. |

All related acceptance writes share one synchronous SQLite transaction. Ordinary rejections do not increment board/turn/revision or create accepted receipts. Deliberate authenticated uncertain-secret recovery may persist a superseded tombstone without changing game score/turn; it never cancels an accepted receipt. Partial writes/failed synchronization cannot be acknowledged. Events/receipts/tombstones are retained for V1; no deleting active snapshots to save quota.

Snapshot state carries game-specific turnId/roundId, legal pending roll, private Sudoku progresses/undo/clock facts, controller generation/session and terminal result. Native socket attachments contain identity/generation/expiry only, not game state. Do not assume memory persists through hibernation.

## Clock, version and projection rules

UTC milliseconds for server timestamps; Asia/Calcutta conversion only for human/records calendar grouping. Competitive elapsedMs is completedAt-startedAt; practice subtracts accepted pause intervals. Async comparison uses floor(ms/1000) while retaining full server duration. IDs break equal finishedAt ordering for stable streak aggregation.

Delivery version increments on every accepted lifecycle/game/control change. Secret round and own progress revisions remain independent legality guards. Result projectedVersion permits only newer updates; unique match key prevents double counting. Terminal row can never become active through an older outbox. Required projection writes and slot releases are one version-aware D1 batch where feasible; failure remains outbox pending.

## Content provenance and migration

Produce a versioned selection manifest: source filenames/digests, normalized puzzle hashes, source rating, selected stable IDs/numbers, solver version and validation outcome. Derive private solutions independently. No unused bank file or solution manifest in public/. Runtime catalog endpoints return only safe list/issued givens.

Schema migrations must preserve saved dice, choice locks, timer/assistance/eligibility and controller identity. Test representative old serialized snapshots. Unsupported rules/schema becomes recoverable read-only and explicit update action; never reset or silently run a changed reducer. Restore/projection repair always consults DO authority.
