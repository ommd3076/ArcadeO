# Library API correction checkpoint

## Implemented

- Migration `0003_library.sql` creates account scoped favourites and one shared play-next row, each with its own version.
- `GET /api/v1/library` returns `{ favourites: { gameIds, version }, playNext: { gameIds, version } }` for an authenticated account. Empty personal rows read as an empty list at version 1.
- `PUT /api/v1/library/favourites` and `PUT /api/v1/library/play-next` accept `{ gameIds, expectedVersion }` with CSRF. Lists are ordered, unique, at most eight entries, and restricted to the eight product games. Conditional SQL version updates return 409 with the current list and version after a concurrent change. Favourites are personal; play-next is shared.
- `/api/library` aliases follow the existing v1/legacy route convention.

## Verification

- `npx vitest run tests/integration/library/library.test.ts`: 2 passed. Cases cover account isolation, shared ordering, stale writer conflict, unauthenticated access, duplicates, and unknown games using SQLite D1 mock.
- A subsequent `npm run typecheck` currently fails in concurrently edited Ludo view and E2E fixture files outside this assignment. No library type errors were reported.

## Remaining checks

- Run the real Worker/runtime endpoint flow after migration, including concurrent clients. Wire UI consumers to these endpoints. No deployment was attempted.
