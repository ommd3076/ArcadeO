# Overnight A07 — controls, small details, and surface UX

**Role:** frontend engineer  
**Tasks:** A07-T1 through A07-T5  
**Outcome:** READY_FOR_REVIEW  
**Owned files changed:** `src/screens/game-detail.tsx`, `src/screens/match.tsx`, `src/components/game-primitives.tsx`, `src/app/pages/library-controls.tsx`, `src/app/pages/us-page.tsx`, `src/app/pages/login-page.tsx`, `src/theme/theme.css`, and `tests/e2e/qa-journeys/journeys.test.tsx` (explicit additional lease).  
**No changes:** `src/components/button.tsx`, `src/components/icon-button.tsx`, `src/theme/tokens.ts`, or `tests/unit/theme/theme.test.ts`. No shared protocol, schema, game rules, or root config changed.

## Implemented behavior

- **A07-T1:** Ludo setup now uses named pawn-color swatches with a sample, readable name, selected checkmark, 48px target, named player selector, and disabled explanations for colors that conflict or are too similar. The screen’s existing creation request persists the selected A/B colors. The in-match picker now uses readable color names, selected checks, disabled reasons and named player controls in Together mode.
- **A07-T2:** RPS format and shared play-next selects use the theme-aware 48px native select style with readable options and visible focus. The real persisted library choice stays selected if its save fails and clears only after the server confirms a save. Login now uses `apiFetch`, so the bounded request handling applies to sign-in. Pending, error, retry and disabled states remain visible.
- **A07-T3:** Saved-match, Ludo, library, and account controls expose accessible names and native button/link semantics, use visible focus styling and touch-sized targets, and keep status text beside semantic colors. Profile and records load failures surface with Retry; the authenticated user’s known display name is used when profile loading fails rather than showing `Account A/B` placeholders. Interrupted labeling is limited to Sudoku Duel mode, checks both accepted state and result details, retains the recorded winner/scores, and explains that the saved completion is excluded from competitive wins, streaks and best times.
- **A07-T4:** Added a compact, consistently surfaced Saved matches card in Us/Vault. It loads the real `GET /api/v1/matches` result, labels saved entries Paused, and routes each Resume link to its accepted match screen. Empty and fetch-failure states are explicit. Small controls use the existing house spacing, radius, font and semantic surface tokens.
- **A07-T5:** Kept content layouts fluid, wrapped and safe-area padded; saved-match rows stack at narrow widths, and no new fixed-height text containers or hover-only actions were added. The browser-based 320–430px, landscape and 200% text-scale inspection remains for the lead’s integrated visual gate.
- **Integration correction:** Ordinary Remote action availability now follows accepted `legalActions`, connection, pending and sync state without treating turn ownership as exclusive device control. Together and Sudoku still require their exclusive session control. Turn-based board handlers retain their own turn gates; Remote simultaneous secret actions and legal waiting/saved actions remain available off turn. The pending-action receipt control is disabled while submission, reconciliation or other sync work is active.

## Checks and evidence

- `npx vitest run tests/unit/theme/theme.test.ts tests/e2e/navigation/navigation-screens.test.tsx tests/e2e/qa-journeys/journeys.test.tsx` — **35 passed** across all four theme token variants, navigation SSR and journey SSR/gate regressions. Added assertions cover off-turn Remote Accept/Ready, Save/Resign, saved Resume/Resign, simultaneous Remote RPS lock availability, Together/Sudoku exclusive-control requirements, and interrupted Duel state/result facts versus Practice.
- `npm run typecheck` — **passed** on the final source.
- `npm run build` — **passed**: frontend and service-worker builds plus Cloudflare Worker dry run. This is build evidence, not Remote flow or deployment evidence.
- Targeted ESLint, Prettier check and `git diff --check` over the changed source and regression file — **passed**.
- Started `npm run dev` for the lead’s browser gate. Wrangler applied additive migration `0004_sudoku_interrupted.sql` to local D1 and served the local Vite/Worker app. The running exec session is **83514**; the lead may stop that process after the visual gate.
- **Not verified by A07:** actual rendered all-theme screen inspection, keyboard walkthrough, landscape/200% text/320px reflow, thumb reachability and real A/B UI-only Remote flows. The CUA in-app browser reports that visibility is unsupported inside a subagent thread. The lead owns the integrated browser gate and the dev server is available for it. No phone hardware, deployment or production behavior is claimed.

## Task status

| Task | Status |
| --- | --- |
| A07-T1 | READY_FOR_REVIEW |
| A07-T2 | READY_FOR_REVIEW |
| A07-T3 | READY_FOR_REVIEW |
| A07-T4 | READY_FOR_REVIEW |
| A07-T5 | READY_FOR_REVIEW |

**Next action:** lead reviews this slice and completes the actual rendered all-theme, viewport, keyboard and Remote lifecycle gates. No commit or deployment was made by A07.
