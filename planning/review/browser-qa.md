# Browser QA leaf 1.4

Status: final controller regression and consolidated 23-scenario run pending. No deployment or real-phone certification claimed.

## Harness and evidence

Playwright Chromium uses the actual bundled client, bundled Worker, D1 migrations/catalog, and SQLite Durable Objects. Each run creates a fresh `.local/browser-<uuid>` persistence directory and random two-account credentials. No mocked routes or mocked engines are used. Root owns bundling; QA does not build concurrently with runtime suites. Test fixtures, logs, traces, cookies, credentials, screenshots, and the HTML report remain in ignored `.local/` only.

`npm run test:e2e` invokes Playwright. The browser server uses port 8789 and exact local origin. A random-token loopback-only harness shutdown endpoint on port 8790 avoids Playwright's Windows taskkill teardown hang. This endpoint exists in the test runner, not the application Worker.

## Actual results

On the root bundle with JS asset `index-DIFDLSvL.js`, the full 16-scenario run reported 14 passing and two failing harness assertions (2.3 minutes). Both corrected scenarios then passed in a separate two-test run (29.2 seconds). Thus all original 16 scenarios have passing runtime evidence; a consolidated final run is still pending.

Expanded 23-scenario run on `index-B_6kIUso.js`: 20 passed, three failed (5.1 minutes). Same-account takeover failed live notification to the displaced session (backend wire repair pending); that failed fixture retained a Together slot and caused the subsequent Connect Four creation failure (finally cleanup added). Remote RPS test encountered the expected focus/privacy curtain after switching browser contexts (explicit foreground/unmask added). New remote Dots, SOS, Snakes, Ludo, and Cricket journeys passed UI invitation/accept/both Ready/first action/refresh/Rematch plus real API normal completion. Narrow Sudoku geometry and four-theme computed contrast assertions passed.

- Two independent authenticated browser contexts: UI remote Connect Four invitation, accept, both Ready, normal seven-move win, refresh, and rematch.
- All seven Together games: UI creation and normal rule completion. Connect Four, Dots, SOS, Snakes, and Ludo use actual API actions to complement UI creation and terminal refresh assertions. RPS and Cricket use UI role/choice radios, lock, pass-phone, refresh masking, Reveal, Next, and normal completion. No resignation substitutes for these wins/draws.
- Sudoku practice: actual UI Notes, number input, Undo, Pause, masked paused refresh, Resume, and Check assistance. Real API cell edits complete the private test fixture solution and verify unscored terminal data.
- Sudoku duel: API setup/readiness, prestart givens/cells masking, common scheduled clock, independent progress revisions, absent opponent entries/notes, and normal completion.
- Sudoku async: real sender solution completion, UI Send this challenge, receiver challenge list/open/accept, preaccept privacy, absent opponent progress, and normal receiver completion through API edits.
- Deep-link guard and UI logout revoke authentication. Browser-clock advancement verifies client session deadline handling; this is not a server-clock expiry test.
- Offline input disable and online recovery, then account B explicit Together takeover disable account A. Resignation is cleanup for this recovery test only.
- Native authenticated browser WebSocket returns a real authoritative snapshot.
- Actual service-worker registration and cache inspection: populated caches contain no `/api/` or `/matches/` entries.
- Four family/mode preferences saved through the UI and persisted on refresh. Games screen widths 320, 390, 430, and 1280 have no document horizontal overflow. Reduced-motion screenshots and visible keyboard outline captured. Visual inspection covered Games at 320 and Romantic Light appearance at 390; these are desktop Chromium emulations.

## Demonstrated defects and owner repairs

1. Remote creator Ready button was missing because participant `ready` conflated invitation acceptance with readiness. Frontend changed visibility to authoritative `legalActions`; remote UI journey now passes.
2. Sudoku action bar at 390 clipped Pause outside viewport. Frontend wrapped controls, enforced 44-pixel heights, and changed number pad to three columns; practice controls now pass ordinary UI interaction. Explicit 320/390/430 control bounds and screenshots added for final run.
3. Native browser socket upgrade initially returned 503. Root fixed upgrade handling; actual snapshot test now passes.
4. Same-account second Together session received enabled input and no takeover control despite backend rejecting its mutations. Stored `controllingSessionId` and action enforcement were present, but backend view and frontend sync inferred control solely from account. Root/backend/frontend reopened their scopes and repaired projection/session handling. An explicit same-account independent-session takeover regression is added and awaiting refreshed bundle verification.
5. Screenshot inspection of both dark families found preference choice labels black on dark surfaces. Frontend/root received exact screenshot evidence; final verification awaits their fix. Theme testing now includes a real computed foreground/background contrast assertion for the Standard preference button (minimum 4.5).

Harness failures were corrected without production attribution: initial secret-game tests omitted the required Resume & Unmask curtain, used button rather than radio locators, and an async label regex missed “Send this challenge.” Playwright large-duration clock overflow is handled with daily increments.

## Limits and remaining gates

| Contract | Browser evidence scope |
| --- | --- |
| B01 | Full UI remote Connect Four. Remote Dots/SOS/Snakes/Ludo/Cricket UI first actions and Rematch pass with API normal finish; remote RPS final unmask rerun pending. |
| B02 | Seven Together creation/normal completions; long boards API-assisted. |
| B03 | RPS/Cricket full UI control cycle and refresh masking; exhaustive focus-phase interruption unverified. |
| B04 | Practice notes/undo/pause/check/solve; free number/difficulty selection, erase and replay eligibility UI permutations incomplete. |
| B05 | Duel common start/privacy/revisions/normal finish; near-simultaneous finish/background clock variants unverified here. |
| B06 | Sender/publish/receiver/accept/normal solve; replay/cancel/decline/forfeit variants delegated or unverified here. |
| B07 | Offline/recovery, native socket, client deadline, account takeover; same-account takeover final regression pending. Saved/unknown response-loss phases incomplete. |
| B08 | Login deep-link guard/completed refresh/rematch/logout; full navigation history matrix incomplete. |
| B09–B10 | Slot registry and records/timezone scenarios not covered by this browser leaf. |
| V01–V02 | Appearance four themes, Games 320/390/430/laptop, narrow practice controls, secret handoff 390; every board/theme/text-scaling matrix incomplete. |
| V03–V06 | Reduced-motion/focus screenshots and concrete clipping/dark-label findings; animation interruption, midmatch appearance, full contrast/accessibility audit incomplete. |
| D01–D05 | UNVERIFIED by this leaf: no real Pixel/iPhone, deployment or owner visual approval. |

Await the final same-account live controller bundle and run all 23 tests together. The suite is substantive runtime/UI evidence, not exhaustive game permutations, actual device certification, deployment evidence, exhaustive accessibility/contrast audit, animation interruption audit, or server expiry/reboot durability proof. Root owns broader HTTP/runtime and durability scenarios. Shared-game long completions and Sudoku solves are intentionally API-assisted; only the stated controls were clicked in the UI. Harness review is sequential self-review; lead integration verification remains required. Scoped ESLint passes. A full TypeScript check passed before the 23-scenario run; the latest check reported a concurrent frontend `match.tsx` nullable-view diagnostic sent to its owner.
