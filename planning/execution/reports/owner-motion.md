# Accepted-event motion slice

## Contract

Both `LudoBoard` and `SnakesLaddersBoard` accept optional `acceptedEventId?: string | number | null` and `acceptedEffects?: readonly Effect[]`. Pass the newest saved event ID/effects alongside the authoritative view. They never animate initial mount, so refresh and reconnect snapshots settle immediately. Repeated IDs do not replay. New events cancel old animation.

## Implemented

- Shared `useAcceptedMotion` hook gates WAAPI animation on a changed accepted ID, cancels on interruption/unmount, and honors reduced motion.
- Both accepted dice results get 240ms transform feedback.
- Ludo accepted pawn movement follows the explicit board path in at most 280ms. It does not change the reducer or input phase.
- Snakes & Ladders accepted movement visits numbered cells and follows the drawn curved snake when bitten, or its ladder endpoints, in at most 280ms.
- Refined each original SVG snake into a tapered Bézier body with subtle spots, a shaped head, snout, eyes, and forked tongue. Motion follows the same cubic control points. Square numbers have light backing and foreground stacking for readability. No reference bitmap is shipped.
- All effects animate `transform` only. Browser state already contains the accepted final position; no animation callback advances play.

## Check and limit

- `npx tsc --noEmit`: exit 0.
- `npx vitest run tests/e2e/snakes-ladders/snakes-ladders-screen.test.ts --reporter=dot`: 3 passed after artwork revision.
- Browser frame pacing and visual motion recording remain for integrated QA after the lead wires accepted events from the match stream.
