# Overnight A09 — Ludo finishing

**Role:** game-engineer  
**Tasks:** A09-T1 through A09-T5  
**Outcome:** READY_FOR_REVIEW  
**Owned files changed:** `src/games/ludo/ludo-board.tsx`, `tests/e2e/ludo/ludo-screen.test.ts`, `assets/libreludo/README.md`, this report.  
**Rules source:** A04 reviewed `shared/games/ludo/`; no reducer or shared protocol changes were needed.

## Task results

- **A09-T1 — reference provenance:** the lead later fetched and verified the requested commit, inspected its GNU AGPLv3 license, and retained the unmodified archive, full license, and SHA-256 under `assets/libreludo/`. This remains reference-only; no upstream code, artwork, or runtime dependency is used.
- **A09-T2 — numbered mixed stacks:** co-located pawns retain stable A-then-B/token-ID order and distinct per-token names through eight occupants. Singles use 82% of their square, two pawns use 62%, three/four use 46%, and larger stacks use a compact three-column fan. For stacks over four, the selection area adds a readable seat/count/location summary and directs players to the large numbered token controls. On 320/390 px Chromium captures the eight-pawn glyphs remain small because of the fixed 15×15 board cells; the visible summary and large controls provide the readable identification path.
- **A09-T3 — accepted movement and settle:** movement keyframes derive from accepted `token-moved` effects and `getBoardCoordinate`, including ring and home-lane cells. Travel scales by steps and is capped at 1,200 ms. During a capture, the identified pawn is held visually at the landing square until the attacker arrives, then returns to its own yard; movement is capped at 960 ms when followed by the 240 ms capture return. The total stays within 1,200 ms. Targets are disabled during travel; Settle remains usable. Null-event reconciliation, blur, hidden page, offline/online transitions, live reduced-motion enablement, and unmount cancel local animations. Interrupted accepted state remains in the rendered view.
- **A09-T4 — feedback:** accepted dice effects animate the die; ignored six, no legal move, capture, home arrival, bonus roll, next turn, and win receive text feedback. A concrete center goal wrapper is present for a restrained completion accent. A stable polite live region announces accepted move/capture/terminal facts. Reduced motion skips travel and completion motion while preserving outcome text.
- **A09-T5 — focused verification:** SSR cases cover an eight-token mixed stack with its seat/count summary, solo-pawn size, explicit center goal target, and accepted move/capture announcements. A synthetic Chromium fixture inspected 320/390 layouts and exercised capture travel, disabled roll input, and settle completion. Existing rule/geometry tests were rerun. See checks below.

## Checks

- `npm run typecheck` — currently blocked by unrelated `tests/integration/records/records.test.ts:355` TS2304 (`getBestUnassistedTime` not found); no Ludo file is named in the diagnostic.
- `npx vitest run tests/e2e/ludo/ludo-screen.test.ts tests/unit/games/ludo/ludo.test.ts` — passed, 2 files / 15 tests.
- `npx prettier --check src/games/ludo/ludo-board.tsx tests/e2e/ludo/ludo-screen.test.ts` — passed.
- `git diff --check -- src/games/ludo/ludo-board.tsx tests/e2e/ludo/ludo-screen.test.ts` — passed (Git emitted only its LF-to-CRLF notice).
- Synthetic Chromium at 320×844 and 390×844 confirmed a 14 px / 18 px centered single pawn, a rendered center goal target, and eight named pawns in the mixed stack. A synthetic accepted capture sequence showed the captured pawn at the landing square before return, then at its yard; roll was disabled during travel and re-enabled after settle. Measured remaining motion after the 80 ms checkpoint was 480 ms; total sequence was about 560 ms, within the cap. Screenshots: `.local/a09-ludo-single-320-final.png`, `.local/a09-ludo-single-390-final.png`, `.local/a09-ludo-stack8-320-final.png`, `.local/a09-ludo-stack8-390-final.png`, `.local/a09-ludo-capture-final.png`. The final seat/count summary is covered by SSR; these browser captures predate that last summary addition.

## Evidence limits and next action

The browser pass used an isolated synthetic React fixture with authored accepted-effect props; it does not prove live Worker event delivery or real-client reconciliation. Keyboard/rapid-tap coverage, all four appearance variants, 200% text scaling, reduced-motion browser behavior, and phone touch feel remain unverified. Eight-pawn glyphs are small on narrow boards; readable summary and large named selection controls provide the action path, while packed-digit readability is not claimed. MatchScreen snapshot reconciliation clears the accepted event, so this component settles on the resulting null event. A08 shared cancellation integration and real-device verification remain lead gates.

## Lead reference resolution

The earlier A09-T1 network limitation was resolved by the lead after worker lease release. Approved isolated Git clone/fetch verified the exact requested HEAD425b100097d1a113fa8d6d90e53eff6519a53edc; license source is GNU AGPLv3. `git archive` produced assets/libreludo/reference-425b100.zip, SHA256372002413ce2a9cc5b20828dc66662a883f1d0a5ab50777e6cae5f1d7453f0fb. Full license retained; no upstream code/artwork/runtime is used. README now states verified provenance. Production-import exclusion inspected by lead; final build exclusion is a separate acceptance check. Lead reran7 combined slice files,47 tests passed including Ludo unit/SSR, nav/ready/savedSSR and controller/sync contracts.
