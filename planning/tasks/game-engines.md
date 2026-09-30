# Deterministic game engine packet — G01–G05

GAME-RULES is sole game-outcome authority. TDD defines the pure boundary. Exact assigned modules/tests are in TASKS.json; no UI/backend/shared registry writes. Orchestrator integrates adapters.

## Each module must deliver

Serializable initial state, pure validate/reduce, legal actions, role-filtered view and typed deterministic effects. Accept supplied server random/time facts; never call clock/random/storage/network inside rules. Reject malformed/wrong-turn/occupied/terminal action without state mutation. Snapshot resume must preserve current phase/turn/pending roll/score.

Fixtures cover every named rule branch plus repeatability, JSON round trip and effects matching final snapshot. Reproducible sequence/property checks may add useful invariants; no tests just mirroring trivial getters. Borrow only tiny licensed qualified functions/fixtures; retain notices/digests. Do not install engines' whole project.

## Assigned batches

- **G01 Connect Four:** fixed 7×6 gravity; integer columns/full rejection; runs horizontal/vertical/both diagonals; win before full-board draw; winning coordinates saved. Use MIT reference only if it simplifies pure code.
- **G02 RPS:** all nine pairs; best-of 3/5/7; tie no score/no cap; one private lock per seat/round; remote readiness each, together reveal permission before Next; late locks blocked.
- **G03 Ludo:** fixed 52-ring/home coordinates; four tokens; six entry, exact home; ignored third/further six until 1–5; prior moves retained; no blockade; safe no capture; unsafe capture lowest-ID one only/mixed occupancy; one legal auto-select, multiple saved pending roll; six/capture/home bonus once; win before bonus. Snakes: fixed serpentine map, exact 100/overshoot, six no bonus, one origin-trigger transition; path effects before rendering.
- **G04 Dots/SOS:** canonical edges/line IDs; 5×5 dots→40 edges/16 boxes, two-box closure scoring/retain-once. SOS 5×5 empty S/O placements, all three-cell directions/reversals/overlap, every new line owned by placer, multiple score/retain once, full-board totals/draw.
- **G05 Cricket:** saved coin toss/role choice, 1–6 locks, equal OUT/no runs, batter value otherwise, one wicket each/no overs; target first total+1, chase immediate win, equal dismissal draw, below loss; innings/Next readiness, no client timing.

## Required report

Name implemented rules/fixtures and exact outcomes, copied source/license if any, state/effect types for adapter integration, remaining issue and test command. Do not substitute customary rules for owner-approved rules or claim all-game integration from module tests.
