# V1 game rules

Status: implementation baseline, 2026-09-30. Owner decisions override the original context where explicitly recorded below. Remaining details are architect-selected defaults, not additional owner approvals. Each match pins `rulesVersion: 1` and its board/puzzle version; future changes affect new matches only.

## Shared rules

Two stable seats, A and B, are independent of account appearance and board position. Remote moves belong to the authenticated seat; together moves belong to the active seat under the trusted shared controller. All seven multiplayer games support remote and together. Sudoku supports solo, remote duel and async challenge; together Sudoku is deferred.

The server samples the first starter once and stores it. Rematches alternate the previous starter, except Hand Cricket uses a fresh toss. Rematches are new matches. There are no move clocks or automatic disconnect losses. Back preserves a match; resign gives the opponent a forfeit; explicit abandonment is unscored and requires both remote players' agreement. Terminal results are immutable.

Reducers receive validated inputs, including saved random outcomes and server times where needed. They do not read a clock, generate randomness, perform I/O, or depend on animation. Repeating the same state/input produces the same result. Invalid inputs leave state unchanged.

## Ludo

Owner-approved: four tokens per seat; six to enter; exact finish; safe squares; one bonus roll for six, capture or reaching home; no blockades; no capture prerequisite for entering home; first to finish all four wins. **Capture exactly one opponent token**, even if several share the destination. **The third consecutive six is ignored and grants another roll**, preserving earlier moves.

Architect defaults resolving those choices:

- Tokens have stable IDs 0–3. An unsafe landing captures the lowest-ID opposing token at that square, returning it to the yard. Remaining opposing tokens stay; mixed occupancy on unsafe squares is permitted. Occupants never block movement. Passing over a square captures nothing; safe landings capture nothing.
- First and second consecutive sixes allow normal movement and another roll. Once two have occurred, further sixes cause no movement and another roll until a 1–5 appears. Keep the streak capped at two during these rerolls. A non-six resets the streak; a turn transfer also resets it. A capture/home bonus after a non-six continues the turn with a reset streak.
- A six enters a yard token onto its starting square; it does not then move that token six more cells. The player may instead move a token already on its path.
- If no token can legally use an accepted non-ignored roll, resolve that fact immediately. A first/second six still grants another roll; a non-six passes the turn. Every legal roll, including exactly one legal pawn, waits for deliberate pawn selection and prohibits another roll. This owner correction applies to pending selections restored after refresh.
- Curated named pawn colours may change before and during a match. An appearance update changes only the acting seat's colour, preserving path identity, tokens, pending roll, legal moves and outcomes. The trusted Together controller may explicitly select either seat for appearance only. Indistinguishable or near-identical pairs are rejected.
- Capture, reaching home and rolling six together grant only one bonus roll. A winning move ends the match immediately, before any bonus.

### Fixed geometry

Board coordinates are zero-based `[row,column]` on a 15×15 board. Shared ring indices 0–51 follow this fixed order:

```text
0–4:   [6,1] [6,2] [6,3] [6,4] [6,5]
5–10:  [5,6] [4,6] [3,6] [2,6] [1,6] [0,6]
11:    [0,7]
12–17: [0,8] [1,8] [2,8] [3,8] [4,8] [5,8]
18–23: [6,9] [6,10] [6,11] [6,12] [6,13] [6,14]
24–25: [7,14] [8,14]
26–30: [8,13] [8,12] [8,11] [8,10] [8,9]
31–36: [9,8] [10,8] [11,8] [12,8] [13,8] [14,8]
37:    [14,7]
38–43: [14,6] [13,6] [12,6] [11,6] [10,6] [9,6]
44–49: [8,5] [8,4] [8,3] [8,2] [8,1] [8,0]
50–51: [7,0] [6,0]
```

A starts at ring index 0; B starts at 26. Safe indices: `0,8,13,21,26,34,39,47`, including unused seats' start squares. Store progress `-1` for yard, `0..50` for shared travel, `51..56` for private home travel; `56` is finished. Shared coordinate is `(startIndex + progress) mod 52` only for progress 0–50. A's home lane is `[7,1]..[7,6]`; B's is `[7,13]..[7,8]`, in that order. Home lanes cannot capture or be captured. Reject any move exceeding 56. Seat position never depends on the chosen player color.

