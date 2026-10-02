# V1 UI and motion contract

Status: implementation baseline revision 2, 2026-09-30. Use the supplied task/statistics references for spacious hierarchy, bold type, rounded surfaces and compact controls. A's Standard family retains black/white framing with mint, cyan and yellow; B's Romantic family uses purple dark/pink light. The full visual specification and semantic palette matrix are in [DESIGN.md](../DESIGN.md). This is not visual/device verification.

## Appearance

Appearance has Standard/Romantic family plus System/Light/Dark mode. Both accounts start Dark; A starts Standard, B Romantic. Both can select either family. Standard is colorful regular framing, not a grayscale substitute. Family is versioned in D1; mode is stored per account on the device. System follows OS changes, including midmatch, without altering rules or selection. DESIGN.md is the single palette-value source. Avoid neon everywhere, wallpaper textures or franchise imagery. One small dimensional die/pawn can provide the tennis-ball reference's tactile character using CSS/SVG.

Theme and player accent are independent. Forms, focus, disabled states, errors and boards use semantic tokens; no per-game invented palette. Family changes affect only the viewer's presentation, not match state.

## Player identity

Profile accent families are blue, orange, teal, violet, magenta and green; save family IDs in D1. Snapshot accents into each new match. Changing profile color applies to new matches; changing theme immediately changes the shade of existing identities. Initial A=teal, B=violet. All distinct-family combinations are allowed at launch; identical family selections are rejected with a clear alternative. Color always has initials/seat labels or piece marks alongside it, so similar hues remain distinguishable.

| Family  | Dark foreground/piece | Light foreground/piece |
| ------- | --------------------- | ---------------------- |
| Blue    | #8EBBFF               | #245CC1                |
| Orange  | #FFBD82               | #A5470C                |
| Teal    | #68D6C2               | #087568                |
| Violet  | #C5A2FF               | #7040B5                |
| Magenta | #F69ACD               | #A12C72                |
| Green   | #A9D47D               | #427B1F                |

Ownership strokes/pieces use these foregrounds against canvas/surface, with an outline or contrast backing when necessary, including raised surfaces. Soft box/selection fills use low-opacity ownership tint plus full-opacity initials/border. Do not place text on ownership fills without checking the actual pair across all four variants. Warnings/errors keep semantic marks and explanatory text instead of becoming an ambiguous player color.

## Typography, spacing and controls

