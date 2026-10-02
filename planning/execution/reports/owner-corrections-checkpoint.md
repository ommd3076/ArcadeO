# Owner corrections — final local checkpoint, 2026-10-02

## Disposition

**LOCAL_OWNER_CORRECTIONS_VERIFIED.** The owner-authorized corrections and required local checks are complete. GPT-6 Luna specialists handled bounded implementation/review work; the lead integrated changes and captured actual exits. Deployment and hardware certification remain separate.

## Implemented

- Ludo saves deliberate pawn selection even for one legal pawn, preserves pending rolls through reload/colour updates, and rejects rerolls. The classic four-house board provides direct and labelled pawn selection. Eight named colours retain seat identity; remote updates derive the authenticated seat, reject near-identical pairs and stale versions.
- New Snakes & Ladders matches use version 2; missing-version matches keep version 1. Traced ladders: **1→38, 4→14, 9→31, 21→42, 28→84, 51→67, 72→91, 81→99**. Snakes: **17→7, 53→34, 63→18, 64→60, 87→45, 92→73, 95→75, 98→79**. The central rails are one 28→84 ladder; 1→38 crosses 22/23. Original editable snakes have curved tapered bodies, heads, eyes, spots and tongues. Accepted travel follows the actual snake/ladder path.
- Dots uses 5/7/9 dots, SOS uses 5/7/9 cells; saved dimensions remain fixed midgame and legacy defaults stay 5. Scoring/completion use the selected dimensions. Dots/SOS/Connect Four have larger focusable boards; Dots/SOS zoom pans and labelled coordinate alternatives remain available.
- Shared gameplay primitives, DM Sans regular/medium/tabular numerals and four appearances are integrated. The board stays prominent; Home/Us navigation is absent during play; meaningful connection/error states remain.
- Favourites are personal; the ordered play-next queue is shared with version checks. Recap uses actual scored saved results, excludes abandoned/practice/sender-only attempts, and invents no durations. Name/preferences retain account identity.
- Accepted-event motion deduplicates and cancels on authoritative replacement/unmount; reload settles and reduced motion suppresses travel. Lazy routes, public shell caching and requester broadcast deduplication reduce payloads/traffic while preserving saved authority.

## Actual validation

| Category | Result |
| --- | --- |
| Build, typecheck, lint, formatting | Exit 0; client/SW/Worker dry-run built |
| Pure/unit Vitest | 265 tests / 18 files; exit 0 |
| Source/mocked contracts | 55 tests / 9 files; exit 0 |
| Server-rendered components | 44 tests / 11 files; exit 0 |
| Real Workers durability + actual workerd/SQLite DO/D1 HTTP | 4 tests + 26 scenarios; integration command exit 0 |
| Full real Worker Chromium suite | 56 tests in one run; exit 0 |
| Supplementary zoom/recap browser suite | 3 tests; exit 0 |
| Instrumented performance follow-up | Existing test rerun; exit 0 |
| Sudoku content | 1,000 uniquely solvable puzzles, 250 per difficulty; exit 0 |

The full browser run covers 6 environment, 17 journey, 12 authority, 6 correction, 14 visual/motion and 1 performance tests. The supplementary run adds horizontal panning/outer-column actions for both 9×9 games and real result-to-recap projection: **59 distinct browser tests** across the two runs. They are separate from pure tests and physical-phone evidence.

Earlier failures were corrected and rerun: profile loading/name-save feedback, waiting-state error expectation, visual secret handoff readiness, Cricket innings locator, and missing SOS/Dots CSS animation names. A parallel HTTP repeat lost its connection after three checks; the later isolated full run passed all 26. Final browser runs had no failures. Actual HTTP scenario details are in `planning/review/evidence/runtime-results.json`.

## Visual and motion evidence

Evidence folder: `planning/review/evidence/owner-corrections/`.

- **208 matrix screenshots**: eight games × four appearances × 320/390/430/1280 (128), Dots/SOS 7/9 (64), and active Cricket choices (16). Focus, zoom, keyboard focus, actual computed font sizes increased 25%, and reduced-motion captures are additional states. Page-level overflow assertions passed.
- Root/Luna inspected the rendered screenshots. SNL 100 clipping, Connect Four title truncation, dark zoom label contrast and faint Dots edges were corrected. RPS/Cricket show actual unmasked choices. RPS spacing is tight at 125% but controls remain visible; narrow dice cards wrap. These are recorded polish limits.
- Root/Luna inspected 91 sampled frames from preserved `accepted-motion-reviewed.webm` (`motion-frames/`). They show pawn selection/movement, SNL numbered progression, disc placement, Dots fill/score and SOS strike/score. Sampled stills do not measure smoothness.
- The final `accepted-motion.webm`/`accepted-motion-observations.json` come from the passing full run. Live Animation checks observed all five boards, both snake and ladder travel, zero board animations after refresh, and zero reduced-motion travel for live inputs. Replacement/duplicate-event checks establish cancellation/no replay.
- Real browser wheel panning and accepted outer-column input are captured in `dots-boxes-zoom-panned-320.png` and `sos-zoom-panned-320.png`, closing the screenshot-only panning limitation. A newly completed scored game appears in recap; an abandoned match does not.

Visual reports: `owner-visual-review-other.md` and `planning/review/execution/reports/owner-visual-review-secondary.md`. Earlier slice reports retain their original scoped evidence; this checkpoint supersedes pending integration statements.

## Performance and external limits

See [measured comparison](owner-performance-final.md) and raw JSON. Initial JS fell 33.8%, public shell precache 31.0%, and received message count 33.3%. Faster loading/input is not demonstrated: final cold FCP median **800 ms versus 684 ms**, input **19.5 ms versus 15.5 ms**; typical frame interval remained 16.7 ms. Resource measurements are limited to the exercised route cycles, with precise heap and head-link data disclosed.

Browser emulation does not certify physical phones. Worker dry-run is not a deployment. No commit, deployment or external message was performed; unrelated existing edits were preserved. No credentials, session dumps or reference watermarks were added to public assets.