The ring has 48 orthogonal steps and four diagonal corner steps (4→5, 17→18, 30→31, 43→44); render travel using the explicit path, not a presumed orthogonal-grid walk.

Persist phase (`roll`/`choose-token`/terminal), active seat, capped six streak, pending accepted roll, token progress and legal token IDs. A refresh cannot reroll a pending die.

## Sudoku

Classic 9×9. Four difficulty groups: Easy, Medium, Hard, Expert. **All numbered puzzles are freely selectable**, with completed puzzles marked and no unlocking. Launch target: 250 verified puzzles per group, 1,000 total; this quantity is an architect default, not a completed import. Puzzle numbers are stable identities, not a promise of increasing difficulty.

Givens are immutable. Allow digits 1–9, erase, notes and undo. Notes are per-player bitsets; setting a digit clears that cell's notes; automatic peer-note removal is excluded. Undo restores the most recent accepted entry/note change, not the elapsed clock, assistance status or completion. Local row/column/box conflicts are highlighted; there is no mistake limit. Incorrect but nonconflicting entries can remain. Completion is checked against the verified solution server-side.

### Practice

Saved board, notes, undo history and explicit pause/resume. Pause saves its server time and masks the board; edits while paused are rejected. Backgrounding alone does not pause. Offline input is disabled; unless an explicit pause was accepted, elapsed time continues. Practice Check highlights incorrect entered cells, permanently marks that attempt assisted, and does not supply missing digits. Keep assisted/replayed records separate from fresh unassisted best times. Reset starts a new attempt after an explicit discard action; it never resets the old attempt's timer.

### Live duel

Both play the same givens on separate private boards. Select a puzzle not previously completed by either account in the selected difficulty where available; if exhausted, disclose an unranked replay before Ready. Both confirm Ready; the server fixes a start time three seconds ahead. Do not deliver the puzzle before that time. First complete valid board accepted by the server wins. Server ordering breaks near-simultaneous finishes; latency can affect the result. No correctness Check during competition; notes and undo remain available. Opponent progress is submitted filled-cell count, including incorrect entries, never entries, notes or correct-cell count.

**Owner-approved timing:** after Start, competitive time continues through refresh, backgrounding and disconnection. Offline moves pause, elapsed time does not. Show this before readiness/acceptance. A pause request is rejected in competitive modes. Resignation produces a forfeit; disconnection does not.

### Async challenge

A sender chooses difficulty and starts a dedicated unassisted timed attempt. After valid completion, Publish creates an invitation referencing that puzzle and saved duration. Publishing is idempotent; no edited/client-supplied score is accepted. The receiver sees difficulty and target duration before accepting; accepting starts their continuous attempt and delivers the puzzle. Compare `floor(elapsedMilliseconds / 1000)`; equal durations draw. Waiting hours/days before acceptance does not count.

One receiving attempt per challenge; no clock reset on refresh or retry. No competitive Check. Both attempt boards/notes remain private; after completion only results are shared. A previously completed puzzle can be replayed but cannot count as a fresh competitive record. Track completed puzzle IDs and mark replay eligibility when issuing/accepting a challenge. Declined, cancelled or abandoned challenges are unscored; explicitly resigning an active eligible challenge gives a forfeit. Async comparison is finalized only after both eligible attempts finish; sender completion alone is not a shared match win. An explicitly accepted replay finishes as an unranked completed result: show the time comparison for fun, set scored=false, and exclude it from shared wins/played/streaks and fresh speed records. Exhausted-catalog duel replay follows the same unranked exclusion. It must still reach a saved terminal state; do not leave it active awaiting eligibility that can never occur.

### Content preparation

Use the imported Sudoku Exchange bank; map `diabolical` to Expert. Retain rating, bucket and provenance. Pin a source revision when obtainable, otherwise record a SHA-256 archive/file digest without fabricating a commit. Normalize 81 digits (0 means empty), reject duplicate/inconsistent clues, independently count solutions up to two and accept exactly one. Derive and store the solution privately. Sample across each bucket's rating range; stable numbering follows the versioned selection manifest. No runtime generator or human hint engine is required.

## Dots & Boxes

