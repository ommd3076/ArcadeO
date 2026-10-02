# Snakes & Ladders owner correction checkpoint

## Implemented
- New matches save board version 2; missing version on legacy saves selects the original map. Reducer and board render from the same versioned transition table.
- New board uses original editable SVG curved snakes and runged ladders. The watermarked source image is not shipped.
- Exact eight reference ladders, independently traced twice from the supplied 500×500 image: 1→38, 4→14, 9→31, 21→42, 28→84, 51→67, 72→91, 81→99. Cell coordinates use the 10×10 serpentine grid, with (row,col) from top-left: 1=(9,0) to 38=(6,2); 4=(9,3) to 14=(8,6); 9=(9,8) to 31=(6,9); 21=(7,0) to 42=(5,1); 28=(7,7) to 84=(1,3); 51=(4,9) to 67=(3,6); 72=(2,8) to 91=(0,9); 81=(1,0) to 99=(0,1). The 28→84 rails continue beneath the yellow snake; the lower-left 1→38 rails pass through cells 22/23. There are no separate ladders at those overlaps.
- Reference snakes: 17→7, 53→34, 63→18, 64→60, 87→45, 92→73, 95→75, 98→79.
- Endpoint tests cover all version 2 transitions and legacy recovery.

## Checks and limits
- `npx vitest run tests/unit/games/snakes-and-ladders/snakes-and-ladders.test.ts`: 49/49 passed after the confirmed correction.
- Browser owner-correction tests were added in `tests/browser/owner-corrections.spec.ts` for grid sizes, Ludo pending refresh/colour, and library/name behavior. They have not yet run. No browser or motion outcome is claimed.
- `npx playwright test tests/browser/owner-corrections.spec.ts --list`: six tests discovered; this does not execute them.
