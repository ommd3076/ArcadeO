# Private Arcade

## Owner correction — 2026-10-03

The current implementation brief is [Overnight Finish](planning/review/OVERNIGHT-FINISH-2026-10-03.md). Two DIFFERENT accounts on phone/PC must play Remote synchronously without a takeover loop or reloads. Phone Back/Leave/Resume and small real controls are release requirements.

Connection loss never awards a loss; accepted progress remains resumable. Deliberately saved matches have no automatic expiry. A deliberately saved/resumed Sudoku Duel retains history/completion but is excluded from competitive wins, streaks and best times. Ordinary refresh/background/offline retains continuous competitive timing. Offline inputs pause.

The owner authorized implementation in a new GPT-6.1 Sol High chat with GPT-6 Luna specialist executions/reviews. Use twelve bounded submissions, at most three active specialists. Preserve eight games, two accounts, Standard/Romantic identity and accepted saved rules. Deployment and physical-phone certification remain separate gates.

## Product scope

Build a private, installable arcade for exactly two predetermined people. They can play apart on two devices or together on one phone/laptop, without changing accounts every turn. The experience should feel personal, calm, tactile and fast: familiar notebook/board games presented with modern typography, rounded surfaces and clear motion.

The complete V1 contains **Ludo, Sudoku, Dots & Boxes, Rock Paper Scissors, Hand Cricket, SOS, Connect Four and Snakes & Ladders**. Sudoku supports classic practice, live same-puzzle duel and a challenge played later. The other seven support remote and shared-device play. No AI opponent is needed.

## What success looks like

- Sign in, pick a game, invite the other fixed account or choose Together, and understand the next action immediately.
- Finish every game, see an accurate result, resume interrupted matches and inspect simple shared records.
- Hand a phone over in secret-choice games without revealing the previous choice through normal screens or refresh.
- Use the installed app on an iPhone without depending on browser chrome or an Android back button.
- See meaningful accepted-action animation without allowing animation to decide game outcomes.
- Keep hosting free or near zero at this scale, using Cloudflare-native persistence and networking.

## Product decisions

Sudoku has freely selectable numbered puzzles in Easy, Medium, Hard and Expert, with completion markers. Initial content target is 250 verified puzzles in each group. Notes, erase and undo are core usability. Solo practice can pause and check entries; competitive timing continues after Start through refresh, backgrounding and disconnection. Competitive choices/boards are private.

Ludo uses the owner-approved rules in [GAME-RULES](planning/GAME-RULES.md): exactly one token captured from an unsafe stack; a third consecutive six causes no move and gives another roll while preserving earlier moves. Remaining deterministic defaults are explicitly documented there.

Saved server state is authoritative in both play modes. A disconnected device shows its last accepted state and pauses input. Back preserves a match; resignation or unscored abandonment is a separate explicit action. Multiple different games can be active, with clear Resume entries and bounded active slots.

## Visual identity

The tracker/task references are the primary direction: oversized readable headings, generous hierarchy, rounded card surfaces and a compact navigation bar. Tennis is secondary inspiration for nested roundness, breathing room and a dimensional game object. Screenshots are inspiration rather than a layout to copy literally.

Owner A defaults to the Standard family: black/white framing with the references' mint, cyan and warm yellow cards and accents. It is a colorful regular theme, not monochrome. Player B defaults to the Romantic family: moody purple dark, with elegant pink light available. Both start in Dark and may choose either family plus Light/Dark/System. The shell palette belongs to the viewer; player ownership remains distinguishable with separate accent colors and labels. No franchise artwork, toy-store economy or avatar collection.

## Information architecture

Home shows a greeting, compact weekly sentence, one prominent Continue entry and quick game access. Games contains eight clearly named games and their relevant play modes. Us contains shared records, recent results, separate Sudoku practice records and appearance/preferences. Gameplay is board-first, with a visible Back control, named turn/roles, score and only the necessary game controls.

## V1 boundaries

Exactly two accounts; no signup, email recovery, public rooms, matchmaking, chat, public leaderboard, ads, currency, photo uploads or extra games. Offline multiplayer, push notifications, full replay UI, endless Sudoku generation, human hint engine and elaborate milestones are deferred. Essential motion, accessibility, saved-state recovery and both phones' navigation are V1 requirements.

## Execution documents

Use [PRD](planning/PRD.md) for requirements/flows, [DESIGN](DESIGN.md) and [UI contract](planning/UI-CONTRACT.md) for presentation, [TRD](planning/TRD.md)/[TDD](planning/TDD.md) for engineering, [game rules](planning/GAME-RULES.md) for outcomes, and the [implementation plan](planning/IMPLEMENTATION-PLAN.md) for execution. Agents read only the documents relevant to their task; do not repeatedly reload the raw handoff.

The original `private_arcade_context.txt` is retained as historical product provenance. This authored scope and the owner's later corrections are the implementation brief. The overnight goal is complete usable V1 implementation; deployment and actual-phone certification require available access/hardware and must not be fabricated.
