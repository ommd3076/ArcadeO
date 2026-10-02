# Overnight A03 — saved, ready, and navigation UI

**Role:** frontend engineer  
**Tasks:** A03-T1 through A03-T5  
**Outcome:** READY_FOR_REVIEW  
**Owned files changed:** `src/screens/match.tsx`, `src/screens/match.css`, `src/screens/game-detail.tsx`, `src/screens/sudoku-list.tsx`, `src/app/pages/home-page.tsx`, `src/components/back-header.tsx`, `tests/e2e/navigation/navigation-screens.test.tsx`, `tests/e2e/qa-journeys/journeys.test.tsx`, and this report.  
**No shared protocol, sync, router, game-rule, worker, schema, or root configuration files were edited.**

## Implemented behavior

- **A03-T1:** Match readiness reads the accepted `view.readiness` fields and invitation acceptance from `view.invitationAccepted`. Waiting screens show the two participant names, distinguish an unaccepted invitation from accepted-but-not-ready players, and expose only the current legal Accept/Decline/Ready actions.
- **A03-T2:** The Match Options sheet offers a confirmed Leave and save action when legal. Saved matches render mode-correct Resume using the authoritative pause ID and accepted action; Remote waits for both acknowledgments, Together resumes through its controller, and already-acknowledged Remote seats see a waiting state. Home, game setup, and the Sudoku picker include saved entries. The Vault/Us screen remains with its separately assigned owner.
- **A03-T3:** Board handlers and controls require an active lifecycle, the matching legal action, connected/non-offline state, available controller ownership, and no pending action. Waiting readiness and saved-match Resume use their own legal-action gates without requiring an active lifecycle. Resign and unscored abandonment remain distinct confirmed actions.
- **A03-T4:** Match navigation stays visible with a sticky, safe-area-aware header. The owned Back header consults the lead’s app-local history helper and uses its route fallback for direct deep links. Return Home now targets `/`. Unknown game IDs show an authored recovery screen with Back to Games.
- **A03-T5:** All owned creation/publication/abandon HTTP paths use `generateUuid()`. Pending action recovery shows reconciliation progress; device takeover is pending-gated and surfaces backend message/code or HTTP status before reconciling.

## Checks and evidence

- `npx vitest run tests/e2e/navigation/navigation-screens.test.tsx` — **6 passed** after adding the unknown-game recovery case.
- `npx vitest run tests/e2e/navigation/navigation-screens.test.tsx tests/e2e/qa-journeys/journeys.test.tsx` — **15 passed** on the preceding run, including canonical readiness and saved Remote Resume SSR cases. A later rerun was blocked when the concurrent A09 edit introduced a syntax error in `src/games/ludo/ludo-board.tsx:224`; the navigation suite still passed independently afterward.
- `npx prettier --check` on all eight owned source/test files — **passed**.
- `git diff --check` on owned source/test files — **passed**.
- `npm run typecheck` — **blocked by the same concurrent A09 parse error** at `src/games/ludo/ludo-board.tsx:224`; the lead reports this is the sole current typecheck diagnostic. No phone/laptop visual inspection or post-A02 LAN retest was performed by this assignment.

**Next action:** lead reruns the journey suite and typecheck after A09 repairs the Ludo parse error, then performs integrated Remote/LAN and visual acceptance. A07 owns the remaining Vault/Us saved-match list.
