# Product requirements document — ArcadeO V1

## Current owner acceptance requirements — 2026-10-03

O01: Different A/B accounts create/accept/Ready/play synchronously from phone/PC without reloads or cross-account takeover. O02: Sudoku Duel retains independently playable private boards and own-account device transfer.

O03: Phone Back/Leave/Resume remains reachable and distinguishes save from resign/abandon. O04: Saved entries are discoverable/resumable in Home/setup/Vault; no automatic saved expiry or disconnect loss. O05: Deliberately saved Duels are history-only for competitive records.

O06: Every visible color/format/library control is real, labeled, readable, themed, accessible and correctly persisted. O07: Accepted-event motion communicates actor/result/next action, settles on interruption and supports reduced motion without exposing secrets.

O08: Full loading/auth/not-found/retry/offline/pending/error states. O09: Mobile safe areas, keyboard, landscape, app-local Back and 200% text are exercised. O10: Measured loading/input/frames/resource cleanup and public-only PWA behavior.

O11: Preserve eight games, accepted rules/geometry/two accounts and qualify LibreLudo as reference-only. O12: Twelve real bounded specialist submissions, final real-runtime/browser evidence, checked-in local release candidate and documented remaining account/device/deployment gates.

The [current plan](review/OVERNIGHT-FINISH-2026-10-03.md) and acceptance ledger supersede contradictory historical proposals; do not add billing/store features from dictated navigation wording.

Revision 2, 2026-09-30. This is the operative product specification together with PRODUCT.md and GAME-RULES.md. Earlier planning claims do not prove executable behavior. Requirement IDs below are used in the test and execution records.

## People, modes and constraints

Exactly two seeded accounts, A and B; display names/usernames are setup values, not rules IDs. A's primary phone is Pixel 7, B's is iPhone 16 Pro Max; either phone and a laptop may be shared. Phone portrait is the primary layout. Play never requires a hover, browser back toolbar, repeated account switching or landscape orientation.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| P01 | Fixed-account password login; no signup/email | Both accounts can sign in separately; unauthenticated routes cannot read match content |
| P02 | Home/Games/Us navigation | All three labeled destinations work; every nested route has visible Back/Close and deep-link fallback |
| P03 | Seven games in remote and together, three Sudoku modes | Every mode listed in the game catalog opens a functioning start/resume flow; no inert Coming soon cards |
| P04 | Server-saved acceptance | Board/scores reflect accepted moves; uncertain replies recover without applying twice |
| P05 | Offline input pause | Last accepted board stays visible; controls explain reconnect; no queued offline moves or automatic forfeit |
| P06 | Resume across refresh/device | Signed-in account discovers matches on a new device; refreshing restores phase/score/locks/pending roll |
| P07 | Completion and rematch | Correct winner/draw/reason saved once, board terminal, rematch is a new match |
| P08 | Private shared-phone choices | Normal handoff, refresh/back/focus and waiting screens omit locked values until reveal |
| P09 | Appearance preferences | Standard black/white framing with mint/cyan/yellow accents, and Romantic purple/pink families; each offers Light/Dark/System; A Standard-dark, B Romantic-dark defaults; selection survives reload |
| P10 | Ownership distinct from theme | Accent and shape/initial identity remain readable across all palette variants; color change cannot alter turns |
| P11 | Installed PWA and safe areas | Public shell install assets work; standalone navigation works on both actual phones; no controls behind system chrome |
| P12 | Meaningful accessible motion | Important accepted actions communicate change/actor/next action; reduced-motion and keyboard paths preserve information |
| P13 | Basic records | Shared wins/draws/history and separate Sudoku practice records derive from distinct server outcomes |
| P14 | Backend failure recovery | Authority failure blocks input with retry, archive lag does not fabricate or undo a saved result |
| P15 | Eight locked games | All engine, screen, motion, completion and restore acceptance rows in GAME-RULES/TEST-PLAN fulfilled |
| P16 | Personal favourites and shared play next | Per-account pins and a small ordered shared list persist; stale writes preserve the other player's saved changes |
| P17 | Names and compact recap | Personal names preserve canonical account identity; recap comes only from saved shared results and shows no invented play duration |

