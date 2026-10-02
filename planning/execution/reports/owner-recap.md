# Shared recap implementation checkpoint

Added `sharedRecap` to `GET /api/v1/records/recent` while preserving `recentMatches`.

Response shape: `sharedRecap: Array<{ matchId, gameId, mode, winnerAccountId, reason, finishedAt }>`; newest five scored, completed shared sessions. It joins saved `results` with `match_registry`, requires both canonical accounts, excludes practice, unscored replays and sender attempts, and uses recorded winner identity. The recap intentionally contains no play duration because the saved timestamps do not prove active playing time. `recentMatches` additionally carries nullable `startedAt` from the registry.

Checks: `npx vitest run tests/integration/records/records.test.ts` passed 4/4. `npx tsc --noEmit` currently fails only in concurrently edited Ludo files (`shared/games/ludo/engine.ts` and `tests/e2e/ludo/ludo-screen.test.ts`) due required `colours` in `LudoView`; no records error reported.

No UI, migration, other endpoint or deployment change.