Owner correction 2026-10-02 (UI implementation handoff): Plus Jakarta Sans for body and controls; Barlow Condensed 600/700 only for short display titles. Both licensed WOFF2 families are self-hosted in `public/fonts/` with their OFL notices; use a system sans fallback while fonts load. DM Sans remains a fallback, not the selected face. Keep editorial headings at regular/medium weights, scores and timers tabular, and avoid blanket uppercase or condensed controls. No handwriting body type. Lucide is the sole icon family; retain its [license](https://lucide.dev/license) and import used icons only.

Phone page title 32–40 px, section title 22–24, body/control 16, secondary 14, labels 12 only where comfortably legible. Timers use tabular digits. Allow wrapping and text scaling; do not crop reference-style headlines to preserve an image composition. Spacing scale 4/8/12/16/24/32; page gutters 16–20. Corner roles 10/16/24/pill. Prefer clear tonal surfaces and restrained borders/shadows. Controls have 44–48 CSS-pixel targets where feasible; dense board cells have explicit alternatives.

## Navigation and screen boundaries

- Home: short greeting, compact weekly shared-game sentence, one prominent Continue card, All active when needed, quick game access. Empty state leads to Games. No activity feed or analytics wall.
- Games: eight named entries, each with one procedural board/game symbol. Detail shows the available modes and only relevant setup: difficulty or RPS format. Existing slot becomes Resume.
- Us: basic head-to-head/per-game records, recent results, compact streaks, appearance and logout. Separate solo practice from shared outcomes; no XP/store/avatar system.
- Shell uses labeled Home/Games/Us bottom tabs, with safe-area inset. Gameplay hides shell tabs and uses visible Back, game title, connection state, player/turn/score bar, board and necessary controls.
- Back uses meaningful browser history; deep-link fallback goes to Games. Sheets/modals have Close and sensible history dismissal. Never use Back to resign, silently discard or change modes. Explicit destructive match actions explain the resulting forfeit/unscored abandonment.

Build at 320–430 CSS-pixel portrait widths, dynamic viewport units and safe-area insets; keyboard/cutouts must not obscure controls. Laptop centers a bounded board with a narrow control/score column where useful. Do not stretch a phone board across a monitor. No hover-only functions or custom iPhone edge gesture. Real Android Back and standalone iPhone navigation are release checks.

## Game interaction

| Game             | Interaction and accepted feedback                                                                                                                                                                                                                                                |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ludo             | Highlight legal tokens. Enlarged token controls below the 15×15 board are an equivalent input path, including stacked tokens. Dice resolves to saved value; travel follows accepted cells; one capture visibly returns that token; ignored six says Roll again and shows no move |
| Sudoku           | One selected cell, row/column/box highlight, large 1–9 pad, Notes, Erase, Undo and Timer. Practice exposes Pause and Check; competition explains continuous timing and omits both. No wrong-entry shake on every keystroke                                                       |
| Dots & Boxes     | Broad edge hit regions with deterministic nearest-edge selection; ambiguous taps do nothing and retain selection. Accessible alternative: select one dot then an adjacent dot, tap selected dot to cancel. Accepted SVG edge draws; completed boxes fill with owner initials     |
| RPS              | Large Rock/Paper/Scissors selection, explicit Lock, waiting/handoff panel, saved-result reveal, clear round score and Next                                                                                                                                                       |
| Hand Cricket     | Large 1–6 choices, explicit Lock, named Batter/Bowler roles, saved reveal, runs/OUT and innings transition, clear next delivery                                                                                                                                                  |
| SOS              | Large S/O selector, then empty-cell tap. Letter appears; every newly scored line traces with ownership; score and bonus-turn feedback                                                                                                                                            |
| Connect Four     | Board tap or seven column controls. Disc falls to accepted row and settles; winner's line highlights; full columns clearly unavailable                                                                                                                                           |
| Snakes & Ladders | Readable fixed board, large Roll control, no cell input. Piece moves along accepted cells then follows the accepted snake/ladder path                                                                                                                                            |

Together secret flow: named player Ready → choose → Lock accepted → clear choice → neutral Pass to [name] → second Ready/choose/Lock → neutral Reveal together → saved result → Next. Alternate which player chooses first each new round/delivery. Mask on refresh, focus restoration and navigation. Laptop uses the same full game-area cover; ask the waiting player to look away, without claiming enforceable privacy.

## Motion and state

Every important action identifies what changed, actor, next interaction and active state. Immediate press/selection feedback: 100–180 ms. Accepted board action: usually 200–600 ms. Turn/score/state transition: 200–350 ms. Win/completion accent: 600–1,200 ms. RPS/Cricket count-in uses three short beats, about 900 ms total, without delaying saved outcomes. Long path travel is capped around 1,200 ms and offers settle/skip; not a per-cell unbounded animation.

Use transforms, opacity and SVG stroke drawing. Press easing `cubic-bezier(.2,.8,.2,1)`; settle easing `cubic-bezier(.16,1,.3,1)`. Do not animate layout repeatedly. Animation queues are keyed by accepted event ID; duplicate events never repeat a move. A catch-up snapshot settles instantly. During local travel, suppress inaccurate board targeting briefly while leaving Back and settle usable; opponents never wait on this device's animation. Next-round readiness comes from actions, not `animationend`.

Reduced motion uses a short fade/highlight with equivalent actor/turn/result information; no travel, pulse or countdown spectacle. Keyboard support covers controls and board alternatives; visible focus, screen-reader names and concise live announcements identify turns/results without announcing every animation frame.

## Verification boundary

Before release, verify main text at 4.5:1 and essential large graphics/controls at 3:1 against actual backgrounds, with visible focus and distinguishable ownership. Numeric token checks alone do not prove rendered UI, pair perception, text scaling, thumb comfort, motion smoothness or PWA installation. First implementation visual pass reviews Home, Games, one board and a handoff panel in all four Standard/Romantic × Light/Dark variants; that review adjusts tokens, not product scope.
