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

## Follow-up — scheduled Sudoku Duel start refresh

**Outcome:** READY_FOR_REVIEW
**Additional owned paths:** `worker/matches/match-do.ts`, new `tests/workers/overnight-duel-start.test.mjs`.

The Match DO now includes the persisted Sudoku Duel `scheduledStartTime` when choosing its earliest alarm. The alarm checks for a due start before D1 projection work, then checks again after a slow projection flush if no start was handled before it. Each check reads current persisted lifecycle/state under the DO's serialized authority queue, so a save or terminal action that wins the queue prevents a start refresh. Delivery sends each currently authorized participant a filtered `snapshot`; it does not create an event, receipt, outbox write, or version increment. Hibernating socket attachments are checked against current session validity and membership before delivery. Alarm recalculation continues to include pending projection retries.

The Worker regression proves both A and B receive a pre-start view with hidden givens and no `sudoku.edit`, followed by an editable same-version snapshot from the actual scheduled Worker alarm. Each player receives only their own cells; opponent cells and the solution remain absent. The test also checks that the persisted scheduled time is readable from a newly constructed Match DO over the same SQLite-backed state, and that no event or receipt was fabricated. Separate saved and terminal cases verify that stale alarms do not publish start snapshots.

## Follow-up evidence and limitation

- `npx vitest run --config vitest.workers.config.mjs tests/workers/overnight-duel-start.test.mjs --reporter=verbose` — **3 actual Worker tests passed**.
- `npm run typecheck` — passed after the alarm change.
- `npx prettier --write worker/matches/match-do.ts tests/workers/overnight-duel-start.test.mjs` and `git diff --check -- worker/matches/match-do.ts tests/workers/overnight-duel-start.test.mjs` — passed.
- `evictDurableObject()` did not complete within the 30-second Worker test timeout while this DO held a future scheduled-start alarm, even with no WebSockets or pending outbox rows. The fixture therefore verifies reconstruction from persisted DO SQLite state with a new instance, while platform eviction with a future alarm remains unverified here. Existing Worker durability tests separately cover eviction and hibernating WebSockets without a future scheduled-start alarm.

The A11 full runtime, browser, and matrix gates remain outside this assignment.