Choose 5×5, 7×7 or 9×9 dots at creation, giving 4×4, 6×6 or 8×8 boxes. Default and missing legacy dimensions are 5. Dimensions cannot change during play. Choose one unused orthogonal edge between adjacent dots. Canonicalize reverse endpoint order. Each newly closed box awards one point and ownership to the placer. One move can close two boxes; award both and retain the turn once. A nonscoring edge transfers the turn. When all `2*n*(n-1)` edges are used, compare totals; equality is a draw. Invalid/repeated edges are rejected. Box ownership and edge ownership are separate.

## Rock Paper Scissors

Best of 3 by default; best of 5/7 selectable at creation. First to 2/3/4 round wins. Rock beats scissors, scissors beats paper, paper beats rock. A tie scores neither and still completes that secret round. No total-round cap or timeout loss. Choices lock once per seat per round. Resolve when both lock, then show the saved result. Both remote seats confirm Next; the together controller confirms once for both after reveal. Repeat readiness is harmless; late locks cannot affect the next round.

## Hand Cricket

Numbers 1–6, one wicket each, no ball limit. A saved server coin toss selects who chooses Bat or Bowl; the choice fixes first innings roles. Every delivery uses two secret locked numbers. Equal values dismiss the batter and score zero; otherwise add the batter's number. After first dismissal, swap roles; target is first innings total plus one. Second innings ends immediately on reaching target or dismissal. On dismissal below the first total, first batter wins; equal totals draw. Zero in the first innings means one run wins the chase. No overs, super-over or extra wickets. Both acknowledge each result before the next delivery/innings, using the shared readiness protocol.

## SOS

General scoring variant on saved 5×5, 7×7 or 9×9 cells selected at creation. Default and missing legacy dimensions are 5; dimensions cannot change midgame. Either player may place S or O in an empty cell. Detect all contiguous three-cell S–O–S lines containing that new placement, horizontally, vertically and on both diagonals. Each new line awards one point and ownership to the placer, regardless of who placed its earlier letters. Overlap/shared letters are allowed. Canonicalize endpoints to prevent reversed duplicates. A scoring move retains the turn once even if several lines score; otherwise transfer it. Full board ends the game; greatest total wins, equality draws. Occupied cells cannot change.

## Connect Four

7 columns × 6 rows. Integer column 0–6 drops a disc into its lowest empty cell. Alternate turns. Any contiguous run of at least four horizontally, vertically or diagonally wins. Check win before full-board draw, including a winning final placement. Reject full columns, malformed indices and moves after completion. Persist winning cell coordinates for presentation.

## Snakes & Ladders

Fixed serpentine 10×10 board, start at 0 off-board. A roll advances normally; exact arrival at 100 wins. Overshoot leaves the token in place and transfers turn. A six gives no bonus. Only exact landing on a transition origin triggers it, once. Shared occupancy is allowed; no capture. Fixed board data, version 1:

```text
Ladders: 2→23, 8→34, 20→41, 32→51, 49→70, 60→83, 73→94
Snakes:  27→5, 39→16, 56→35, 68→46, 79→58, 88→66, 97→76
```

Version 1 above remains the saved behavior for old matches, including missing versions. New matches pin reference board version 2, independently traced from the supplied owner image:

```text
Ladders: 1→38, 4→14, 9→31, 21→42, 28→84, 51→67, 72→91, 81→99
Snakes: 17→7, 53→34, 63→18, 64→60, 87→45, 92→73, 95→75, 98→79
```

The long central ladder is 28→84; its interrupted visible rails are one ladder. Bottom row reads 1–10 left-to-right; alternate row direction upward. For number n: band=`floor((n-1)/10)`, row=`9-band`, column=`(n-1)%10` for even bands and `9-((n-1)%10)` for odd bands. Reducer, editable original artwork and token travel share this versioned map. Store the accepted roll and final position before animation. The watermarked source image is never shipped.

## Reuse boundaries

Use the Sudoku bank data and retain provenance. Connect Four and DotBox have local MIT license files: adapt only useful rules functions/tests with notices; do not import their UI or mutable singleton/class state as authority. Implement our own Ludo reducer because the imported package's licensing notice and custom-rule/restore compatibility are not qualified. RPS, Hand Cricket, SOS and Snakes & Ladders use small own reducers. Dimensions, Retroverse and other imported applications remain references, not runtime dependencies. Every copied fragment gets a source digest/revision, license notice and fixture coverage before adoption.
