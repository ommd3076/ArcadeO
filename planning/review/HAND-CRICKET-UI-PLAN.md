# Hand Cricket repair and mockup adoption plan

Date: 2026-10-02. **Planning only.** The owner reports broken Hand Cricket pass-and-play, masking/unmasking and a clock initially showing roughly `1129:29`. No application code, rules, schema, dependencies, tests or deployment were changed or executed for this planning pass. Earlier passing checks remain historical evidence for their exercised paths; they do not dismiss the reported failures.

## Owner priorities and confirmed direction

1. Hand Cricket rules, remote play, pass-and-play privacy, timing diagnosis, usable number layout and cricket records.
2. Adopt the new mockup direction through reviewed reusable components, with measured optimization.
3. More Dots/SOS board options later; retain the current 5/7/9 options meanwhile.

The owner confirmed **numbers 1–10 on every ball**, not ten balls or a target of ten. Reference influence is **60% habit tracker, 30% tennis spacing/layout/tactility, 10% playful game accents**. These are design influences, not percentages of uppercase text. Imported Stitch documents that call themselves “approved” are candidate artifacts; this review does not freeze their implementation details.

## 1. Current evidence and repair targets

| Finding | Evidence | Interpretation / planned action |
| --- | --- | --- |
| Numbers are still limited to 1–6 | `shared/games/hand-cricket/engine.ts:204`, `shared/protocol/guards.ts` secret.lock validation, six `CRICKET_NUMBER_OPTIONS` in `src/games/hand-cricket/hand-cricket-board.tsx` | Confirmed discrepancy with the new owner rule. Update all layers together, with saved rule compatibility. |
| Reveal failure can look like success | `src/screens/match.tsx:268` catches without rethrowing; `secret-handoff.tsx:209` sets revealed-outcome after the resolved callback | Confirmed code-level inconsistency. Reveal only from accepted saved state; expose rejection/retry and retain the veil. |
| Next rejection loses its success/failure signal | `src/screens/match.tsx:276` catches/logs; handoff awaits the callback | Keep failures observable and show named readiness/pending state. |
| Remote Next has no peer readiness feedback | `CricketView.readiness` exists; board does not pass it to SecretHandoff; its generic Next Round stays enabled except during submission | Show “You’re ready · waiting for [name]”; disable duplicate readiness and advance only when both are ready. Together already acknowledges both with one trusted-controller Next action (`engine.ts:650`); preserve that behavior. |
| Together selection instructions can describe the wrong role | Board prompt uses localSeat while handoff chooser can be another seat | Derive prompt/name/role from the actual expected chooser. Keep client and Worker order identical. |
| Conditional hook exists after the toss return | `hand-cricket-board.tsx:162` useMemo follows conditional toss rendering | Correct hook placement. This violates hook-order conventions; a runtime crash was not reproduced in this planning audit, so it is not asserted as the cause of every failure. |
| Two concealment state owners and a local stage machine coexist | `use-secret-concealment.ts`, `match-session.ts` secretChoiceMasked, `secret-handoff.tsx` togetherStep | Review state coordination and recovery. No incorrect-seat lock race was confirmed from source alone. Preserve privacy redaction; reproduce the actual symptom before replacing behavior. |
| No cricket-specific wicket/high-score records | Existing records API has general results and Sudoku records, not cricket scorecards | Add only the requested cricket records, derived from accepted outcomes. |

### Timing symptom: keep diagnosis precise

Hand Cricket currently has no elapsed-game clock. Its timing is presentation/reveal and networking. The `mm:ss` elapsed display is in `src/games/sudoku/sudoku-board.tsx:80–105`; its minutes have no hours formatting, so a long saved elapsed value could display as `1129:29`. This is a plausible explanation, not a reproduced root cause. The owner gave a symptom, not an expected starting time.

The implementation pass must identify the actual screen/build/match and distinguish fresh creation from Resume. Inspect saved start/elapsed/pause values and millisecond/second conversion before any reset or migration. Fresh clocks start at 00:00 at the correct accepted Start; prestart stays zero; resumed clocks preserve legitimate elapsed time. Practice pause/background/Back behavior and competitive continuous timing require separate checks. Long elapsed time should use an explicit hours format. Do not reset old competitive clocks or add a cricket move deadline to conceal the symptom. Any proposed cricket duration display is optional and needs its own semantics.

