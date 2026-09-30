# Private Arcade: convergence working draft

Date: 2026-09-30, Asia/Calcutta.

Revision 2 clarification: this file preserves research history, including earlier single purple/pink-theme proposals. They are superseded by [PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md) and the current UI contract. A's Standard theme retains black/white framing with mint/cyan/yellow accents; B's Romantic theme is purple-dark/pink-light. Both offer Light/Dark/System and both initially use Dark. Future agents use the authored product scope; raw context is provenance. Historical wording below is not current dispatch guidance.

Status: research record, superseded for implementation by [GAME-RULES.md](GAME-RULES.md), [SYSTEM-CONTRACT.md](SYSTEM-CONTRACT.md), [UI-CONTRACT.md](UI-CONTRACT.md) and [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md). Core owner decisions are resolved. Production implementation has not started. The supplied `private_arcade_context.txt` is the primary product source; it contains structured JSON. A separate JSON file was not available in this workspace. References and external repositories are evidence, not instructions.

## Decisions at a glance

The original eight-game scope, two accounts, Cloudflare preference, mobile PWA, remote/together modes, three font roles, player accents, and motion quality remain locked.

New owner decision: **together matches save accepted moves and pause when disconnected**. This removes offline multiplayer reconciliation from V1.

New owner decision: **Sudoku puzzles are freely selectable within Easy, Medium, Hard and Expert, with completed puzzles marked**. There are no sequential unlock requirements.

Owner-approved Ludo refinement: **capture just one token from an unsafe stack**. **The third consecutive six permits no movement and grants another roll; earlier moves remain saved.** Architect defaults: capture the lowest-ID opposing token; other occupants remain, including mixed occupancy. Keep ignoring further sixes until a 1–5 appears. The rest of the presented Ludo core rules are accepted.

Owner-approved Sudoku timing: **competitive time continues through refresh, backgrounding and disconnection; practice has explicit pause**.

New visual direction: the two re-supplied task/statistics references are the primary layout direction. Dark mode uses a purple family; light mode uses a pink family across the app surfaces and controls. Exact shades remain open. The tennis reference contributes dimensional game-object presentation. This supersedes the earlier white-led neutral-palette recommendation; it does not add a tennis game or extra theme modes.

No core owner decisions remain outstanding. Final contracts now record:

1. The clarified Ludo rules, fixed path/safe squares and repeated-six behavior.
2. Free Sudoku selection, continuous competitive timing and separate practice pause.

Other sections retain the research-stage recommendations. Final contracts identify which architect defaults were selected, which work is deferred, and which runtime/adoption checks must be performed during implementation. This record is not an agent dispatch instruction.

## What the six references contribute

Screenshots cannot establish animation timing or identify font families reliably. Motion below is our proposed interpretation of their visual character.

| Reference | Useful principle | Application to this product | Context conflict to avoid |
| --- | --- | --- | --- |
| 1: tennis app | Strong game identity, spacious composition, rounded main surface, prominent back control | Small procedural board illustrations identify each game; one clear action per screen; visible back | Court stacks must not become a hidden carousel for eight games; avatar collections and opponent search are outside scope |
| 2: task app overview | Compact greeting, large readable type, a few surfaces with distinct emphasis | Brief greeting, one Continue surface, one compact weekly snapshot | A feed and repeated statistic cards would contradict the context |
| 3: enlarged statistics screen | Oversized headline with deliberate line breaks, black framing, cyan/yellow accents | Bold headings and compact scores; use color to emphasize one useful fact | We have no meaningful 'above average' population statistic for two people; icon-only navigation needs labels |
| 4: component breakdown | Shared corner treatment, small chips, consistent component rhythm | A few reusable controls and surfaces rather than bespoke game layouts | Too many chips and microcards would clutter Home |
| 5: orange schedule app | High contrast, restrained outlines, obvious circular back control, strong numeric hierarchy | Tactile controls; bold score hierarchy; accent-colored moments | Full orange screens would compete with configurable player colors and the chosen purple/pink direction |
| 6: bright learning app | Personality in headings, energetic but clear selected states, compact pill controls | A small amount of celebratory typography and color | Avatar stores, neon everywhere, currency, AI chat, levels as an economy, and character asset work are outside V1 |

Updated visual direction: a typographic arcade using the task/statistics references' spacious hierarchy, large headings, rounded surfaces and compact pill controls. Dark is moody purple with an understated gothic character; light is elegant blush/rose pink. Use a range of tones rather than coloring every element the same shade. Wednesday is a mood reference, not a request for franchise artwork, gothic body text, cobwebs or a Halloween reskin. Barbie is a color association, not a request for logos, characters or a bright toy-like UI.