## Catalog and start flows

Stable IDs: `ludo`, `sudoku`, `dots-boxes`, `rps`, `hand-cricket`, `sos`, `connect-four`, `snakes-ladders`. Modes: `remote`, `together` for seven shared games; `practice`, `duel`, `async-sender` and published `async-challenge` lifecycle for Sudoku. UI labels use readable names, not internal IDs. No duplicate engine for together mode.

### Remote

1. Open Games → named game → Play apart. RPS chooses best-of format; Sudoku chooses its mode/difficulty. Dots & Boxes chooses 5/7/9 dots and SOS chooses 5/7/9 cells before saving the match. Ludo chooses distinct curated pawn colours before play and supports appearance changes during play.
2. Create a saved invitation to the other fixed account. If an active slot exists, show Resume instead of overwriting it.
3. Invitee sees the invitation through Home/active matches when opening the app. Accept or Decline; creator may Cancel while waiting. No push notification requirement.
4. Both confirm Ready. Show whose turn begins; no disconnected person is implicitly ready. Sudoku duel discloses continuous timing and starts both private boards from a common server time.
5. Accepted actions animate. Waiting player sees the named actor and clear state. A blocked/illegal action does not advance the turn.
6. A saved terminal result opens the result panel. Rematch proposes a new invitation; it does not reactivate the completed match.

### Together

1. Either fixed account signs in and chooses Play together → We are both here.
2. This session is the trusted controller for both seats; the active seat determines ownership. Existing match resumes; switching devices requires explicit Continue on this device.
3. Turn games share a board with named active player and legal inputs. Secret games use the full-screen handoff sequence below.
4. Back returns to Games/Home and preserves the match. No silent reset when returning. Explicit together abandonment is unscored; resignation names the resigning seat before confirmation.

### Secret-choice handoff

Show [Name], your turn → Ready → choose → Lock → wait for saved confirmation → remove choice from screen/local state → Pass to [Other] neutral panel → Ready → choose/Lock → Reveal together → saved result → Next. Alternate first-choice seat on each round/delivery. Choice selection is editable until Lock, immutable afterward. On any re-entry start masked, restore lock status and offer only the outstanding seat/reveal step. Laptop cover fills the game area; waiting person looks away. No enforceable spectator/screenshot protection is claimed.

## Sudoku product behavior

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S01 | Four difficulty groups with stable free-selection numbers | Any puzzle can start without prior completion; completion markers independent of ordering |
| S02 | 1,000 verified launch puzzles | 250 per group, each unique and exactly one solution, versioned catalog/provenance; no claim based solely on bank README |
| S03 | Notes/erase/undo | Givens protected; selected cell and number pad usable; notes per player; undo never rewinds time/assistance |
| S04 | Practice pause/check | Accepted pause masks board and blocks edits; Check marks assisted permanently; no mistake-limit loss |
| S05 | Live duel | Same givens, separate boards, common start, first server-validated finish; no opponent entries/notes exposed |
| S06 | Challenge played later | Sender's eligible result target is saved; receiver accepts to start their own timer; waiting period excluded; equal whole-second times draw |
| S07 | Continuous competitive timer | Refresh/background/offline do not stop or reset it; explanatory sentence before Start; input pauses offline |
| S08 | Assistance/replay records | No competitive Check; replay/completed-puzzle attempts are marked ineligible for fresh records; no score supplied by client |

Practice flow: Games → Sudoku → Practice → difficulty → numbered puzzle list → Start/Resume. Existing active attempt can resume or be explicitly discarded to choose a new one. Puzzle list preserves difficulty/scroll after Back. Completion panel states elapsed time, assistance/replay status and Next puzzle/Back. Next puzzle chooses an uncompleted puzzle in the same group if available; otherwise offers the list. No forced unlock path.