## 2. Proposed Hand Cricket contract

These are proposed defaults to carry into implementation planning: one wicket per innings, no ball limit, two innings, and no overs. Only the 1–10 choice range is newly confirmed; multi-wicket innings and timers are not requested.

### Toss and innings

- After both remote players are ready, show a real coin toss flow: named caller selects Heads/Tails, server samples and saves one coin result, both see that result/winner, winner chooses Bat or Bowl. Together uses the same saved toss on one controller. Proposed caller default: match creator; reconnect never rerolls the toss. Each rematch gets a fresh toss.
- Every ball uses an integer 1–10 from each player. Different values add the **batter’s** number. Equal values score zero and dismiss the batter, crediting the bowler one wicket.
- First dismissal finishes innings 1. After explicit acknowledgement, swap roles and chase first innings total + 1.
- A chase ends immediately when the target is reached. On dismissal, below the first total loses; equal totals draw. A zero first innings sets target 1. A successful chase is marked not out.
- New matches pin the new cricket rules. Existing 1–6 matches retain their saved rules/order. Current DO code hardcodes rulesVersion 1; design a registered per-game version dispatch rather than globally allowing version 2 for every game. Public view supplies the allowed range/order; UI generates options from it. Generic parsing may allow 1–10, but the reducer still enforces each saved match’s range.

### Remote flow

Both independently choose → explicit Lock → accepted choice becomes immutable and hidden → named waiting state → both accepted locks resolve the ball → show both numbers, runs/OUT and score → each player acknowledges once → next ball or innings.

Simultaneous locks are legal. Opponent values remain absent from snapshots, events, receipts and errors until reveal. Refresh restores accepted locks without requiring a new number. A delayed receipt cannot resolve the next ball. Reveal animation is optional presentation and cannot decide the result or block the next accepted state.

### Pass-and-play flow

For new rules, propose **batter chooses first, bowler second** each ball; this follows the physical game and avoids unexplained A/B parity. Worker derives the expected actor from saved roles/locks, not an arbitrary client seat. Preserve old-match ordering if versioned.

1. “[Batter name], start your turn.” Choose 1–10 and Lock.
2. Cover the entire game interaction region immediately, showing “Saving your number” while pending. Do not expose the selected tile, focus ring, label or accessibility text underneath.
3. After accepted lock: “Pass to [bowler name].” The receiver explicitly taps “I am [name] · Start my turn.” This opens only their choice screen.
4. Bowler chooses and Locks. Cover again; after both accepted locks show “Both numbers locked · Reveal ball.”
5. Explicit Reveal exposes the accepted result. **Unlocking a turn and revealing both numbers are separate actions.**
6. One shared-controller Next ball/Start second innings acknowledges both and transitions from saved state.

Blur, background, Back and reload clear an unconfirmed preview and restore a safe named veil. Unmask never reveals the previous number. Back preserves the match; it does not undo an accepted lock. Rejected/uncertain locks stay covered until receipt recovery determines the accepted state. A terminal wicket/win remains hidden in Together until its explicit reveal, including score and result metadata.

## 3. Number layout and requested records

### Number pad

Use **five columns × two rows**, 1–5 / 6–10. At 320px, 16px gutters and 8px gaps leave approximately 51px-wide cells; target 56–64px height. Show one large numeral per tile instead of duplicating “7” and “7 Runs.” Keep clear selected/focus/pending/disabled states and a separate full-width Lock action. Role-aware instructions, innings score, named batter/bowler, target and runs needed remain visible. No decorative timer or generic “Your turn” that contradicts simultaneous remote choice.

### Cricket records

Us should show each person’s **highest completed innings score**, **total batting runs**, **total bowling wickets**, and a recent two-innings scorecard. Mark successful chases not out; show innings context beside records. Most wickets is a comparison of the two people, not a public leaderboard.

