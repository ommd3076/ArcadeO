# Together Hand Cricket correction

The owner requested batting to continue until OUT, with matching secret numbers dismissing the batter and exchanging batting/bowling roles. Implementation remains on `codex/ui`. The finish-condition default was stated as one batting turn each, then compare totals; no answer to the optional clarification was received during this pass.

## Confirmed defects and changes

- Normal `secret.next` preserved `revealed=true` from the previous scoring ball. The shared handoff could then enter its outcome stage with no outcome and render no playable controls. Next now resets reveal, and public views normalize old stale reveal flags without discarding scores or locks. The earlier resume check exercised an innings swap, which already reset reveal; it missed repeated scoring balls.
- The Cricket board passed the changing `expectedChooser` as the fixed first chooser. After the first accepted lock, this could name the original batter again as the receiver. First chooser now remains the saved batter for the whole ball; a new ball gets a fresh handoff keyed to its accepted delivery ID. Refresh after the first lock reconstructs the bowler's curtain.
- The header could retain the bowler's turn label after a revealed scoring ball. Cricket now shows the actual chooser and role during choices, both-lock status before reveal, and the actual batter after a scoring ball.
- Together version 2 uses both-out scoring. Different numbers add the batter's number and retain their role. Equal numbers add zero and dismiss them. Explicit Reveal then Switch batting exchanges roles after the first OUT. The second batter continues past the first total until their own OUT; higher final total wins, equality draws. There is no Together chase target. Internal innings field names are retained for persistence and records compatibility; the Together UI uses batting/bowling terminology.
- Old active version-2 games consume the correction with accepted runs and locks preserved. An old pending chase-winning ball that had not yet been revealed keeps its runs and becomes playable again. Completed results remain immutable. Remote and saved legacy version-1 games retain their original completion rules.
- Shared secret controls retain the preceding narrow-screen grid correction and clarified Ready guidance. RPS keeps its default labels and rules. Catalog wording now reflects current 1–10 choices.

## Current evidence

- Build including TypeScript, frontend/service-worker bundles and Worker dry run: passed.
- Pure unit: 274 passed, including five new Together cases covering both starting batters, repeated scoring balls, no early target finish, equal totals, stale reveal recovery and pending-versus-completed old results.
- Mocked contracts: 61 passed. Server-rendered components: 46 passed. These are separate from actual runtime/browser evidence.
- Chromium against isolated bundled workerd/SQLite DO/D1: four journeys passed. Both starting batters play 7/3, 4/2, 10/10, then the new batter plays 10/3, 7/2 and 5/5. This proves first total 11, second total 17, continued play after 17, final winner after OUT, and one saved bowling wicket each. The journeys assert named handoffs, refresh after the first lock and after Next, covered numbers/totals/results before Reveal, blur/resume, keyboard Ready, reduced motion, choice-grid containment and saved outcome details. Remote Cricket and Together RPS also pass.
- Browser viewports: 390x844 and 1082x668. Current captures were visually inspected after the final UI change: `.local/browser-results/cricket-A-keeps-batting.png`, `cricket-B-past-first-total.png`, plus both variants' result captures. These use synthetic test matches, not the owner's saved matches.
- Lint and targeted Prettier checks: passed. The local dev frontend/Worker health endpoint responds healthy.

## Limits

This is a targeted game repair, not a new certification of every Arcade screen or every browser journey. The whole browser suite and physical phone tests were not rerun here. No merge or deployment was performed. Current worktree changes are uncommitted; the repository's Git metadata is read-only in this execution sandbox. The owner's saved match was not played through or reset by the tests.
