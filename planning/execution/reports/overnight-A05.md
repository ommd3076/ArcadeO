# Overnight A05 — Sudoku saved recovery and interrupted records

**Role:** Sudoku engineer  
**Tasks:** A05-T1 through A05-T5  
**Outcome:** READY_FOR_REVIEW  
**Owned code paths changed:** `shared/games/sudoku/` (no edits); `worker/sudoku/records.ts`; `worker/api/records.ts`; `worker/matches/match-do.ts`; `worker/matches/types.ts`.  
**Owned tests changed:** `tests/integration/sudoku/sudoku.test.ts`, new `tests/integration/sudoku/saved-resume.test.ts`, `tests/integration/records/records.test.ts`. Lead-granted test fixture edit: `tests/workers/durability.test.mjs` applies migration 0004. Migration itself remains lead-owned.

## Implemented

- **A05-T1:** Resume acknowledgment seats now follow the actual Sudoku attempt. Practice and an unpublished sender Challenge resume with their sole participant. A published, accepted Challenge resumes with the receiver; the completed sender cannot be required to acknowledge or alter the receiver's clock. A Live Duel still requires A and B. Shared Remote resume policy is unchanged. The active-attempt helper also limits Challenge pause cleanup to the receiver.
- **A05-T2/T3:** Deliberate Sudoku Duel save sets `SudokuState.interrupted` monotonically; resume preserves it and terminal details keep it visible. The versioned projection outbox carries a separate `interrupted` flag for Duel results and record rows. `results` and `sudoku_records` projection updates retain true with `MAX`, so an older retry cannot clear it. A known old outbox entry with `details.interrupted === true` recovers the flag when its top-level field is absent. This applies only to Sudoku Duel; absent or invalid legacy metadata is not inferred.
- **A05-T4:** Competitive summaries, weekly/play-day counts, win streaks, per-game wins, recaps and best-time queries exclude flagged Duel completions. Recent match history still returns them with an explicit `interrupted` field, and completed-puzzle IDs remain inclusive. The lead-owned migration backfills only valid, explicit `details.interrupted` metadata and leaves unknown history at the default false value.
- **A05-T5:** Saved Async Challenge keeps its competitive clock running while lifecycle state disables input. Practice retains its explicit pause behavior; an interrupted Duel may pause because the result is history-only. Resume clears a legacy saved Challenge `paused` display flag without subtracting saved time. Fixtures use Practice, sender/receiver Challenge, and Remote Duel; no Together-Sudoku fixture was found or introduced.

## Evidence

- `npx vitest run tests/integration/sudoku tests/integration/records tests/integration/matches/authority-regressions.test.ts tests/unit/games/sudoku` — **6 files, 51 tests passed**. Includes sole-player Practice/sender resume, receiver-only Challenge resume, legacy paused Challenge clock recovery, Duel completion after save, legacy terminal outbox recovery, stale terminal retry non-regression, record eligibility/history, and existing Sudoku privacy/timer regressions. DO/D1 cases in these integration folders use the repository's SQLite/D1 mocks; they are not workerd runtime evidence.
- `npm run test:workers` — **4 actual Worker/workerd durability tests passed** with migration 0004 loaded in the isolated fixture. These cover SQLite rollback, eviction recovery, projection/alarm retry and native WebSocket behavior; they are general durability evidence, not a Sudoku-specific real-Worker journey.
- `npm run typecheck` — passed after concurrent source integration.
- `git diff --check` over A05 paths — passed.

## Limits and handoff

A11 still owns cross-context runtime/journey coverage. This assignment did not certify browser visuals, physical phones, deployment or production D1 state. No content-bank requalification was part of A05's five saved-state/records tasks. Root owns the migration, shared schema/protocol and final integrated verification. The A02 MatchDO lease is released; A05 implementation paths are ready for review.
