# Frontend review and repair — leaf-1.2

Role: frontend-engineer. Outcome: READY_FOR_REVIEW. Sequential expert review and repair; no child agents. Only lead may mark integrated verification complete.

## Owned changes

Changes are limited to src/app, src/screens, src/games, src/components, src/sync, src/theme and their assigned tests. No package/config/protocol/server mutation by this specialist. Parent supplied optional participant accentFamily, fonts, actual Worker runtime, and browser runtime.

Confirmed repairs:

- Auth session bootstrap, protected routes, validated internal return route, in-memory CSRF headers on every owned API mutation, authenticated actor identity, server expiry and private-state clearing on logout/401. Thirty-day expiry uses bounded timers: actual Chromium caught JS timeout overflow causing immediate logout; a substantive fake-clock regression now covers this.
- Match seat is resolved through participant.accountId, so account B creating seat A is handled correctly. Match snapshot accents affect pieces independently of viewer shell and retain old-snapshot defaults.
- No fictional match creation navigation. Creation request IDs survive uncertain retry for the same configuration. Server slot conflict offers explicit Resume. RPS format choice, Sudoku exact catalog IDs (easy-001 etc), gameOptions, challenge publisher and normal published-match invitation route are wired.
- Ready/Accept/Decline/Cancel are saved legal-action controls. Ready visibility uses legalActions, avoiding acceptance-ready conflation. Result copy distinguishes games, unscored closure, sender/practice completion. Rematch retains RPS format/Sudoku puzzle. Practice next selection chooses an available uncompleted puzzle from the current difficulty. Explicit unscored abandonment has a separate confirmation sheet and uses allowed remote/together actions.
- Unrelated snapshots/events never pretend to acknowledge a pending action. Unknown nonsecret action retains identical ID/payload/guards including Sudoku own progressRevision. Socket loss/timeout exposes uncertain acceptance and explicit retry; polling pauses input until a successful authoritative snapshot. Controller takeover is intentional and generation guarded; offline/pending/recovery/control loss pauses inputs.
- Secret recovery stores metadata only, clears raw ephemeral pending choices on concealment, and propagates cover state into both secret boards. The outstanding second chooser restores correctly. Failed Lock does not manufacture a saved handoff step. Cricket respects server revealed flag and alternating first chooser. Reveal sends the requested saved action directly, independent of an animation completion callback.
- Account family saves server-side and device mode is account scoped. Selectors are native buttons with pressed state and disabled conflicting accents. Actual browser caught raw SafeProfile preference-response mismatch causing a crash; raw/nested safe parsing repaired. Selectors wait for loaded account preferences to prevent local-only pretend save. Failed account save is labeled as failure.
- Records use actual thisWeek/recentMatches response fields, account-level winner identity, concise per-game totals, shared play-day streak, and separate Sudoku practice records. Puzzle completion markers consume authenticated ownCompletedPuzzleIds. Number/difficulty/page selection survives Back.
- Rendered UI repairs include reference mint/cyan emphasis, responsive game tiles, document scrolling and reserved tab space, self-host font wiring, 320px Connect Four numbered controls, dialog focus trap/restoration, and Sudoku wrapped 44px controls/3x3 keypad. No redesign or additional product features.

## Actual checks

- Scoped Vitest: tests/unit/sync, tests/unit/theme, tests/e2e — 14 files, 78 tests PASS with no unhandled errors (latest completed after the final Sudoku responsive patch).
- These existing tests/e2e are server-rendered component tests. They are not browser E2E evidence.
- Scoped ESLint across all owned src and assigned tests PASS.
- Final full typecheck currently reports only parent-owned tests/browser unused imports/variables (environment.spec.ts7, journeys.spec.ts2/3); no owned-file diagnostics. Parent is still editing that harness.
- Root npm build passed during this slice, including actual Vite artifact and Worker dry-run bundle. Parent should rebuild after final responsive patch before final QA.
- Actual Chromium against authenticated localhost:8787: login and session persisted; Together Connect Four creation returned a real match ID and authoritative snapshot; actual board inspected at390x844. No page errors in successful smoke checks.
- Actual theme controls saved all four Standard/Romantic × Dark/Light families/modes, navigated Home, and screenshots were visually inspected. A restored to Standard Dark afterward. Actual320px Games check returned document width320, with no page errors.
- Actual browser exposed websocket503; parent traced/fixed immutable upgrade-response header mutation. Initial specialist board inspection proved HTTP fallback, not websocket delivery; parent subsequently reports websocket snapshot proof.

## Evidence

- tests/e2e/evidence/home-standard-dark.png
- tests/e2e/evidence/home-standard-light.png
- tests/e2e/evidence/home-romantic-dark.png
- tests/e2e/evidence/home-romantic-light.png
- tests/e2e/evidence/games-320.png
- tests/e2e/evidence/connect-four-phone.png
- Older home-phone/games-phone/us-phone images are pre-repair diagnostic evidence and must not be claimed as final approval.
- Parent/rules browser harness found Sudoku practice controls cropped at390; final source fixes wrap controls and use44px targets. Harness must rerun ordinary visible clicks after rebuild.

## Integration seams remaining for lead

Final actual browser gates for all seven remote/together completion/rematch journeys and three Sudoku modes belong to root's tests/browser harness. Latest source must be rebuilt before those run. Actual laptop/all-board/motion/reduced-motion/refresh privacy inspection needs the final harness evidence; component rendering is insufficient. Hardware iPhone/Android standalone and deployment remain separate external evidence. No deployment or real-phone certification claimed.

## Final rendered review and reopened fixes

- Actual Chromium against authenticated 8787 inspected all eight boards at320x740,390x844 and1366x900. API creation/ready setup was used; this is rendered review, not a complete UI journey. Actual screenshots are tests/e2e/evidence/final-boards/* and metadata review.json. RPS unmask/Ready and Cricket toss/Ready ordinary UI exercised; actual chooser screenshots inspected.
- Visual review caught an incorrect Sudoku grid edit: board had three columns. Corrected board to nine columns and keypad to three44px columns; updated component regression checks both. Latest Sudoku screenshots visually inspected show correct9x9, wrapped controls and keypad.
- Authoritative controller.isController now wins over account equality in every sync projection; missing-boolean legacy fallback retained. Same-account second session pauses Together and Sudoku; Continue on this device now also appears for Sudoku. Scoped sync regression passes.
- Native Surface button labels explicitly use active-family text color, fixing dark appearance picker black labels. Root QA owns contrast computed/browser assertion.
- All eight dialog Tab focus stayed within dialog and Escape closed it. Media reduced-motion enabled all eight with screenshots; this does not certify every animated transition. Ordinary accepted Ludo/Snakes rolls observed saved version advance. Full per-game motion/outcome journey and keyboard board interactions remain root QA evidence.
- Review created matches cleaned with unscored abandonment, including previous owned Cricket0e96cc55 and solo practice44408543 after explicit controller takeover. Original preexisting ConnectFour3da586d8 remained untouched. All review browser contexts closed.
- Final reopened narrow source changes require root final bundle: Sudoku Continue visibility last change. Scoped14files78tests and ESLint checks passed; no Cricket hook repair applied because actual toss-to-innings produced no hook error.
