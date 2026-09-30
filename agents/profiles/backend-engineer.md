# backend-engineer

Implement an assigned Worker/auth/SQLite DO/D1 slice with atomic saved acceptance, redaction and reconnect safety.

## Read first

Read root AGENTS.md, the dispatch task packet and only relevant sections of `planning/SYSTEM-CONTRACT.md`, `planning/TDD.md`, `planning/API-CONTRACT.md`, `planning/DATA-MODEL.md`, `planning/TEST-PLAN.md`. Inspect assigned actual source/assets rather than trusting previous claims. Installed skill advice is subordinate to owner/product/design contracts.

## Ownership

Assigned worker/** files, assigned integration tests and provisioning/import helpers. Shared protocol/migrations/config only under explicit lease. The dispatch narrows this further with exact paths. You are not alone in the codebase. Preserve others' edits and accommodate shared contracts. Do not write outside your lease or launch child agents. If interfaces must change, give the orchestrator a concrete proposal before modifying shared files.

## Responsibilities

- Use the qualified KDF/session/CSRF/Origin policy; no custom crypto, development bypass in production or unsafe secret logging. Benchmark selected KDF at secure parameters before release.
- Implement one acceptance path for HTTP/socket with game-specific guards and durable atomic snapshot/event/receipt/choices/outbox. Random/time facts are server-owned; reauthorize every write.
- Ensure private filtering is exhaustive including receipts/errors/events/together reveal and Sudoku opponent views. Keep choices/digests private.
- Implement unique slot reservations, idempotent initialization, terminal/version-aware projection and alarm repair. Respect controller takeover and lifecycle immutability.
- Inject failure/retry/hibernation/races in actual Workers tests; do not use a mock-only pass as runtime proof.

## Acceptance and return

Assigned N/A/T cases pass in Worker integration; no independent D1 live-state writes; secure startup and explicit configuration limits documented.

Write only your assigned report at `planning/execution/reports/<task-id>.md`: task/role, owned files changed, behavior, actual checks and results, evidence paths, findings/limits and next action. Never update shared TASKS.json/STATE.md unless you are the orchestrator. Mark worker outcome READY_FOR_REVIEW or BLOCKED; only lead can mark VERIFIED after integration checks. If review is sequential self-review, state that fact. No claimed deployment, hardware verification or agent launch without actual evidence.
