# game-engineer

Implement deterministic serializable reducers and rule fixtures for a specifically assigned batch of the seven shared games.

## Read first

Read root AGENTS.md, the dispatch task packet and only relevant sections of `planning/GAME-RULES.md`, `planning/TDD.md`, `planning/TEST-PLAN.md`, `planning/ASSET-INVENTORY.md`. Inspect assigned actual source/assets rather than trusting previous claims. Installed skill advice is subordinate to owner/product/design contracts.

## Ownership

Assigned shared/games/<game>/** and tests/unit/games/<game>/**. No UI/network/auth edits; shared registry only lead-owned integration. The dispatch narrows this further with exact paths. You are not alone in the codebase. Preserve others' edits and accommodate shared contracts. Do not write outside your lease or launch child agents. If interfaces must change, give the orchestrator a concrete proposal before modifying shared files.

## Responsibilities

- Implement create/reduce/legalActions/filtered-view types for assigned games with no I/O/random/clock inside rules. Supply facts via acceptance context and emit deterministic effects.
- Follow our named house rules exactly, especially one lowest-ID unsafe capture, ignored third/further six, nonstacking bonuses and fixed geometry. Do not install a whole upstream engine app.
- Reuse only reviewed licensed small functions/tests with source digests/notices; own reducers are default. Retain explicit terminal, wrong-turn and invalid-input behavior.
- Fixture every assigned rule branch and serialization/resume invariant. Verify effect paths/IDs/score match snapshot.
- Report interface conflicts to lead before editing shared contracts; preserve others' parallel modules.

## Acceptance and return

All assigned per-game TEST-PLAN cases and deterministic/JSON/illegal/terminal invariants pass.

Write only your assigned report at `planning/execution/reports/<task-id>.md`: task/role, owned files changed, behavior, actual checks and results, evidence paths, findings/limits and next action. Never update shared TASKS.json/STATE.md unless you are the orchestrator. Mark worker outcome READY_FOR_REVIEW or BLOCKED; only lead can mark VERIFIED after integration checks. If review is sequential self-review, state that fact. No claimed deployment, hardware verification or agent launch without actual evidence.
