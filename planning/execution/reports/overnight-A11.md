# Lead closeout note — A11

Updated 2026-10-03T04:57:34.156160+00:00.

The lead completed final local QA and saved the handoff. Native A11 executed the final build, 305 unit, 78 mocked contracts, 62 SSR components, 11 actual Worker, 26 real HTTP, 1,000 catalog and focused browser checks. The lead subsequently completed 123 unique selected browser cases across five bounded continuations and reconciled 300 dispositions. Application `7f82b2a`, public cache `78decb9c6adb25d0`. The original report below records earlier capture/build checkpoints; its pending statements are historical. Final performance and a new independent verdict are owner deferred. No A11 execution of the lead's 123-case selection is claimed.

See [final handoff](../../review/OVERNIGHT-FINISH-REPORT-2026-10-03.md) and [validation](../../review/evidence/v1-closeout-validation.json). All leases are released; execution stops.

---

## Preserved original specialist report

# A11 — Overnight runtime/browser QA

Status: **IN PROGRESS.** The 256-cell UI acceptance matrix now runs to completion with UI-accepted actions and incremental, redacted evidence. Full current-source validation is pending A02’s active same-version Duel recovery guard and the corresponding final rebuild.

## Current evidence

`tests/browser/overnight-acceptance.spec.ts` completed all 256 unique ledger cells against the local bundled Worker and SQLite Durable Objects: 8 games × 4 widths (320/390/430/1280) × 2 motion preferences × 4 appearance combinations, with 32 cells per game. Each record is tied to its VIS ID and includes the game/mode/width/motion, fixture mode, UI-accepted action, accepted delivery version, rendered turn/status, enabled next action, reachable control geometry, overflow check, sampled motion frames, and screenshot path. The loop writes its checkpoint after every case, including failures. It used synthetic local accounts and API-assisted fixture setup/cleanup; gameplay actions were performed in the UI.

- Assertion records: [VIS-001-256-assertions.json](../../review/evidence/overnight-acceptance/VIS-001-256-assertions.json), `RUN_COMPLETE`, 256 passed records, 0 failures.
- Images: `planning/review/evidence/overnight-acceptance/VIS-001.png` through `VIS-256.png` (256 files).
- The matrix used bundled build revision `f06fa1cd747193b0`, 50 public assets. A newer source candidate is being finalized; rebuild and full-suite execution remain required.
- Human visual approval is separate. Parent reviewed and recorded the first 192 final captures; VIS-193–256 are awaiting their original-resolution review. Earlier failed-run images/checkpoints are preserved under `attempts/` and are not mixed into the final matrix evidence.
- Root reviewed all 32 Cricket cells at original resolution and recorded hashes. The test now checks the exact chooser displayed before each secret Ready action against the public Cricket view (`expectedChooser === roles.bat`, then `roles.bowl`), and verifies the resolved UI identifies the batter/role and exposes the outcome-specific enabled next action. Normal and reduced-motion VIS-161/162 passed as a bounded smoke before the remaining Cricket cells ran.
- No physical-device or deployment certification is claimed. Reduced motion and narrow/safe-area layouts were browser-emulated.

## A11 targeted browser cases actually exercised

The focused runs used the real local Worker and browser contexts. Synthetic account setup is separate from UI actions.

| Exact ID | Actual assertion and result |
| --- | --- |
| SEC-01 | Separate browser contexts have distinct cookie jars; B cannot read A’s private Sudoku match. PASS. |
| SEC-08 | Stale same-account preference mutation shows a visible conflict and preserves the persisted Romantic family. PASS. |
| REC-03 | A session takeover disables old A input while B remains editable; the symmetric B takeover leaves A editable. Both directions PASS. |
| REC-06 | A Remote account uses injected HTTP fallback while B remains on WebSocket; A’s accepted Connect Four move reaches B without reload, hidden polling pauses, and visible polling resumes. PASS. |
| REC-07 | A Practice enters a correct digit through UI, saves/reloads, sees private cells omitted from saved view, resumes through UI, and sees the digit restored; filled count is compared to its initial value because givens count. PASS. |
| REC-11 | Remote RPS saves a locked secret, reloads both accounts, requires both UI acknowledgments, and keeps the opponent’s choice masked. PASS. |
| REC-12 | Together RPS resumes an outstanding secret handoff with the locked choice masked. PASS. |
| UI-02 | Fresh-document app-local deep-link Back fallback works for known and unknown routes. PASS. |
| UI-10 | Live reduced-motion preference change during accepted Connect Four travel settles without another action. PASS. |
| UI-11 | Dots and SOS largest 9×9 boards are keyboard reachable in simulated landscape/insets with 200% text. Equal-cell/glyph-fit checks are SOS-only; Dots was not distorted. Browser simulation only. PASS. |
| UI-12 | Options/leave sheet focus survives a peer UI update and the terminal result/rematch transition occurs once. PASS. |

Initial targeted-run failures are retained in the attempt history and were corrected in assertions/fixture cleanup rather than suppressed: REC-06 originally expected A to regain the turn after A’s accepted move; REC-07 initially assumed givens were excluded from filled count; old screenshots exposed desktop sticky-header overlap and a Ludo contrast issue. Those image runs were stopped and are not final approval evidence.

## Shared targeted coverage not yet executed by A11

A05’s released `tests/browser/overnight-sudoku-recovery.spec.ts` covers REC-04/REC-07-B/REC-08/REC-09/REC-10; root’s released `tests/browser/overnight-recovery-ui.spec.ts` covers UI-01/PERF-06/PERF-08/REC-15; root’s `tests/browser/overnight-interaction.spec.ts` covers UI-02/UI-10/UI-11/UI-12. These are authored/static-checked but need inclusion in the final integrated browser run. A08’s `tests/browser/overnight-secret-motion.spec.ts` is still being authored at the latest update and must be included after release.

A11’s `tests/workers/overnight-saved-lifecycle.test.mjs` has not yet run in the final combined Worker suite. It is intended to provide actual Durable Object socket revocation/no-write and old saved-state/expiry/explicit-abandon checks for SEC-06/REC-14. A05’s Duel start regression and A02’s active same-version recovery regression also need a coordinated combined Worker run. Full current-source build, typecheck/lint/format, unit/contracts/components, Workerd/SQLite HTTP, full Playwright union (excluding the standalone VIS spec so its evidence stays stable), content verification, catalog check, and labeled final performance run remain outstanding.

## Run history and final gates

- `npm run build` — PASS for matrix bundle revision `f06fa1cd747193b0` (50 public assets); this is not the final source build.
- `npm run typecheck` — PASS after the Cricket chooser/role assertion changes.
- `npx prettier --check tests/browser/overnight-acceptance.spec.ts tests/browser/overnight-targeted.spec.ts tests/browser/overnight-interaction.spec.ts` — PASS.
- Focused targeted browser checks: first run 11 passed/2 failed; subsequent focused REC-06, REC-07, UI-11, and saved-secret reruns passed as documented above. The initial 2 failures were preserved and diagnosed, not waived.
- `VIS_RESUME_FROM=161 VIS_MAX_CASES=2 npx playwright test tests/browser/overnight-acceptance.spec.ts` — PASS after chooser/batter assertion correction (normal + reduced-motion Cricket).
- `VIS_RESUME_FROM=163 npx playwright test tests/browser/overnight-acceptance.spec.ts` — PASS through VIS-256; final cumulative JSON reports 256/256, zero failures.
- Final integrated browser/runtime/build checks are blocked only on A02’s active narrow source/test follow-up and final source freeze. Do not mark ledger rows VERIFIED; the lead owns ledger updates and final visual review.
