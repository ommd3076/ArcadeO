# Private Arcade V1 — design specification

Revision 2, 2026-09-30. This is the visual and screen design brief. [UI-CONTRACT](planning/UI-CONTRACT.md) governs interaction, identity and motion; [PRD](planning/PRD.md) governs behavior. Tokens are the first implementation baseline, subject to rendered contrast/fidelity review rather than another product question round.

## Reference hierarchy

Inspect the actual images in [assets/ui-references](assets/ui-references/README.md) before UI work.

1. **Tracker overview/detail/components are primary.** Use black/white framing, large editorial headings, a small number of colored rounded surfaces, compact pills/circular controls and deliberate spacing. Keep mint, cyan and warm yellow in the regular theme.
2. **Tennis surfaces are secondary.** Borrow generous outer padding, nested rounded surfaces, a clear large action and one tactile game object. Do not copy its onboarding, collection or court carousel.
3. Schedule contrast informs numerical hierarchy and circular Back; the playful reference informs a small celebratory accent only.

Screenshots do not identify exact fonts or prove motion. Use the selected font roles and our explicit motion contract. No imported reference screenshots, people, avatars or branded artwork become shipped product assets.

## Appearance: family and mode are separate

- **Standard** is A's default: black/white structure with mint, cyan and yellow. It is not monochrome. Dark has a charcoal shell; Light has an off-white shell. Colored emphasis cards retain soft hues in both.
- **Romantic** is B's default: dark aubergine/plum with lilac, or elegant blush/rose with berry. Purple/pink should permeate surfaces and controls without making every pixel one hue.
- Both default to Dark on first use. Both accounts may choose either family and Light/Dark/System. Romantic is an initial preference for her, not a restriction.
- Family is an account preference in D1; mode is account-scoped on each device. System resolves through the OS. Logout clears private state, not that device's nonsecret appearance preference. On first authenticated load apply account family; prevent a flash with cached nonsecret account-scoped tokens.
- Game-piece families are separate account preferences, snapshotted per match. Never use the viewer's family to decide a piece owner, board path or turn. Two users may view one match with different shell themes.

### Semantic palette baseline

| Token | Standard Dark | Standard Light | Romantic Dark | Romantic Light |
| --- | --- | --- | --- | --- |
| canvas | #0C0C0F | #F7F7F8 | #120C1C | #FFF5F8 |
| surface | #1C1C20 | #FFFFFF | #21152E | #FFE5EE |
| raised | #29292E | #EEEEF1 | #2D1D3D | #FFFFFF |
| text | #F5F5F7 | #17171C | #F6F0FF | #301A2C |
| muted-text | #B9B9C4 | #62626D | #BEAFCD | #735466 |
| primary-fill | #CFE6A3 | #202024 | #C9A7FF | #9A305E |
| on-primary | #1D2915 | #FFFFFF | #241135 | #FFFFFF |
| interactive-line | #898993 | #777780 | #8B719F | #A56C87 |
| focus | #A8DFE4 | #245CC1 | #C9A7FF | #7040B5 |

Standard emphasis cards: mint #CFE6A3 with ink #1D2915; cyan #A8DFE4 with ink #102426; yellow #F4DE88 with ink #30290D. Assign meaning consistently: Continue/mint, weekly shared activity/cyan, invitation or small shared fact/yellow. Do not turn every Games tile into a different pastel. Color does not substitute for status text.

Romantic emphasis cards use raised/surface with lilac or berry borders and headings. Use primary-fill/on-primary only for genuine emphasized actions. Keep warning/error icons and text semantically distinct from both romantic accents and player colors; verify actual error text against its surface.

A Standard Light primary action may be black like the tracker reference; mint remains present in Continue. Primary means the strongest next action, not a mandate to recolor every button green. Board background uses canvas/raised with high-contrast lines. Player foreground tokens are defined once in UI-CONTRACT. Test those on every actual board background; add solid contrast backing to markers when needed.

## Type, spacing and surfaces

Owner correction, 2026-10-01: DM Sans for interface headings, body and controls; regular/medium editorial headings and tabular numerals for scores and timers. Self-host only the needed subsets, keep licenses and use fallbacks. Phone title 32–40 px with compact leading; body 16; secondary 14; labels 12 only where legible. Standard Light follows bright white tennis surfaces with fresh mint/lime accents; Standard Dark follows charcoal tracker framing and mint/cyan/yellow emphasis. Do not reproduce the tracker headline's exact breaks at the expense of wrapping.

Use spacing 4/8/12/16/24/32. Phone page gutters 16–20, card padding 20–24, inter-card gap 12–16, section gap 24–32. Surface radii 24; inset panels 16; compact controls 10–16; pills/circles only for their appropriate roles. A nested radius is smaller than its parent. Keep shadows quiet; separate dark surfaces through tone and a restrained border. No glass dashboard, floating ornaments or endless bento boxes.

Controls normally have 44–48 px targets; icons 20–24. Use labeled bottom destinations and visible control labels where an icon is ambiguous. Fixed controls reserve their space and safe-area padding; never cover the final row of a board/list.

## Layout anatomy

Phone shell: safe-area top padding → heading/context → primary surface → relevant small secondary content → labeled Home/Games/Us tabs. Gameplay: visible Back/title/connection → compact player/turn bar → centered board → contextual action area. Shell tabs are absent in gameplay.

Use dynamic viewport units and safe-area insets. Minimum supported portrait width 320 CSS px; inspect 360/390/430 and text scaling. Let content scroll on short screens rather than shrinking actionable controls. Board maintains aspect ratio; do not force the whole page into one screen.

