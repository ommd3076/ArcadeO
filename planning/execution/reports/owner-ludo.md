# Owner correction: Ludo slice

## Implemented

- Every roll with a legal pawn saves `phase: choose-token`, `pendingRoll`, and `legalTokenIds`, including exactly one legal pawn. A second roll is rejected until a pawn is selected. JSON restoration preserves that selection.
- Saved `lastRollNotice` explains no legal move and ignored third or later six after reconnect or refresh.
- `ludo.set-colour` changes only the acting account's colour, including out of turn or during pending selection. Eight named colours are curated; identical or near-pair choices are rejected. Old matches without the field resolve to blue/green.
- The board now shows four coloured 6×6 houses, both active home lanes, two decorative lanes, safe markers, entry arrows, and a four-colour centre. Optional `seatColours` applies the saved active colours to pawns, houses, starts, and home lanes when supplied by the match screen.
- The board can occupy up to 680px, with direct pawn buttons and the existing labelled selector as an equivalent control for stacks and small screens.
- Replaced obsolete automatic-move tests with deliberate-selection, refresh, no-move, capture, safe-square, exact-finish, six-streak, and geometry tests.

## Checks

- `npx vitest run tests/unit/games/ludo/ludo.test.ts --reporter=dot`: 9 passed.
- `npx tsc --noEmit`: pending shared protocol `ActionType` addition for `ludo.set-colour`.

## Integration and limits

- The board reads authoritative `view.colours` directly; `seatColours` remains an optional override. Protocol union and worker action authorization/serialization are outside this slice and have been requested from the lead.
- Visual browser and animation evidence is pending integrated screen verification. The ring/path indices are unchanged to preserve active match positions.