Duel flow: choose difficulty → invitation → both Ready → three-second start → same new eligible puzzle → solve privately → result. Server selects a puzzle not completed by either user where possible; if exhausted, clearly offer an unranked replay before readiness. Pause/Check are absent. Notes/Undo remain.

Async flow: choose difficulty → timed sender attempt → valid completion → Publish challenge → invitee sees target/difficulty → Accept and start → receiver completion → compare → result. Receiver previously completed that puzzle: show Replay for fun with no fresh competitive record, or Decline. Sender's unpublished attempt is a separate resumable solo challenge attempt, not a shared victory. Cancelling an unaccepted challenge is unscored. No parallel retry attempts for a better time.

## Screen inventory and states

| Screen | Content/primary action | Required exceptional states |
| --- | --- | --- |
| Login | Two-account username/password form, Sign in | Submitting, invalid credentials, throttled, offline, backend unavailable |
| Home | Greeting, weekly sentence, prominent Continue, quick games | No matches, invitation, several active, stats syncing, registry unavailable |
| Games | Eight named game entries | Keyboard/focus, theme variants, catalog failure; no dead cards |
| Game detail/setup | Game identity, mode, concise rules, Play/Resume | Existing slot, creating, invite pending/declined/cancelled, partial-create retry |
| Sudoku difficulty/list | Four groups, numbered puzzle buttons, completion markers | Loading, empty/error catalog, resumed attempt, group exhausted/replay |
| Match waiting | Names, mode, acceptance/readiness state | Cancel/decline races, disconnected, session expired |
| Turn-game board | Back, connection, players/score/turn, board, legal controls | Pending command, stale state, takeover, reconnect, terminal |
| Secret panel | Named chooser, choices, Lock, neutral handoff/reveal | Locked immutable, refresh masked, both locked, offline, result/Next readiness |
| Sudoku board | Selection/pad, notes/erase/undo, timer, allowed assistance | Practice pause, assistance marked, competing waiting/win/loss, failed finish |
| Result | Winner/draw/reason, saved score/time, Rematch/Back | Forfeit/unscored abandonment, history syncing, rematch slot conflict |
| All active | Game/mode/phase, Resume, invitations | Unknown/unavailable match, discovery failure, dormant labels |
| Us | Head-to-head, per-game records, recent results, solo records | Empty stats, loading, archive delay, error/retry |
| Appearance | Palette family, mode, player accent preview | Duplicate accent rejected, saving/error, system changes, midmatch switch |

All active may be a Home section/sheet with an accessible route/state rather than a new bottom tab. Result is a saved match view, not a separate authority. Every error offers an honest actionable path. Use copy such as “Move not saved yet”, “Reconnecting — showing your saved game”, “Game finished; records are syncing”, not implementation terms like durable object or sequence mismatch.

## Records and match management

Use one scored terminal result per shared match. Draws have their own count. Forfeits are flagged; unscored abandonment/cancelled invitations do not inflate games played. Shared results can filter remote/together. Practice best times/completions are separate. Timezone Asia/Calcutta; Monday-start weekly summary. Streak definitions are in SYSTEM-CONTRACT. No suggestion engine, infinite cards or achievement economy is required.

Active slots remain bounded but different games/modes can coexist. Explicit abandonment needs both remote seats' agreement; together trusted controller represents both. No inactivity auto-loss. A dormant label is informational. User must see what Resume refers to, especially multiple Sudoku attempts/modes.

## Quality and completion boundary

Local functional completion means all P/S requirements have implementation and automated/browser evidence, not placeholders. Visual completion requires inspected screenshots/interactions at phone and laptop sizes and all four palette/mode combinations. Actual-device/PWA certification and authenticated Cloudflare deployment are separate release evidence. If external access or hardware is unavailable overnight, finish all independent build/test work and leave precisely those checks pending in the morning report. Do not downgrade the eight-game product to meet the clock.

The execution agent may choose routine technical defaults within contracts without repeatedly asking the owner. Product outcome, privacy, saved-state compatibility or new-cost changes require explicit review. The current chat prepares this handoff and does not execute implementation.
