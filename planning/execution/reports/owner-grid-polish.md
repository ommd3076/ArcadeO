# Grid board polish checkpoint

## Implemented

- Added reusable `GameHeader`, `PlayerScoreStrip`, `BoardViewport`, `FocusModeToggle`, `ActionDock`, `DiceControl`, `PawnSelector`, `SegmentedControl`, `StatusPill`, `ColourPicker`, `InlineNotice`, and `ResultPanel` in `src/components/game-primitives.tsx`. The grid boards now use the shared score strip and viewport.
- Dots & Boxes supports deterministic closest-edge selection when tapping blank box space. Equal distances resolve horizontal edges before vertical edges. Direct edge buttons and adjacent-dot entry remain available. A disclosed row/column picker helps select dots on dense boards.
- SOS offers a disclosed row/column cell picker while retaining direct cell taps and S/O selection.
- Grid board zoom uses an overflow viewport so users can pan the board without forcing horizontal page scroll. Connect Four's earlier large-board and narrow-width fixes remain.
- Dots edge/box and SOS letter/line animation are gated by optional accepted event ID and effects props. Saved snapshots with no accepted event render settled immediately. Reduced motion disables edge and line animation.
- Connect Four disc drops now use accepted `disc-dropped` effects; the old `lastDrop` prop remains accepted for compatibility but no longer triggers motion from a snapshot. `GameHeader` delegates to `BackHeader`, `DiceControl` renders the matching die face, `Sheet` reexports the existing component, and `ColourPicker` has visible names plus disabled options.

## Integration contract

Pass `acceptedEventId={state.acceptedEvent?.eventId}` and typed `acceptedEffects={state.acceptedEvent?.effects}` to Dots and SOS boards. Hide the generic match turn strip for those games because the shared board score strip includes the turn. The lead was notified. Other game boards can adopt the primitives without changing their rule engines.

## Verification

- `npx vitest run tests/unit/games/dots-boxes/dots-boxes.test.ts tests/unit/games/sos/sos.test.ts`: 51 passed.
- `npx eslint` on the shared primitives and three grid board components: passed.
- `npm run typecheck` currently reports two unrelated nullable-profile errors in concurrently edited `src/app/pages/us-page.tsx`; no owned-file error remains.
- After the final primitive/Connect Four changes, `npm run typecheck` and focused ESLint both pass.

## Remaining checks

- Browser proof at 320/390/430 widths, laptop, keyboard, text scaling, reduced motion, accepted-event replay and duplicate/stale event handling is still required after match-screen integration.
