# V1 test and review plan

Do not mark these checks passed during planning. Map evidence to P/S requirements in PRD and T requirements in TRD. Use Vitest for pure fixtures, Cloudflare Workers test integration for actual Worker/SQLite DO behavior, and Playwright for browser flows. Real phone/PWA checks are separate. No arbitrary blanket coverage percentage; every listed critical branch needs a fixture/assertion.

## Per-game deterministic fixtures

| IDs | Game | Required cases |
| --- | --- | --- |
| L01–L08 | Ludo | six entry versus movement; exact home/overshoot; safe square no capture; unsafe multi-token capture lowest ID only/mixed occupancy; no blockade; third/further six ignored with saved prior moves; no legal move/one deliberate selection/multiple pending; bonus deduplicated and win ends before bonus; colour changes preserve pending roll and token positions |
| SUD01–SUD08 | Sudoku | givens immutable; note/set/erase/undo inverse; local conflict versus wrong nonconflicting entry; server exact solution finish; practice pause/edit rejection/check assistance; continuous duel/async clock; independent own revisions and no opponent entries; replay eligibility/tie floor seconds |
| DB01–DB04 | Dots & Boxes | canonical reversed edge; repeated/nonadjacent rejection; close one/two boxes, score and retain once; all 40 edges/16 boxes and draw |
| RP01–RP04 | RPS | all nine choice pairs; best-of 3/5/7 thresholds; tie no score/uncapped rounds; immutable lock/Next readiness/late round |
| HC01–HC05 | Hand Cricket | toss/role authority; all equal 1–6 OUT zero; batter number scoring; first wicket roles/target including zero; chase immediate target win/equal-dismissal draw/below-target loss |
| SO01–SO04 | SOS | all directions including reverse/overlap; multiple lines one move; scoring retains once/non-scoring transfers; occupied rejection/full-board draw |
| CF01–CF04 | Connect Four | gravity/full column; horizontal/vertical/both diagonals; winning last placement before draw; terminal/malformed column rejection |
| SL01–SL04 | Snakes & Ladders | exact 100/overshoot; six no bonus; origin-only transition once; serpentine geometry and fixed mapping |

For every game assert same input/state yields same state/effects; state survives JSON serialization; failed move leaves state unchanged; wrong actor/terminal mutation rejects; effect cells/IDs agree with final snapshot. Explicitly supply random/timestamps in fixtures. Fuzz legal action sequences with reproducible seeds where it adds meaningful invariant coverage; no decorative tests mirroring getters.

## Content validation

C01: record each local bank digest and parse valid three-field lines into 81 digits/rating.
C02: no duplicate puzzle hash within/across selection; givens consistent.
C03: independently count solutions up to two for all selected puzzles, exactly one; derived solution respects givens/rows/columns/boxes.
C04: exactly 250 per bucket, stable numbering, diabolical→Expert, rating spread and manifest reproducible.
C05: public bundle/catalog never contains solutions/unissued competition givens. Report actual count/time/digest; README claims alone cannot pass.

## Runtime and concurrency

| ID | Scenario | Required assertion |
| --- | --- | --- |
| N01 | Commit succeeds; acknowledgment lost; same ID retried | original die/move/result identity returned once; UI latest view never regresses |
| N02 | Same ID with changed payload | ID_REUSED; no second state change |
| N03 | Storage failure between related writes/sync | no partial snapshot/event/receipt/outbox and no accepted/broadcast claim |
| N04 | DO hibernation/restart; memory removed | saved dice/choice/turn/clock/controllers and legal actions identical |
| N05 | Two simultaneous turn moves | one acceptance; other stale/wrong-turn with unchanged rules |
| N06 | Simultaneous RPS/Cricket locks | both accepted for same round despite intervening delivery version |
| N07 | Opposite Sudoku edits | both own revisions accepted; duplicate own revision rejected |
| N08 | Two creations/same slot/partial initialize | idempotent creation, unique slots, safe repair/no deletion of initialized match |
| N09 | Accept versus cancel; abandon versus action | serialized lifecycle; terminal immutable; uncertain action reconciled before abandon |
| N10 | D1 projection fails/old retry arrives | game remains accepted, outbox retry, no terminal regression/double count/unsafe slot release |
| N11 | Controller takeover races/old writer | generation increases once per accepted takeover; stale controller cannot write |
| N12 | Delivery gap/old/duplicate events | full snapshot resync; no guessed state or repeated animation |
| N13 | WS unavailable | same authenticated HTTP path/rules; visibility-only polling/backoff |
| N14 | Unsupported protocol/schema/rules | recoverable read-only/update; no silent reset |
| N15 | Scheduled duel start late alarm/access | no early givens, server start time stable, no timer extension from delayed callback |
| N16 | Unknown secret lock, empty snapshot, delayed original versus reselection | atomic recovery preserves accepted lock or supersedes old ID first; no old-choice surprise, secret stored nowhere in client; failed recovery keeps input paused |