Persist immutable innings facts: match/rules version, batter/bowler account IDs, runs, accepted balls, dismissal/not-out and completion reason. DO saved facts are authoritative; D1 projection is idempotent per match/innings. Duplicate receipts/projection retries cannot add runs or wickets twice. A resignation is not a wicket; abandoned or incomplete innings do not silently inflate completed records. Backfill historical records only where saved facts prove them; show unavailable/records-since-update rather than inventing zeros or dismissals. No schema migration is authorized in this planning pass.

## 4. Image review: preserve strengths, refine fidelity

Root inspected all K1–K8 PNGs and tennis/tracker/playful references. Luna inspected supporting catalog, Us, Sudoku setup/board and older settings images. Static images establish composition only; they do not prove typography files, target sizes, motion, saving or usable phone states.

| Screens | Keep | Planned improvement |
| --- | --- | --- |
| K1–K4 Home themes | Coherent charcoal/porcelain/plum/blush families, one prominent Continue surface, bold short game heading, restrained lime/lilac accents | Give the greeting and human summary tracker-scale prominence. Reading/status text needs more room; reduce tiny tracked labels. Keep condensed capitals for selected short headings, readable sans for controls/body. Maintain labelled Home/Games/Us in every theme. |
| K5 outer game shell | Board-first layout, visible Back, no global tabs, generous tennis-style breathing room | Remove unexplained upper voids on short phones; keep board controls reachable. Preserve actual column/pawn controls. A primary Drop action must reflect a user-selected valid column, not a fixed column 4. Remove Offer Draw and advice attributed to the partner unless separately specified. Show timers only for games that have clock semantics. |
| K6 privacy veil | Opaque cover, one named receiver, clear dominant action | Rename turn unlock to Start my turn; create separate both-locked Reveal ball state. Add pending, rejected, uncertain-recovery and resumed variants. Back cannot bypass the veil or undo a lock. A small lock symbol can preserve the game accent without making a 3D render necessary. |
| K7 desktop | Balanced dominant/secondary columns and compact top navigation | Increase readable text scale and reduce status/badge density. Include real empty/multiple-match states; remove Spectate, invented Ludo rounds and backend telemetry from product copy. |
| K8 new settings | Strongest tracker composition: charcoal framing, porcelain/mint/yellow cards, varied sizes and clear groups | Labels must express actual scope: account theme vs device mode vs new-match piece preference vs a current Ludo match override. Save badges follow actual acceptance; device mode does not imply peer sync. Partner preview is read-only. Haptics/chimes are new capabilities: availability/off/failed states must be designed before promising ON. |

### Correct the generated document drift

- Reference influence is 60% tracker / 30% tennis / 10% playful accents. It must not become a mandatory 60/30/10 font-percentage formula or universal uppercase controls.
- Use the tracker’s readable editorial hierarchy and mint/cyan/yellow emphasis; use tennis’s broad margins, large tactile objects and nested proportions. Keep bubbles/starbursts occasional so they occupy about the intended accent share. Pink/purple themes keep the same hierarchy.
- Wagers, live chat-like partner quotes, “top 2% couple,” live ping, DO consensus, end-to-end-encryption claims, Spectate and Ludo Round 2 of 3 are not implementation requirements. A move-summary bubble may use actual accepted move text, not invented speech or strategy advice. No wagering/chat/ranking features are proposed here.
- Reserve uppercase display styling for short headings. Keep DM Sans as the existing reading/control baseline while a specific optional display face and its exact license are verified. The mockup font lists do not prove what rendered or establish permission for every named font.
- Choose consistent nested geometry rather than applying 32px everywhere. For example, outer radius 32px / padding 12px / inner radius 20px; generous 20px padding needs a correspondingly smaller inner radius. Scale by component size.
- Orange badges need readable ink and adequate type; verify actual rendered contrast. Icon-only docks, 9px functional text and static ON/SAVED/PEER SYNCED badges require correction.

## 5. What to add to the mockup/primitive list

Avoid duplicating the existing GameHeader, PlayerScoreStrip, BoardViewport, FocusModeToggle, ActionDock, SegmentedControl, ColourPicker, Sheet, InlineNotice and ResultPanel. Extend these after mapping tokens.

**Required additions/state coverage:**