The tennis-ball reference contributes a tactile, dimensional hero-object principle: a die, pawn or other recognizable object from the existing games can provide a small moment of personality on Home or a game detail screen. No full-screen intro, 3D runtime or additional game is required. Keep the board, navigation and main action visually clear.

| Role | Purple dark direction | Pink light direction |
| --- | --- | --- |
| Canvas | Near-black aubergine | Very pale blush |
| Surfaces | Dark plum with clear tonal separation | Soft rose-white with slightly deeper pink secondary surfaces |
| Main text | Pale lavender-white | Deep plum/charcoal |
| Primary controls | Muted luminous lilac/violet | Dusty rose or berry with readable text |
| Borders and selection | Subtle violet borders; clearer lavender active state | Muted rose borders; deeper pink active state |
| Game boards | Theme-tinted base; distinct player ownership | Theme-tinted base; distinct player ownership |

Both palettes are available to either account through the existing light/dark/system setting. Proposed initial preference for player B is dark based on her stated preference; the owner can retain system mode. This is a planning default, not a change to an existing account. The initial hue direction is chosen; final color values and contrast verification are deferred to the visual contract.

### Small visual defaults

- Palette: use the purple-dark/pink-light role table above. Do not freeze the earlier neutral hex values. Final values must preserve readable text, control states and board geometry in both themes.
- Spacing: 4/8/12/16/24/32; phone page gutters 16–20 CSS pixels. Keep the existing 10/16/24/pill corner roles.
- Typography candidate: Space Grotesk for headings, DM Sans for UI, DM Mono for scores/timers. Use UI digits in dense board cells where that reads better. These are proposed families, not identified screenshot fonts. Their upstream projects are [Space Grotesk](https://github.com/floriankarsten/space-grotesk), [DM Sans](https://github.com/googlefonts/dm-fonts), and [DM Mono](https://github.com/googlefonts/dm-mono).
- Icons: recommend Lucide, one consistent stroke treatment; import only used icons. Its official packages support this approach. [Lucide documentation](https://lucide.dev/guide/)
- Color has three roles: theme-tinted shell, occasional game identity tint, player ownership. Theme colors apply to backgrounds, cards, navigation, buttons and board surfaces. Ownership and semantic warning/error states retain distinguishable colors/marks. The two players cannot become indistinguishable purple or pink pieces.
- Curated player choices remain blue, orange, teal, violet, magenta and green. Propose violet as player B's personal accent because she requested it, with a contrasting owner accent chosen from the same palette. Either user can change their accent; no gender-based mapping. Before freezing values, make a small allowed-pair table verified in both themes; enforce it when saving preferences. Initials, labels, and piece marks supplement color.
- Store a player accent family/identity in the match, with theme-specific readable shades. Changing light/dark recolors presentation without changing the player's identity, turn or saved state. Theme choice and personal player accent are separate preferences.
- Home: greeting, compact weekly sentence, one prominent Continue entry with an 'all active' link if needed, quick game access. Empty state leads directly to Games. Games shows eight clearly named entries. Us contains records and appearance/preferences.
- Three labeled bottom tabs on shell screens. Gameplay uses a visible Back control and compact score/turn bar; hiding the bottom tabs there gives the board room. Back preserves the match. A separate menu exposes resignation or abandonment.
- Laptop: centered board and a narrow score/control column where useful; do not stretch a phone board to full monitor width or fill the space with extra dashboards.
- Controls normally have 44–48 CSS-pixel target dimensions. Dense boards need dedicated interaction treatment rather than overlapping invisible hit targets.

### Phone board ergonomics

- Ludo's 15×15 geometry cannot offer a 44-pixel target in every cell on a phone. Show enlarged legal-piece controls below the board as an equivalent selection path; retain board highlighting. Identical-position tokens can be grouped visually and selected from these controls.
- Sudoku's 9×9 board fits without zoom at narrow phone widths. Keep one selected cell, a large number pad, notes toggle, erase, and undo. Test real thumb entry; do not claim every cell is 44 pixels wide.
- Dots & Boxes starts at 5×5 dots (16 boxes). A broad edge target can support direct taps; two adjacent-dot selection is an alternative with clear cancel behavior. The SVG stroke remains visually narrow.
- SOS starts at 5×5 cells. Pick S or O using large controls, then tap a cell. Connect Four provides seven large column controls in addition to board taps.
- Snakes & Ladders needs readable cells but only the dice control is interactive. No cell tapping is required.
- Secret games use full-screen handoff/readiness panels on phones. On laptops the same panel covers the full game area, and players take turns looking away. The device cannot prove who is looking.

## Reuse research: borrow the useful part

Do not install an entire game app, backend, visual system, AI opponent, or engine framework. 'Headless' means rules without a supplied screen. A wrapper translates a borrowed library into our own state/action format, so the UI and server do not depend directly on its quirks.

This round inspected upstream documentation, license material where obtainable, and selected source files. No dependency was installed or executed. Candidate status is not proof of correctness or Worker compatibility.

| Game | Candidate/evidence | Proposed reuse boundary | Limit or adoption condition |
| --- | --- | --- | --- |
| Sudoku | [Sudoku Exchange puzzle bank](https://github.com/grantm/sudoku-exchange-puzzle-bank), [dataset license](https://github.com/grantm/sudoku-exchange-puzzle-bank/blob/master/LICENSE.txt) | Import a modest versioned puzzle subset, ratings and provenance | The project documents unique solutions and four rated buckets; independently validate every selected puzzle during import |
| Ludo | [@ayshrj/ludo.js](https://github.com/ayshrj/ludo.js) | Evaluate extracting/adapting its rules, not its example UI | README declares MIT, but a standalone license file was not visible. Confirm notices in the pinned artifact. Node EventEmitter, internally generated rolls, fixed colors, ranking completion and incomplete documented restore state require inspection. Do not approve an unmodified runtime import |
| Dots & Boxes | [DotBox](https://github.com/gmetzker/DotBox), [engine source](https://github.com/gmetzker/DotBox/blob/master/src/dotBox.gameEngine.js), [license](https://github.com/gmetzker/DotBox/blob/master/LICENSE) | Adapt only rules helpers and useful test cases, retaining notices | MIT verified. Engine uses a shared namespace and related utility/state files; preserve behavior while converting to plain serializable state. Exclude AI, canvas UI, CreateJS, Knockout and jQuery |
| Connect Four | [Dev Share Academy rules package](https://github.com/devshareacademy/connect-four), [license](https://github.com/devshareacademy/connect-four/blob/main/LICENSE) | Strongest small package candidate; wrap gameplay logic or adapt core functions | MIT verified; documented 7×6 board, full-column/game-over rejection and move history. Verify serialization, immutable reducer behavior and all win/draw cases before adopting |
| Rock Paper Scissors | [Dimensions RPS example](https://github.com/StoneT2000/Dimensions/tree/master/examples/rock-paper-scissors) as a rules reference | Write the tiny outcome table ourselves; reuse our secret-round protocol | Its competition framework is far larger than this game needs. Do not adopt it. No small external dependency was qualified |
| Hand Cricket | [Ardad2 rule description](https://github.com/Ardad2/hand-cricket-mobile), [1561taha project](https://github.com/1561taha/HandCricket) | Use sources to compare rule variants; implement a small innings reducer | Examples differ on 0–6 versus 1–6 and wicket formats. React Native/AI and blockchain code do not fit. License/source verification did not qualify a reusable core |
| SOS | [SOS-Game](https://github.com/jhonnatan1806/SOS-Game), [Python SOS project](https://github.com/Sk-Azraf-Sami/SOS-Paper-Pencil-Game-AI) | Reference general versus first-SOS variants; small own line-detection module | The TS app did not show a license; the Python project declares MIT but is a different runtime. Neither is a qualified drop-in rules package |
| Snakes & Ladders | [retroverse-phaser](https://github.com/johnicjio/retroverse-phaser), [C implementation](https://github.com/TraceHanami/snake_ladder) | Borrow ideas for board transition data and fixtures if licensing is confirmed; own short movement reducer | Phaser app README describes separate rules files, but those source files/license were not retrievable in this review. C does not fit our runtime. Do not adopt either whole project |

Additional Ludo exclusions: [Souma061's source](https://github.com/Souma061/Ludo/blob/main/src/hooks/useGameLogics.ts) puts state in React/localStorage and turn changes behind timeouts; that conflicts with our rules/UI separation. [ludi](https://github.com/DR-coder101/ludi) documents an unimplemented rules scaffold and is unlicensed. [ludo-royale](https://github.com/stackiid/ludo-royale) contains conflicting MIT metadata and all-rights-reserved prose; exclude it unless the license is resolved. Chinese Ludo is a different game variant. These findings are reasons to avoid blind cloning, not proof that no usable engine exists.

### Sudoku content and levels

Recommended initial content: 250 independently verified puzzles in each of Easy, Medium, Hard and Expert. This is a proposed launch quantity, not an imported or measured count. Numbering identifies a puzzle; a higher number need not mean greater difficulty. Owner-approved navigation: freely select any numbered puzzle within a difficulty, with completed puzzles marked; no sequential unlocks.

The bank documents QQWing generation and Sukaku Explainer grading, with bucket boundaries at 1.5, 2.5 and 5.0. We can label its diabolical bucket Expert and retain the original rating internally. Select a sensible spread within each bucket; avoid making the first Expert puzzle an extreme outlier. [Puzzle-bank documentation](https://github.com/grantm/sudoku-exchange-puzzle-bank)

Alternative researched: [sudoku-gen](https://github.com/petewritescode/sudoku-gen) declares MIT and four difficulty labels, but generates transformations of existing seeds. It is fast and useful, but many permutations are not the same as many different logical structures. Prefer the rated bank for V1; keep generation as an optional content tool rather than a required runtime dependency. [sudoku.js](https://github.com/robatron/sudoku.js) documents difficulty based on clue count; its generator is not our preferred difficulty source.

Human difficulty is more than clue count. Research links it to solving-step complexity and dependencies between steps; the bank's technique-based ratings are a useful starting point, not a universal human difficulty guarantee. [Pelánek's difficulty study](https://arxiv.org/abs/1403.7373)

Import contract: pin the source revision; normalize givens; reject invalid digits, duplicate puzzles and inconsistent clues; count solutions up to two and accept exactly one; derive the solution; store stable puzzle IDs, givens, solution, rating, bucket and provenance. This runs during content preparation, not on every phone start. Keep solutions server-side for competitive attempts; deliver only each player's puzzle/progress. Public puzzles and trusted users do not require an anti-cheat platform.

Notes and undo are recommended V1 Sudoku requirements because they materially affect usability, especially at harder difficulties. Pencil marks are player-specific. Correctness assistance is explained under game defaults below.

## Architecture explained without the terminology trap

Imagine a match as a referee with a permanently saved scorebook. The screen asks to make a move. The referee checks whose move it is, writes the accepted change, then tells the screens what happened. The screens animate that change. Separately, an archive collects records for Home and Us.

| Component | Plain-language responsibility | Proposed technical boundary |
| --- | --- | --- |
| Frontend | The screen, controls and animation | React/TypeScript candidate; local component/reducer state; no large global state framework |
| Worker | Checks login and routes requests | One origin for static assets and authenticated API; no separate Express service |
| Match Durable Object | Match referee and saved scorebook | One SQLite-backed object per match/solo attempt; owns current state, accepted events, secret submissions and outcome |
| D1 | Account/preferences store and archive/index | Stores account/session/profile data, puzzle catalog, match discovery and versioned history/result projections |
| WebSocket | Fast delivery between referee and screen | Hibernation API; reconnect always restores from persistent match storage |

Cloudflare provides SQLite-backed Durable Objects on Free and documents persistent storage and transactions. Its hibernation API can preserve connections while clearing object memory. Therefore an open connection or memory variable is insufficient persistence. [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/), [storage](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/), [WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

**Proposed correction to the handoff:** DO storage becomes the one authority for active matches; D1 is a recoverable archive, not a second referee. The context's proposed D1 snapshots can remain as versioned copies, but resuming never chooses an old D1 copy over a newer DO state. This changes the suggested persistence division while preserving the locked reliability goal.

Proposed accepted-move sequence:

1. Authenticate the sender; identify the match and permitted seat.
2. Check action ID for a previous receipt, then validate relevant turn/round/progress version and legal action.
3. Save the new state, accepted event, action receipt and pending archive update together in one DO storage transaction. Random dice results are generated outside the pure reducer and saved as part of this event.
4. Send acceptance only after that storage commit is durable. A phone can show immediate press/selection feedback while waiting; committed pieces/scores change on acceptance.
5. Broadcast a view appropriate to each player and animate it.
6. Update D1 by match ID/version using the saved pending-update record. Retry idempotently. Older updates cannot overwrite newer ones or count a win twice.

No cross-database atomic transaction is assumed. D1 failure after a match move should delay statistics, not undo the match. DO failure before acceptance leaves no claimed move. An uncertain response is reconciled using the same action ID. DO alarms can support retries, but automatic retries are bounded; explicitly reschedule with capped backoff and retry on subsequent activity. [Alarm documentation](https://developers.cloudflare.com/durable-objects/api/alarms/)

Match creation is different: establish a discoverable D1 reservation before announcing success, then initialize the DO idempotently. A uniqueness constraint prevents two simultaneous creates for the same active game/mode slot. A partially initialized reservation is retried using its creation ID; it never masquerades as a playable match. D1 outage blocks new matches/account operations but need not erase existing matches. Archive lag after completion may briefly delay releasing its creation slot; surface that rather than creating a duplicate.

### Identity on a shared phone

Remote mode: the login account supplies the seat; a client cannot claim the other player's ID.

Together mode: one signed-in host explicitly starts a together match for both fixed players. That match grants its controlling session permission to submit the seat required by the game. The host account and acting seat are recorded separately. Pass-and-play trusts the people handing over the device; it does not pretend the second person authenticated every move.

Only one together controller may write at a time. 'Continue on this device' transfers a server-issued controller generation and invalidates old control. Old tabs become read-only. Mode does not change midmatch. Together statistics can be filtered separately from remote statistics.

### Match lifecycle and discovery

Remote start creates an invitation to the other fixed account. Accept/decline is explicit; both confirm readiness before the match starts. Together start uses a simple 'We are both here' readiness action. A late acceptance cannot reopen a cancelled invitation, and a disconnected user is never auto-ready. No room codes or public lobby are needed. Pending matches appear in Home/Games when the other user opens the app; background push is deferred.

Persist a small lifecycle: waiting, active, completed, resigned, abandoned, cancelled. Connection status is a separate temporary UI condition, not a terminal lifecycle. Dormant is a label derived from inactivity; it does not erase a saved active match. Once a terminal transition is accepted, later moves/abandonments cannot rewrite its outcome. First accepted terminal transition wins the ordering race.

The proposed active slot uses game plus mode: remote and together may coexist; Sudoku practice, duel and async attempts have separate slots. An existing slot leads to Resume, not an implicit reset. Starting another requires explicitly finishing/resigning/abandoning the old one. A request to abandon needs the other player's agreement in remote play; resignation can be unilateral. Together's trusted controller represents both people for an unscored abandonment.

For final system contracts, match discovery must work after sign-in on a new device using the registry, not only the last route saved on the previous phone. If the registry is unavailable, an already known/deep-linked match can still be retried; an empty Home response must not falsely claim there are no active games.

### Secret choices are a server rule

- RPS and Hand Cricket store each round's locked choices in private server state. Before both are locked, the other player receives only lock status, never the value or payload.
- Together views omit previously locked values, including when the controller is allowed to act as either seat. Local selection state is cleared before the pass screen. No choice is put in a URL, browser history, analytics, app-shell cache or client-facing debug log.
- Lock is final for that round. Retry returns the same receipt. A new action ID cannot overwrite a locked choice.
- Each submission is checked against round ID and that player's submission slot, not a single shared turn version. Otherwise two valid simultaneous remote locks could incorrectly reject one another.
- Refresh/re-entry during a secret round starts masked, then shows a neutral handoff/readiness step for the outstanding seat. If both choices were saved, show a neutral 'Reveal together' control. Leaving never unlocks a choice.
- The result is calculated and saved when both choices are locked. A reveal/countdown displays the result; it does not calculate the result or advance the game. The next round starts through an explicit ready/next action, independently of animation callbacks.
- Switching away masks the choice UI when possible. Prevent accidental exposure through normal app routes; do not claim protection from screenshots, someone watching, or a determined device owner inspecting memory.

## Proposed game defaults

These are our house rules, not a claim that one universal official version exists. Rules are stored with a rules version in each match. Changes apply only to new matches.

| Game | Small coherent V1 rules | Edge cases that must be in tests |
| --- | --- | --- |
| Ludo | Four tokens each; six enters; six/capture/home grants one bonus roll, not stacked bonuses; exact finish; marked safe squares; no blockades or capture prerequisite for home; first to finish all four wins. Two opposite seats and eight safe squares, with coordinates in GAME-RULES.md | Third consecutive six causes no movement and another roll; earlier moves stay saved. Subsequent sixes are also ignored until a 1–5. Capture only one opposing token on an exact unsafe landing, lowest token ID automatically; others remain. Mixed occupancy allowed. No legal move resolves immediately; a first/second six still grants another roll. Auto-select a sole legal token; no continued ranking play |
| Sudoku | Classic 9×9; immutable givens; notes, erase and entry undo; local row/column/box conflicts highlighted; no three-mistake limit. Practice check can identify incorrect entries and marks an assisted attempt. Completion verified by server | Incomplete/conflicting grids cannot finish. Wrong but non-conflicting entries may remain until a check/completion. Practice assistance never qualifies as an unassisted best time. Each player has a separate board/notes/revision |
| Dots & Boxes | 5×5 dots; orthogonal adjacent unused edges; one point per completed box; scoring retains the turn; largest total wins when all edges used | One edge can close two boxes and scores both; only one extra turn is needed. Reverse endpoints name the same edge. Final score equality is a draw |
| RPS | Best of 3 by default, best of 5/7 selectable; first to 2/3/4 round wins; ties give neither player a point | Rock beats scissors, scissors beats paper, paper beats rock. Tie starts a new secret round. No automatic timeout choice or default loss |
| Hand Cricket | Numbers 1–6; one wicket per innings; no ball limit; server coin toss winner chooses bat/bowl; matching numbers mean out and score zero on that delivery; otherwise add batter's number; then swap roles | Chase target is first total +1; chase ends immediately when reached. Equal totals after dismissal are a draw; no super-over feature. Choices are secret each delivery. Abandonment handles a match players no longer want to finish |
| SOS | General scoring game on 5×5; either player places either letter; all newly completed three-cell SOS lines score for the placer; scoring retains turn; full board ends game | Horizontal, vertical and both diagonals count. Shared letters/overlapping lines are allowed. Canonical endpoint order avoids double-counting the same line backwards. A move may score multiple lines; empty score equality draws |
| Connect Four | 7 columns ×6 rows; gravity; alternate turns; first line of at least four wins | Reject full/out-of-range/fractional columns; check both diagonal directions and runs longer than four. Last legal placement may win before a full-board draw is considered |
| Snakes & Ladders | Fixed versioned 1–100 board; begin off-board at 0, first roll advances normally; exact roll to 100; overshoot stays in place; six gives no extra roll | Transition only on landing at a snake head/ladder foot. Board data disallows chained endpoints/cycles. Shared occupancy allowed; no captures. Test serpentine numbering and terminal arrival |

Starter default: server randomizes the first player for a new turn-based match and persists that choice. A rematch alternates its starter; Hand Cricket performs a new toss. A rematch is always a new match ID with history retained, not a reset of the completed match.

### Sudoku modes and timing proposal

- Practice/solo: server-saved board, notes and explicit pause/resume. Resume excludes the paused interval. Backgrounding alone is not a reliable pause signal; a visible pause action masks the board. Interrupted saves restore the last accepted revision. Keep practice records separate from competitive outcomes.
- Duel: each player solves the same givens on a private board. Both confirm Ready; a server start time is fixed slightly in the future and the puzzle becomes available at that time. First server-validated finish wins; ordering is by authoritative receipt, not animation or the client's clock. Close finishes can be affected by network latency; V1 does not promise tournament fairness.
- Competitive timers run continuously after Start, including refresh, background and disconnect. Input pauses offline but the timer is not reset or silently stopped. Explain this in one sentence before starting.
- Async challenge: publish a puzzle/result target from an unassisted timed attempt. Receiver accepts before receiving that challenge's puzzle, then gets a continuous timed attempt. Same difficulty/puzzle/assistance policy for both. Compare whole-second elapsed durations; equal displayed durations draw. Abandoned attempts do not become a fabricated loss. A receiver who already completed that puzzle can replay for fun, with the attempt marked as replay rather than a fresh record.
- Practice correctness check is excluded during competitive attempts. Notes and undo remain allowed. Remote progress exposes only submitted filled-cell count, not correct-cell count, entries, notes or the solution.
- Concurrent entries use per-player progress revisions. One active editing controller per player/attempt prevents two tabs from silently overwriting notes. Unsent selection/pencil feedback may be immediate; committed board progress remains server-confirmed.

Continuous competitive timing is owner-approved, with explicit solo practice pause. The final GAME-RULES.md freezes mode details and assistance/replay policies.

## Edge-case register

Blocking means a contract must be resolved before production work; it does not mean every row needs an owner question. Important means a V1 acceptance condition. Safe to defer means it cannot prevent the existing V1 from being usable.

### Blocking

| ID | Scenario/impact | Proposed resolution | Status/owner |
| --- | --- | --- | --- |
| B01 | Two databases disagree about the current match | DO persistent state is authority; D1 is versioned projection; never broadcast before durable commit | Architecture recommendation; architect can resolve |
| B02 | Together play continues offline and conflicts later | Save accepted moves and pause offline; reconcile an uncertain last action before allowing the next | Owner locked |
| B03 | A remote client claims the other seat; shared phone cannot make the other player's move | Separate authenticated account from acting seat; explicit together controller grants seats only in that mode | Architect default |
| B04 | Duplicate tap/retry, stale tab or interrupted reply changes the board twice | Durable action receipts; same ID/payload returns previous receipt; same ID/different payload rejects; turn/version checks | Architect default |
| B05 | Secret value leaks in broadcast, refresh or handoff | Private submissions plus player-specific views; together views do not return prior choices; neutral masked resume | Architect default |
| B06 | Two simultaneous secret locks or Sudoku entries incorrectly conflict | Round/player submission guards for secret games; independent player board revisions for Sudoku | Architect default |
| B07 | Ludo variants alter expected play | Owner-approved one-token capture and ignored third six; fixed geometry/repeated-six defaults in GAME-RULES.md | Resolved contract; fixtures required in implementation |
| B08 | 'Many levels' changes Sudoku content/navigation | Four difficulty groups with stable numbered puzzle IDs; free selection with completed puzzles marked; no sequential unlocks | Owner locked; launch quantity remains proposed |
| B09 | Duel/async pause rules allow faster-looking times or refresh resets | Competitive continuous server timers; practice pausing separate; server validates completion | Owner locked; implementation checks required |
| B10 | Simultaneous new matches, partial creation, or multiple active matches create conflicting invitations | One active match per game per play mode; one solo Sudoku per account; one pending async challenge per direction; other games may coexist. Atomic D1 reservation and idempotent initialization | Architect default; show Resume/New-game distinction |
| B11 | Reused engine depends on DOM, timers, random calls or mutable hidden state | Use rules-only adapter/extraction; pinned version/provenance; complete saved state; no randomness or clocks inside reducers | Technical adoption gate, not an owner choice |
| B12 | Minor game variants and completion are undefined | Use the full proposed rule table; no rule-selection screen beyond RPS format/difficulty | Proposed defaults; summarize for owner |

### Important for V1

| ID | Scenario | Required behavior/evidence |
| --- | --- | --- |
| I01 | Remote turn ownership | Legal moves only for signed-in seat; opponent waiting state names the active player; impossible actions produce specific recoverable feedback |
| I02 | Same-device phone/laptop | Same engine; active seat announced; no account switching; board interaction alternatives from ergonomics section |
| I03 | Reconnect/refresh/DO hibernation | Latest private snapshot restores phase, pending roll, score, locks and progress. Memory reset cannot lose the match. No automatic reroll |
| I04 | Stale/out-of-order clients | Discard old snapshots; gap means resync; if action exists, accept receipt before considering stale version. Never invent rebased opponent moves |
| I05 | Pending action across refresh | Keep nonsecret action metadata/ID until acknowledged. On return reconcile via receipt/latest snapshot. Do not persist raw secret values locally; offer masked recovery/reselection only when server confirms the slot is empty |
| I06 | App suspended/locked/browser page cache | Mask secret panels; on pageshow/focus resync before interaction; skip old animation queues and show the latest accepted board |
| I07 | Deep links/logout/expired session | Login preserves a safe intended internal route; validate access after login. Unknown match shows Games; completed match shows result. Logout revokes sessions and clears local private/pending state |
| I08 | iPhone in-app navigation | Every nested screen has Back or Close. Deep link fallback goes to Games/Home. No custom conflicting edge gesture; no reliance on toolbar presence |
| I09 | Android back | Browser history is the base. Overlay dismissal and app navigation produce sensible history; Back never implicitly resigns. Avoid trapping system navigation |
| I10 | Standalone PWA | Manifest/icons/standalone launch; safe in-app escape everywhere; install/start/refresh/logout checks on actual iPhone and Pixel |
| I11 | Safe areas/keyboard/short viewport | Bottom/top insets; dynamic viewport sizing; board stays accessible; no controls behind browser chrome, keyboard or home indicator |
| I12 | Narrow portrait/laptop layout | Test 320–430 CSS-pixel phone widths plus laptop, text scaling and both themes. Boards fit; selection controls remain practical; no hover-only actions |
| I13 | Player color change/similar preferences | Snapshot accents per match; changes apply to new matches. Verify allowed distinct pair table in both themes. Shape/initial labels retain ownership clarity |
| I14 | Theme changes midanimation | System setting is local-device appearance; profile accent shared. Theme switches cannot restart moves, alter ownership or lose selected state |
| I15 | Animation versus accepted state | Animation is disposable presentation. Suppress duplicate animation by accepted event ID; on catch-up show snapshot. Cancel/simplify animations safely; no outcome or turn transfer in animationend |
| I16 | Input during animation | Prevent accidental duplicate submission; do not require another device to finish animating. If the local board is unsettled, briefly block board targeting with a skip/settle path |
| I17 | Game completion | Terminal outcome saved once, moves disabled, winner/draw and reason clear; result visible immediately even if history is syncing; rematch preserves old match |
| I18 | Abandoned matches | Back/close preserves. Explicit resignation creates a forfeit; mutual abandonment creates an unscored terminal outcome. No automatic loss for disconnection. Inactivity labels a match dormant without deleting it; pending invites may be cancelled |
| I19 | Two control tabs/devices | Server-issued control generation fences together hosts and per-player Sudoku editors. Version checks protect turn games; other tabs show current state/read-only feedback |
| I20 | Backend/quota/storage failure | Stop new submissions when authority unavailable; show retry/reconnecting and last saved state. A commit with lost ACK is reconciled, not retried with a fresh ID. Archive delay is labeled only where material |
| I21 | WebSocket unavailable | A small authenticated HTTP snapshot/action fallback may use the same acceptance pipeline. No independent rules path. Backoff polling; do not need Socket.IO |
| I22 | Stats/streaks/timezones | Count only distinct terminal outcomes. Draws and unscored abandonments are separate; solo is separate. Freeze weekly/streak boundaries to Asia/Calcutta; Monday-start weeks. Exclude cancelled invites from games played |
| I23 | Auth and shared device trust | Fixed accounts, securely hashed server verifiers, rate-limited login, HttpOnly/Secure sessions, same-origin/CSRF controls and socket origin checks. Benchmark Worker-compatible KDF before locking dependency; no credentials in the client |
| I24 | Session expires on an existing socket | Bind a revocable session to socket attachment; validate its lease/expiry on writes and disconnect on logout/expiry; a socket does not grant permanent identity |
| I25 | PWA caches stale game state or upgrades midmatch | Cache versioned public shell/assets only. Auth/private snapshots are no-store; do not precache solutions. Apply updates at a safe return point; retain compatible saved rule/schema versions |
| I26 | Dice reroll/fake randomness | Server roll request has an action receipt; sample one roll, store it once, pass its value to pure rules. A reconnect displays that same roll |
| I27 | Mobile accessibility/reduced motion | Visible focus, readable contrast, keyboard input, ownership labels and concise live status announcements. Reduced motion gives the same information without travel/countdown spectacle |
| I28 | Game-specific loopholes | Exercise every rule table's edge cases, including simultaneous SOS lines, two boxes, full-column rejection, chase target, Ludo stacks/streaks and snake mapping |
| I29 | Sudoku correctness/difficulty/repeated content | Import verification proves exactly one solution for each selected puzzle; source rating retained. Store givens unchanged; restrict editable cells. Replayed/assisted attempts cannot silently replace fresh unassisted records |
| I30 | Competitive Sudoku outage/resignation | Continuous clock behavior is visible before Start; no pause advantage or instant background forfeit. Explain replay/resume choice after reconnect; no client-claimed finish time |

### Safe to defer

| ID | Deferred work | V1 boundary |
| --- | --- | --- |
| D01 | Offline multiplayer event reconciliation | Explicit owner choice allows saved-state pause |
| D02 | Offline solo completion sync | Cached shell/offline message is enough; offline playable Sudoku can be a later independent extension |
| D03 | Full replay UI | Retain useful accepted events but do not build playback controls now |
| D04 | More board sizes/house-rule menus | One board/ruleset per game; different sizes are not required |
| D05 | Generated endless Sudoku/human hint engine | Rated imported puzzles, notes and simple practice check meet the initial need |
| D06 | Push notifications/presence service | Pending matches are discoverable when the app opens; live readiness is match-scoped |
| D07 | Avatar art, sounds/haptics, large celebrations | Simple initials and procedural boards; sound/haptics can enhance later, essential visual motion remains required |
| D08 | Recommendation picker/milestone breadth | Basic history, weekly count and records first; no XP/currency |
| D09 | App name and elaborate logo | Use Private Arcade as a working name; create simple legible install icons at implementation |

## Motion contracts proposed for all games

Every action has immediate tactile feedback, an accepted transition, named ownership, and a clear next action. Use existing duration classes; add only a press easing and a settle easing initially. Reduced motion shortens travel to a highlight/fade without withholding information.

| Game | Accepted change shown | Actor / next interaction |
| --- | --- | --- |
| Ludo | Dice resolves to saved roll; piece travels through accepted path, capture/home feedback | Turn indicator names player; highlight legal tokens or show the next roll |
| Sudoku | Entry acknowledges, related cells highlight, valid completion cascades briefly | Selected cell/player board stays clear; number pad or result remains usable |
| Dots & Boxes | SVG line draws, owned boxes fade in, score updates | Stroke and initials identify actor; indicator explicitly keeps/switches the turn |
| RPS | Lock acknowledged; neutral handoff/wait; compact count-in and clash | Player labels on reveal; round result and Next round/Rematch |
| Hand Cricket | Lock, simultaneous reveal, runs or OUT, innings transition | Batter/bowler roles named; readiness for next delivery or result |
| SOS | Letter appears, each newly scored line traces, score increments | Owner of each line identified; indicator explains bonus turn |
| Connect Four | Disc falls to accepted row and lands; winning line highlights | Ownership by color/mark; column controls enable for next player |
| Snakes & Ladders | Piece advances cell by cell, then follows snake/ladder path | Active player named; next die roll or result |

## Final convergence outcome

- Owner decisions are resolved; final game/system/UI contracts and implementation sequence are in planning/README.md.
- Ludo path/safe-cell coordinates and the fixed snake/ladder map are specified. Geometry/data consistency checks do not replace executable game fixtures.
- Library qualification, credential-runtime benchmarking, puzzle validation, rendered UI/device review and deployment remain implementation gates. Documentation alone is not integration evidence.
- The future agent ownership split is prepared. No agents or production work have been dispatched in this convergence phase.

The 4–5 day target is aggressive for eight animated games plus real-device PWA and recovery verification. Reuse reduces content/rules effort, but not secret-choice UX, shared-phone ergonomics or integration cost. Preserve all eight games; if the full acceptance bar cannot fit the calendar, make the date tradeoff explicit rather than quietly removing reliability or claiming browser simulations prove device installation.
