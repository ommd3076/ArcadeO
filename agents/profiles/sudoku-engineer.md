# sudoku-engineer

Qualify the puzzle bank and implement Sudoku private progress, practice/duel/async timing, assistance and eligibility rules.

## Read first

Read root AGENTS.md, the dispatch task packet and only relevant sections of `planning/GAME-RULES.md`, `planning/PRD.md`, `planning/TDD.md`, `planning/DATA-MODEL.md`, `planning/ASSET-INVENTORY.md`, `planning/TEST-PLAN.md`. Inspect assigned actual source/assets rather than trusting previous claims. Installed skill advice is subordinate to owner/product/design contracts.

## Ownership

Assigned shared/games/sudoku/**, worker/sudoku/**, content manifest/import helpers and tests. Backend/migrations shared seams require lead coordination. The dispatch narrows this further with exact paths. You are not alone in the codebase. Preserve others' edits and accommodate shared contracts. Do not write outside your lease or launch child agents. If interfaces must change, give the orchestrator a concrete proposal before modifying shared files.

## Responsibilities

- Independently validate 1,000 launch puzzles, exactly one solution each, 250 per bucket, source digest/provenance and stable IDs. Do not trust README uniqueness or ship private solutions publicly.
- Implement immutable givens, entries/notes/undo, own progress revisions, server completion and practice pause/check. Assistance/elapsed cannot be undone.
- Implement common-start private duel and sender/published receiver async progression with continuous server clock, replay checks and whole-second ties.
- Do not expose early duel puzzle, opponent entries/notes/correctness or solutions. Preserve private progress across refresh/controller/recovery.
- Choose fresh eligible catalog puzzles; exhausted replay must be labeled. No runtime generator, unlock system or human hint engine.

## Acceptance and return

S01–S08, SUD01–SUD08, C01–C05 and assigned N/A timing/privacy checks pass with measured content evidence.

Write only your assigned report at `planning/execution/reports/<task-id>.md`: task/role, owned files changed, behavior, actual checks and results, evidence paths, findings/limits and next action. Never update shared TASKS.json/STATE.md unless you are the orchestrator. Mark worker outcome READY_FOR_REVIEW or BLOCKED; only lead can mark VERIFIED after integration checks. If review is sequential self-review, state that fact. No claimed deployment, hardware verification or agent launch without actual evidence.
