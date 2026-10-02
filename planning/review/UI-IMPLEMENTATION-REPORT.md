# Private Arcade UI implementation

Date: 2026-10-02  
Branch: `codex/ui`

## Scope and design evidence

Implemented the existing application UI against the frozen product and UI contracts. Read all 17 exported Stitch HTML screens and reviewed their complete mapped image collection alongside the supplied owner references. The exports provide static layout, type and styling evidence; they do not define app behavior or backend capabilities. Adapted their visual direction to the current routes, game engines, saved records, match states and service boundaries.

The exported pages do not provide a complete responsive interaction system or the licensed font files used here. Added self-hosted Plus Jakarta Sans for UI text, Barlow Condensed for short game display headings, and DM Mono for actual monospaced values, with notices in `THIRD-PARTY-NOTICES.md`. Source projects: [Plus Jakarta Sans](https://github.com/tokotype/PlusJakartaSans) and [Barlow](https://github.com/jpt/barlow).

## Implemented

- Responsive application shell, Home, Games, account/records/settings, sign-in, game setup, saved-match library and Sudoku selection. Home reflects actual match/record state; setup and resume actions use existing capabilities.
- The four contracted Standard/Romantic × Dark/Light appearances, current account/device preference behavior, supported piece accents, accessible focus and keyboard use, reduced-motion behavior, loading/error/empty states and narrow-screen layouts.
- Shared match presentation for all eight games, including connection, turn, waiting, handoff, private-choice, result and intentional-leave states supported by the current application. Game boards, rules, authority and networking remain owned by the existing engines/services.
- Responsive headings, controls and labels, including 200% text stress coverage and browser-history scroll restoration.

## Verification

Browser checks use the current production client/Worker build, a real local workerd/SQLite Durable Object/D1 runtime, and isolated test accounts. They do not modify the user's saved match state. The reference images and browser captures are under `planning/review/evidence/owner-corrections/`; the Home/Games/Us viewport/theme matrix is in its `ui-shell/` subdirectory.

| Check                                                       | Result                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run build`                                             | Passed on final source; frontend, service worker, public shell and Worker dry-run             |
| `npm run typecheck` and `npm run lint`                      | Passed                                                                                        |
| Targeted Prettier check for changed source, tests and docs  | Passed                                                                                        |
| `npm run test`                                              | Passed: 269 tests / 18 files                                                                  |
| `npm run test:contracts`                                    | Passed: 61 tests / 9 files                                                                    |
| `npm run test:components`                                   | Passed: 46 tests / 11 files                                                                   |
| `npm run test:integration`                                  | Passed: 4 real Worker tests and 26 bundled workerd/SQLite DO/D1 HTTP scenarios                |
| `npm run content:verify`                                    | Passed: 1,000 puzzles                                                                         |
| `npx playwright test tests/browser/ui-shell-visual.spec.ts` | Passed: all appearance/width screens, 200% text and empty/multiple active-match states        |
| `npm run test:e2e`                                          | Passed: 62 Chromium tests in 6.6 minutes against the final production bundle and local Worker |

The game visual matrix covers all board families in each appearance at phone and laptop widths, plus keyboard focus, zoom/panning, reduced motion and 200% text. Lifecycle coverage checks browser Back, saved-match resume and confirmed intentional leave. Browser journeys cover reconnect/offline handling, takeover, remote readiness, private-choice handoffs, completion and rematch. These are simulated browser/runtime checks, not physical-device certification.

## Limits

- No Pixel/iPhone hardware was available; safe-area, install, OS suspension and real-device touch behavior still need phone certification.
- Deployment was not authorized or performed. A local Worker dry-run does not establish a live deployment.
- Exported Stitch documents are static visual references; missing production interactions/assets were adapted from the authored product contracts and actual application capabilities.
