# Engine and design-source checkpoint before UI implementation

Date: 2026-10-02. Owner authorized committing/pushing the current implementation to main and creating a UI branch. This report records a validated source checkpoint; it does not certify completion of every requirement in the earlier engine implementation plan. No deployment was performed.

## Preserved implementation

The checkpoint preserves existing engine-author edits, including versioned Cricket 1-6/1-10 adapters, secret-view phase redaction, contextual recovery, UUID generation, client reconciliation/heartbeat work, saved-match lifecycle/deadlines, clock formatting, records work and reference-board helpers. Existing icon/hearts changes and reviewed evidence are preserved. The 17 local Stitch HTML sources, eight exported K1-K8 PNGs and their source handoff are included alongside the existing 29-image design library.

No surrounding UI redesign was implemented by this checkpointing pass. Imported Stitch HTML remains design input, not application code.

## Fresh local checks

All commands below completed with exit 0 against this source state:

| Command | Evidence |
| --- | --- |
| npm run typecheck | TypeScript check |
| npm run lint | ESLint |
| npm run format:check | Prettier check |
| npm test | 18 pure/unit files, 269 tests |
| npm run test:contracts | 9 source/mocked contract files, 61 tests |
| npm run test:components | 11 server-rendered component files, 46 tests |
| npm run build | Client, service worker and Worker dry-run bundle |
| npm run test:integration | 4 actual Worker durability tests and 26 real workerd/SQLite DO/D1 HTTP scenarios |
| npm run test:e2e | 59 real Worker Chromium browser tests, 7.0 minutes |
| npm run content:verify | 1,000 uniquely solvable Sudoku puzzles, 250 per difficulty |

Browser coverage includes UI journeys, privacy/recovery, all-game visual matrices, focus/text scaling, large-grid panning and motion observations. Several game completions use API-assisted actions; these are not claims that every game was completed solely through touch controls. Screenshots and motion recordings establish the current build's exercised paths, not acceptance of the proposed redesign.

## Engine follow-ups and evidence limits

- Offline Together authority is not implemented: no IndexedDB action ledger, device grant/delegation/import subsystem was found, and MatchSession still pauses offline input. The existing browser test explicitly verifies offline pause. Do not label the engine plan complete or promise offline creation/play from UI alone.
- Disconnect contact timestamps currently reside in the Durable Object instance's in-memory seatLastContact map. Durable presence restoration and uninterrupted eligibility across backend/contact-observation gaps require their own implementation and fault tests. The passing suites do not certify the full new disconnect policy.
- The Sudoku state includes an interruptedCompetitive field, but the current Sudoku record projection and best-time query do not carry/filter that field. Exclusion from uninterrupted competitive records remains an engine/records follow-up.
- The new saved/expiry/disconnect lifecycle is not exhaustively covered by the full boundary, eviction and race matrix proposed in the analytical engine plan. Do not infer those guarantees from existing general-purpose tests.
- No hardware iPhone certification or authenticated production deployment was performed.

UI work may proceed against this checkpoint, using actual capabilities and truthful unavailable states. These engine follow-ups remain separate; do not hide them by introducing client-only authority, fabricated statuses or record filtering in presentation.

## Git and handoff boundary

The engine checkpoint originates on codex/game-engine. Publish it to main using a normal fast-forward push, then create codex/ui from that published commit. The remote's default branch is currently master; publishing main does not silently change that setting or push master.

Preserve raw runner-generated page@*.webm files locally under .local/baseline-raw-recordings-2026-10-02 instead of publishing unnamed runner artifacts. Keep curated accepted-motion evidence and referenced images in the repository. No credentials, .local runtime accounts, session dumps or browser traces belong in the commit.

The UI owner reads CODEX-UI-IMPLEMENTATION-HANDOFF.md and STITCH-EXPORT-INVENTORY.md. It implements the whole UI/animation scope in the owner's new GPT-6 Luna chat. It does not auto-merge or deploy.