1. CricketToss, role selection, CricketNumberPad, CricketScoreboard/ChaseTarget, BallOutcome/Wicket, InningsTransition and CricketScorecard/Records.
2. A shared PrivacyVeil with named receiver and distinct pending/pass/resume/both-locked/reveal states; WaitingForPeer readiness state and submission/rejection/uncertain-recovery feedback. Reuse it with RPS without changing that game’s rules.
3. A clock display with fresh/prestart/running/paused/resumed/finished/long-duration variants only for supported clocks.
4. Settings save/retry/conflict status, segmented previews and availability-aware sensory toggles if sensory features are later chosen.
5. Home with no active game, multiple active games, invitation, failed discovery and Resume; real waiting/Ready/decline/cancel; result/rematch and records empty/loading/sync/error states.
6. At least 320px and laptop versions of Cricket choice/veil/result and settings, plus all four themes, 200% text/zoom, keyboard focus and reduced motion. A single 390px poster is not a responsive contract.

Do not add more decorative dashboards, avatars, currencies, milestones or extra games. More Dots/SOS dimensions remain a second-priority design question: specify the desired sizes and interaction limits after Cricket is settled.

## 6. Planned execution order and ownership

| Stage | Responsibility / owned paths | Exit evidence required later |
| --- | --- | --- |
| A: reproduce and freeze | Lead: planning contracts/flow map; source inspection of reported build/match/clock | Short recording of an actual failure; confirmed fresh-vs-resume timer case; agreed new rule/version/stat definitions |
| B: rules and persistence | Rules worker: `shared/games/hand-cricket/`; lead lease: registry/protocol; backend worker: match DO/records + lead-leased migration | Equal/different 1–10 choices, roles/target/tie/zero, old rules compatibility, idempotent stats and privacy filtering in real Worker |
| C: handoff and Cricket UI | Frontend: Cricket board + shared secret handoff/concealment; lead integrates match/sync callbacks | Real two-device and one-device flows, accepted-state transitions, rejection/uncertain recovery, both readiness states; RPS regression |
| D: mockup adoption | UI owner: tokens and mapped existing primitives; screen owners have exclusive screen paths | Real-content Home/Settings/Cricket states at 320/390/430/laptop in four themes; no unsupported mockup features |
| E: measured optimization | QA/performance reviewer: representative Home and Cricket journeys | Before/after load/font bytes, input-to-accepted feedback, reveal interruption, route listener/socket lifetime and collected heap; fix measured bottlenecks |
| F: Dots/SOS later | Separate bounded planning task | Desired additional sizes, phone pan/zoom/direct/coordinate ergonomics and dimension-dependent scoring/terminal cases |

No two writers share a file. Root protocol/config/schema changes need a lead lease. Implementation, test execution and deployment do not start from this planning document; the current owner direction is plan only.

## 7. Acceptance scenarios for the later repair

- Fresh UI coin toss, saved winner, Bat/Bowl and refresh without reroll. Both roles and both player identities exercised.
- Together batter 7/bowler 7 → explicit reveal → OUT, zero ball runs, bowler wicket; innings swap only once. Batter 7/bowler 3 → +7; both 10 → wicket; 10 versus 9 → +10. Invalid 0/11/fraction/string rejected.
- Remote simultaneous locks and delayed/duplicate delivery receipts; each Next acknowledgement has feedback and no duplicate advance. Together needs one controller Next.
- Refresh/Back/blur/background/offline/takeover at every handoff stage, including rejected Reveal and terminal unrevealed ball. Inspect public view/event/receipt/error and accessibility tree for hidden numbers/score/result leaks.
- Zero first innings, exact target, overshooting target, dismissal below/equal totals, not-out chase, immutable terminal results and failed record projection/retry.
- Fresh clock zero, paused practice, legitimate resumed duration, competitive continuous time, scheduled Start, clock skew, units and >60-minute format. Diagnose the specific `1129:29` case rather than resetting history.
- Duplicate projections do not double runs/wickets; account ownership mapping stays correct after role swap. Unsupported legacy stats remain unknown.
- Actual touch/keyboard reachability, long names and enlarged text, 1–10 pad, four appearances, reduced motion and low-end phone behavior. Hardware certification remains separate.

**Review disposition: Block functional acceptance and blanket mockup adoption pending repair/reproduction and these state designs.** The visual direction can proceed as the basis for planning. No functionality is claimed repaired in this pass.