## Auth/privacy checks

A01: fixed accounts only, generic login error, no verifier/real password committed.
A02: vetted KDF known vectors and real Worker budget measurement at secure parameters.
A03: expiry/revocation enforced for HTTP/socket writes and receipt access.
A04: cross-origin/CSRF/session spoof/member spoof rejection; together acting seat derived except strict named resignation.
A05: private lock values absent before remote resolution/together Reveal in every snapshot/event/receipt/error/log path.
A06: refresh/back/focus/logout clears ephemeral secrets before visible resume; no choice in URL/storage/service-worker cache.
A07: private Sudoku board/notes/correctness and solutions absent from opponent/bundle/catalog.
A08: API/auth no-store, public-only precache, no secret in build/log/seed output.
A09: persistent bounded login limits and auth-store failure pause.
A10: duplicate/concurrent accent choice rejected atomically; family preference version conflict safe.

## Browser journeys and visual review

Run with two isolated authenticated browser contexts and one shared-controller context. Fixtures use explicitly supplied local test accounts; no production bypass.

| ID | Journey / evidence |
| --- | --- |
| B01 | Login → Games → remote invitation → accept/both Ready → move/refresh → terminal → Rematch for all seven shared games |
| B02 | Together start/resume for all seven; one phone viewport; named turns and equivalent board controls |
| B03 | RPS and Cricket full Ready/Lock/Pass/Reveal/Next, refresh and focus at every secret phase; no early values |
| B04 | Sudoku freely select difficulty/number, notes/erase/undo, accepted Pause/Check, assistance/replay completion |
| B05 | Sudoku duel separate boards/common start/near-simultaneous finish; continuous clock across background/offline |
| B06 | Async sender finish/publish/receiver waiting/accept/solve/draw, already-completed replay, cancel/decline/forfeit |
| B07 | Network cut before/after acceptance, reload, WS disabled, session expired, takeover; honest saved/unknown status |
| B08 | Direct match link before login/unknown/completed; Home/Games/Us/Back/Close; no Back resignation |
| B09 | Multiple slots/games visible, Resume never reset, dormant label, registry error distinct from empty |
| B10 | Records once, weekly/streak timezone, shared versus solo filters, archive lag |
| V01 | Home/Games/board/handoff inspected in Standard Dark/Light and Romantic Dark/Light |
| V02 | Every game at 320/390/430 px portrait and laptop; short-height scrolling and text scaling |
| V03 | Press/move/score/turn/finish actor clarity; skip/interruption/duplicate/catch-up/reduced motion |
| V04 | Keyboard/focus/semantic labels/board alternatives/contrast; no color-only owner/status |
| V05 | Appearance changes midmatch; Standard retains mint/cyan/yellow; Romantic distinct; piece identity unchanged |
| V06 | No dead cards, Coming soon controls, clipped headings, covered action bars or placeholder statistics |

Visual review must cite actual files/viewports and findings/fixes, not just saved screenshot filenames. Playwright WebKit is useful approximation; browser screenshots do not certify installation or native Back.

## Actual-device and release gates

D01: Pixel 7 Chrome install/standalone, safe areas, keyboard, Android Back, resume after suspension.
D02: iPhone 16 Pro Max Safari install/standalone, visible Back/Close, safe areas/dynamic viewport, background return, secret concealment.
D03: deployed Cloudflare bindings/migrations/auth/create/write/reload/records using actual configured accounts and origin.
D04: runtime/log/private-cache check in deployed environment; no credentials in artifacts.
D05: owner sees actual Home, all game setup/modes and both theme families with verified controls.

If access/hardware is absent, record UNVERIFIED with exact missing step; keep local functional and visual work running. Release complete requires these checks; morning local complete may leave them honestly pending.

## Evidence and repair policy

Each task report lists command/environment, assertions, screenshots/inspection, failure/fix and remaining limits. Orchestrator reruns integrated relevant checks after worker changes. Reviewers report severity, exact location, reproducible trigger, required outcome and affected IDs. Fix blocking privacy/rules/persistence/navigation findings before cosmetic refinements.

Run meaningful checks once after relevant edits; repeat only for changes/failures. Do not add tests solely for every static color value or document heading. Never disable failing assertions, fabricate test output, use an unverified mock backend as production, or count a compilation pass as playable V1.
