# Rules and Sudoku review — leaf-1.3

Outcome: READY_FOR_REVIEW. Canonical roles: game-engineer and sudoku-engineer. This is sequential expert self-review, followed by a second defect hunt; final integration verification belongs to the orchestrator. No frozen game rules or imported assets were changed.

## Reviewed boundaries

Read PRODUCT, planning index, GAME-RULES, relevant PRD/TDD/DATA/ASSET/TEST sections and both role profiles. Inspected all eight actual reducers, adapters/types, existing fixtures, shipped Sudoku bank, catalog/verification/records helpers and challenge router. Ludo's lowest-ID single capture, capped reroll streak, safe geometry, exact finish and nonstacking bonuses matched the contract. Dots' two-box closure/40-edge terminal, SOS overlapping four-axis lines, Connect Four win-before-draw/gravity, and Snakes' one transition/exact finish/no-six-bonus were re-read against source and tested. No demonstrated reducer defect was found in these five engines.

## Demonstrated defects fixed

| Trigger | Fix / owned paths |
| --- | --- |
| Sudoku row -1 / col 9 or row 0 / col 9 flattens into an otherwise valid index; fractional/NaN digits accepted | sudoku/engine independently validates integer row/column 0..8 and integer digits 1..9 before indexing |
| Creating Sudoku without supplied catalog facts silently starts an unsolvable blank board | engine requires catalog puzzle, 81 givens, valid private solution and clue agreement |
| Creation-time clock counts waiting/three-second countdown; pure helper uses Date.now | activateDuel pins common serverTime+3000 and both clocks; deterministic public view/legalActions consume server facts; unscheduled duel masks board and rejects edits |
| Challenge receiver can play/see puzzle before acceptance | receiver gate masks own board/givens and rejects edits until acceptChallenge pins continuous receiver start; challenge opponent progress is not exposed |
| Paused practice returns actual board | own givens/entries/notes/check highlights masked while paused; accepted resume retains board and clock facts |
| Replay completion has no saved scoring eligibility; fresh best includes replay | state/view replay and terminal details.scored metadata; replay ends terminal; worker record best excludes replay |
| Completing a sender attempt can stay active forever and occupy sender slot | immutable unscored sender terminal with senderAttempt marker; Publish creates separate initialized challenge |
| Catalog publicly reveals selected duel givens before common start | metadata-only catalog/random output, bounded validated pagination and no solution/givens delivery |
| RPS together Next requires two acknowledgments; final round reveals immediately | mode pinned; one together Next represents both after Reveal; pending saved terminal commits upon Reveal; masked current-round score/result |
| Cricket together has no saved reveal protection and reset delivery IDs collide across innings | saved mode/revealed, protected lastDelivery/run/target/result view, Reveal before Next, one together Next, monotonic delivery IDs, pending terminal commits on Reveal |
| Publish trusts a D1 record and never initializes match authority; replaces occupied slot | challenges API exports completed unassisted sender facts from authenticated DO, uses creation and sender-attempt idempotency, atomic registry/slot reservation, initializes private challenge authority, exact Origin/session CSRF and no client duration |
| Content verification tests only 25 source samples per bucket | standalone verifier counts solutions of all 1000 shipped puzzles independently, checks private solution/clues, source origins/digests, stable numbering/duplicate guards |

## Files changed

shared/games/sudoku/{engine,types}.ts; shared/games/rps/{engine,types,adapter}.ts; shared/games/hand-cricket/{engine,types,adapter}.ts; shared/games/registry.ts; worker/sudoku/records.ts; worker/api/{catalog,challenges}.ts; scripts/verify-sudoku-catalog.mjs; tests/unit/games/sudoku/review.test.ts; tests/unit/games/rps/together-review.test.ts; tests/unit/games/hand-cricket/hand-cricket.test.ts; tests/integration/sudoku/sudoku.test.ts.

No root protocol/schema/config/migrations or other worker-owned files were edited. Registry optional legalActions serverTime signature was coordinated with backend/root.

## Actual validation

- `npx vitest run tests/unit/games tests/unit/content tests/integration/sudoku`: 12 files, 209 tests passed. Includes 18 new adversarial review cases and adjusted monotonic-ID/new-challenge fixtures. Existing integration/sudoku is mocked/pure evidence, not actual Workers execution.
- `node scripts/verify-sudoku-catalog.mjs`: all 1000 shipped puzzles have exactly one independently counted solution; 250 per bucket; all stored solutions valid and clue-compatible; all source digests/provenance and identities match. Version remains 1 and IDs easy-001 through expert-250 unchanged. Verified rating ranges Easy 1.2, Medium 1.5–2.3, Hard 2.5–4.6, Expert 5–9. Source files/catalog/solutions preserved.
- Scoped ESLint on shared/games, worker/sudoku, both owned API routes, and owned test directories passed.
- `npx tsc --noEmit` passed after interface coordination (whole checkout at that time).
- Second expert re-read found pending-final-reveal resignation overwrite risk in DO lifecycle; sent concrete guard requirement to backend. No deployment/real-phone/browser proof is asserted by this report.

## Integration seam checklist for lead

1. Actual SQLite DO/D1 runtime must prove practice start/pause/check/complete, scheduled duel private common start and independent opposite revisions, near-simultaneous ordering, dedicated sender completion/publication, receiver acceptance/whole-second terminal comparison and replay exclusion.
2. DO must filter private Sudoku effect payloads (edit digits/check indices) on event/receipt/socket paths, and suppress secret outcome effects before together Reveal. Backend implemented this separately.
3. Pending together terminal remains saved immutable: block resign/abandon before Reveal from replacing accepted final outcome. Outer result/records projection must also remain private until Reveal.
4. Completion eligibility uses fresh history at issuance AND acceptance; projection lag/recovery must not allow previously completed puzzles as fresh. AcceptChallenge ORs replay permanently.
5. Sender completion releases sudoku:sender:<account> independently of published directional slot. Actual challenge registry initialization retry/same-source idempotency and occupied-slot preservation need runtime proof.
6. Match creation config must pin mode and server catalog givens/private solution. Client launch IDs must be exact easy-001 format; no sudoku- prefix. Private content must be absent from public bundle/catalog.
7. Frontend must use own progressRevision, saved revealed flags, explicit Publish and one together Next, expose replay/timing notices, and verify actual rendering/accessibility/motion separately.

API contract exchanged directly with backend/frontend: Publish POST /api/v1/challenges {creationId,senderAttemptId}; incoming GET /api/v1/challenges metadata; published acceptance via match.accept action on challengeId. DO-only /challenge-source authenticates X-Actor-Account/X-Session-Id and returns puzzleId/saved senderElapsedMs/replay/senderSeat, never client-owned score.
