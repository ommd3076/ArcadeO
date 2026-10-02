# Owner visual review: Ludo, Snakes & Ladders, Connect Four

## Scope and evidence

Inspected actual rendered Worker screenshots for each game in Standard Dark, Standard Light, Romantic Dark and Romantic Light at 320, 390, 430 and 1280 CSS pixels. All 16 appearance/viewport combinations were reviewed per game; the review used the screenshot pixels, not DOM text or matrix observations as a substitute for visual inspection. Evidence is in `planning/review/evidence/owner-corrections/` as `ludo-{appearance}-{width}.png`, `snakes-and-ladders-{appearance}-{width}.png` and `connect-four-{appearance}-{width}.png`, with each appearance in `{standard-dark,standard-light,romantic-dark,romantic-light}` and each width in `{320,390,430,1280}`. Corresponding matrix observations are in `ludo-matrix.json`, `snakes-and-ladders-matrix.json` and `connect-four-matrix.json`.

## Findings

### Ludo

- The refreshed board reads as a recognizable classic four-house Ludo board: four colored home areas with white interiors, four lanes, colored center, safe marks, entry arrows and numbered active pawns. The board stays within the phone viewport at 320/390/430 and has a clear, appropriately larger presentation at 1280.
- The board and shell colors remain legible in all four appearances. Romantic Dark is visibly distinct from Standard Dark; Romantic Light retains the pink shell while preserving the board’s player colors.
- At 320, the roll card wraps its turn heading and “Roll Dice” button label; at 390 the button label still wraps, while the content fits on one line at 430. This remains usable, but the CTA card looks less settled at the two narrowest widths.
- No other visual blocker found in the supplied Ludo matrix. The selected pawn colours and standard four-house visual were checked in the current screenshot set.

### Snakes & Ladders

- The board has recognizable snakes with curved, tapered bodies, heads and tongue details, plus ladders with visible rails and rungs. The board’s colorful cells and serpentine numbering remain legible across the four appearances. The snakes and ladders remain identifiable in the 320px screenshots despite the dense 10×10 board.
- The refreshed 320px screenshots show the full `100` label inside the top-left cell; the earlier clipping finding is resolved in the current evidence. Current screenshots include all four appearances in `snakes-and-ladders-{appearance}-320.png`.
- At 320/390 the roll card moves its “Roll Dice” action onto a second row; at 430 it fits alongside the turn copy. It remains operable and readable, though the narrow card is less balanced.

### Connect Four

- The 7×6 board and seven aligned column controls are immediately recognizable. The board is centered with ample separation from the active-turn strip and uses distinct cell/surface treatments in all four appearance modes. The 1280 render gives the board a strong, balanced focal position.
- At 320px the title now wraps onto two lines as “Connect” / “Four” and remains fully visible in all four appearance screenshots. The earlier truncation is resolved. The seven numbered drop controls are still aligned to the seven columns.
- Column controls use numbered labels at 320 and downward chevrons at 390/430/1280. The controls remain individually aligned over their columns. This is a visual difference by width, not a demonstrated interaction failure.

## Review outcome

The three boards are visually distinct, board-first, and consistent with the four appearance families. The refreshed 320px screenshots resolve the S&L `100` clipping and Connect Four title truncation. Ludo and Snakes & Ladders action cards still wrap at 320/390, a smaller polish issue. These screenshots alone do not establish motion behavior, gameplay correctness, or physical-phone certification.

## Follow-up: Dots & Boxes, SOS and sampled motion

### 320px board and accessibility screenshots

Inspected the 5×5 default (`dots-boxes-*`, `sos-*`), 7×7 and 9×9 screenshots in all four appearances. The 7×7/9×9 sets use `dots-boxes-7-*`, `dots-boxes-9-*`, `sos-7-*` and `sos-9-*`. The light and dark shells remain distinct and the playing surface maintains visible boundaries. On SOS, the S/O selection controls remain present below the board. On Dots & Boxes, the score and active-turn strip remain above it.

Also inspected each board's 320px `-zoom-320.png`, `-focus-320.png` and `-text125-320.png` views. Focus is visibly outlined on the selected dot/cell. Text at 125% wraps the instructions onto extra lines without horizontal page overflow in the matrix observation. Zoom shows a visible “Reset zoom” control and enlarges the board; in these stills the outer right edge is outside the viewport for both games. The captured view cannot establish whether users can pan the clipped portion, so edge access while zoomed remains unverified. At 9×9 the cells are necessarily small at 320px; the separate row/column selection instruction is visible below the board, but those coordinate controls are collapsed in the captured screens.

### Accepted-action frame sequence

Inspected all 91 extracted frames at 2 fps from `planning/review/evidence/owner-corrections/motion-frames/frame-001.png` through `frame-091.png`, associated with `accepted-motion.webm`.

- Frames 1–4 show the sign-in screen and a sign-in attempt. Frames 5–12 show Ludo: a six result exposes four token choices, selection moves a blue token from its yard onto the track, and a later five leaves only one legal token choice. The stills show the changed states; they do not establish animation timing.
- Frames 14–55 show Snakes & Ladders. The board uses colored serpentine rows numbered 1–100, eight visible curved snakes with heads, tapered spotted bodies and tongue details, and runged ladders crossing between cells. A and B markers move along the numbered zigzag path, while die values and accepted-position text update. The marker overlay is small on the dense 10×10 board but distinguishable by its letter and color. The sampled frames do not prove the exact interpolation or duration of a snake/ladder transition.
- Frames 57–62 show Connect Four discs appearing in the bottom row, first for A and then for B. No win or terminal result is shown in those frames.
- Frames 63–72 show Dots & Boxes edge selections. A completed box is labeled `B`, and the visible score changes from Player B 0 to Player B 1; the board edges use player colors. This is visual evidence of the sampled score display, not an independent correctness check.
- Frames 73–91 show SOS placements: `S`, then `O`, then `S` form a highlighted three-cell line. The visible in-game score changes to Player A 1 / Player B 0. The later terminal panel says “Match abandoned” and “Abandoned without a score” while the in-game scoreboard still reads 1–0; the panel is not evidence of a scored match record.

The extraction samples at two frames per second. It supports that accepted-action states and the listed visual changes appear in this sequence, but it is too sparse to certify smoothness, intermediate motion, exact animation duration or reduced-motion behavior. It does not establish physical-phone rendering.