At laptop width, shell content max-width about 960 px. Home uses one hero/Continue column and a compact secondary column; Games uses up to four tiles per row. Gameplay centers a bounded board, about 480–640 px as appropriate, with a 240–300 px control column if useful. Preserve hierarchy; no extra statistics invented to fill space. At intermediate widths stack gracefully.

## Screen specifications

| Screen | Hierarchy and action | Design decisions |
| --- | --- | --- |
| Login | Private Arcade title, short welcome, form, Sign in | Compact centered panel; no signup or unexplained avatar selection. Inline generic error; submitting feedback does not erase entered username. |
| Home | Greeting/name, short weekly sentence, dominant Continue, quick games | Continue names game/mode/whose turn. Several matches adds All active count; one main card, no stack of oversized competing CTAs. Empty Continue becomes Choose a game. Mint/cyan/yellow in Standard; tonal purple/rose equivalents in Romantic. |
| Games | Title, eight named tiles, mode context on detail | Procedural symbols from real games. Tile name remains readable; no hidden swipe carousel. Phone two columns when width/text allows, one at narrow/text-scaled widths. |
| Game detail | Back/name, compact symbol, mode choices, concise rules, Play/Resume | RPS format/Sudoku difficulty only. Existing slot names saved state and promotes Resume. Avoid a configuration-heavy lobby. |
| Waiting | Both names, invite/Ready status, primary allowed action | Show waiting versus disconnected distinctly. Decline/Cancel secondary. Duel timer disclosure before Ready. |
| All active | Grouped readable match rows with mode/phase | Invitations distinguish Accept from Resume; dormant label does not imply expiry. Discovery failure is not an empty list. |
| Sudoku list | Mode/difficulty, numbered buttons, completion markers | Freely select; stable numbers, no padlocks. Preserve group/scroll on Back. Paginate/render manageable chunks instead of 250 decorative cards at once. |
| Turn board | Named actor and score, board, legal controls | Board is hero. Show saved die and legal choices. Pending acceptance is visibly distinct from accepted travel. |
| Secret game | Named chooser, choices, Lock, then full handoff cover | No tiny flip card concealing part of a choice. Pass/Reveal covers whole game region on phone/laptop. Readiness is deliberate. |
| Sudoku board | Timer/status, 9×9 board, 1–9 pad, Notes/Erase/Undo | Selected digit/cell readable. Practice Check/Pause separated from frequent entry. Competition explains clock and opponent filled count without correctness claims. |
| Result | Winner/draw/reason, essential score/time, Rematch/Back | Terminal board remains visible behind/alongside result. Forfeit and unscored abandonment explicitly labeled. Record-syncing message never hides saved result. |
| Us | Head-to-head, compact per-game records, recent results, separate solo records | No charts without useful two-person meaning. Appearance/logout accessible. Empty state invites play without made-up sample records. |
| Appearance | Standard/Romantic previews, Light/Dark/System, player accent | Preview Home surface and two marked pieces. Family changes save server-side; mode changes immediately per device; show retry if family save fails. |

## Game ergonomics and visible causality

Ludo: 15×15 geometry is too dense for reliable isolated taps on small phones. Preserve the board and supply four named token buttons beneath it. Legal buttons highlight; stacks fan/label for viewing, not ambiguous selection. Safe cells have a stable mark, not only a tint. Saved ignored six explicitly says Roll again.

Dots & Boxes: wide edge regions resolve one nearest edge; equal-distance ambiguous taps do nothing. Dot-to-adjacent-dot selection is the accessible alternative. Score-fill initials persist after line animation.

Connect Four: seven column controls give an equivalent input path. SOS uses S/O selection before cell choice; accessible cell labels include row/column/letter. Snakes & Ladders has only Roll, with accepted roll and transition labels.

RPS/Cricket: large choices, explicit Lock, then named waiting/reveal state. Cricket labels Batter/Bowler, innings, target and OUT. Sudoku given/editable/selected/conflict must differ through weight/border/mark as well as color; no continuous error shaking.

For each accepted interaction show the changed object, named actor, updated score/turn and next available action. Local press/selection may react instantly; optimistic board/score/random outcomes may not. Completion and turn changes come from saved state, never an animation callback.

## Motion implementation and review

Use UI-CONTRACT timings/easing. Board effects are keyed by event IDs; animate only newly accepted events on a synchronized view. A reconnect settles latest state immediately. A new snapshot/Back/Reduce Motion can interrupt and settle travel; no replay of a stale queue or blocked control waiting for an animationend that never fires.

A small procedural die/pawn illustration may add the tennis object's tactile quality. No asset generation or 3D runtime is required to finish V1. Win feedback is compact; score/actor remains readable.

Review Home, Games, one board and secret handoff early in all four variants. Then inspect every game's accepted move/completion at phone/laptop sizes, keyboard/focus, offline, pending, dark/light switch midmatch and reduced motion. Save actual screenshots/video or specific inspection notes. Screenshot presence alone is not visual approval. Actual Android Back/iPhone standalone behavior remains a hardware check.

## Design acceptance

The regular theme visibly retains reference colors; her special family exists independently. All eight games fit portrait with usable alternatives. There are exactly three labeled shell destinations, no dead setup actions, no ornamental feed/economy. Error/wait/empty/pending states match PRD. Text contrast meets 4.5:1 and essential graphics 3:1 on rendered backgrounds. No clipped headlines, concealed buttons, color-only ownership or animation-driven rules.
