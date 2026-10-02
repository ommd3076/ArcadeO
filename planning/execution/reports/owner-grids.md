# Grid games correction checkpoint

## Implemented

- Dots & Boxes and SOS accept `startFacts.config.gridSize` of 5, 7, or 9, save the dimension in game state, and expose it in public views. Missing dimensions in older saved matches resolve to 5. Dots bounds, adjacent boxes, scoring, and terminal edge count use the saved dimension. SOS bounds, line detection, occupied cell count, and terminal behavior use the saved dimension.
- Dots and SOS boards render their saved sizes. Both retain direct board controls and add a resettable zoom viewport for dense grids. The Dots board retains adjacent-dot input. Connect Four stays 7 by 6, with a larger bounded board and seven column controls kept on one row at narrow widths.
- Existing match screen focus mode is outside owned paths and was already present. Setup must send `gameOptions.gridSize` for Dots and SOS; lead was notified.

## Verification

- `npx vitest run tests/unit/games/dots-boxes/dots-boxes.test.ts tests/unit/games/sos/sos.test.ts`: 51 tests passed, including new 5/7/9 edge and cell terminal sweeps.
- `npm run typecheck`: passed.
- A full `npm run test` invocation reported an unrelated Snakes & Ladders reference map assertion while that area was changing concurrently. Grid tests passed in that run and in the focused rerun.

## Remaining checks

- The lead must wire size selection through match creation and verify 5/7/9 real Worker and browser journeys, board zoom/focus at target widths, and match resume. Visual and motion proof has not yet been recorded for these boards.
