# Sudoku packet — S01/S02/S03

Rules/PRD/TDD/DATA-MODEL/TEST-PLAN govern; this covers catalog, server rules and all screens, not a generator or standalone app import.

## S01: qualify content before issuing puzzles

Stream local four-bucket bank. Check digests against ASSET-INVENTORY; parse normalized 81 digits/rating; reject malformed/contradictory givens and duplicate hashes. Independently count solutions with a bounded solver up to two; accept exactly one. Select 250 across each bucket rating range, stable versioned IDs/numbers; diabolical is Expert. Record manifest/source/solver/check outcome. Store derived solutions privately; no all-bank/client payload.

Every selected puzzle needs actual independent solution-count evidence, not just README. Data-selection manifest is reproducible. No endless runtime generator or hint engine dependency.

## S02: saved private progress and server time

Givens immutable; notes bitsets; set clears own notes; no automatic peer cleanup. Erase/undo restore accepted entry/note history only. Local conflicts differ from server Check. Complete exact valid board atomically on edit, no client Finish.

Practice pause server-saved/masks/rejects edits; Check marks assisted permanently; background/offline alone don't pause. Fresh unassisted best times separate from assisted/replay.

Duel chooses eligible puzzle/difficulty, both Ready, server start +3 s, no early givens. Independent own revisions/controller generation; opponent filled count includes wrong entries, never correctness/entries/notes. First server accepted solution wins. Clock never stops on refresh/disconnect/background.

Sender dedicated eligible timed attempt → immutable finish → idempotent published waiting challenge → receiver Accept starts own continuous clock. Receiver completed puzzle offers unranked replay or decline. Equal floor(ms/1000) draws. Waiting time excluded. Replay finalizes scored=false comparison rather than forever-active eligibility wait. No retry better times/check/client result.

Expose server-safe view, own progress only, read-only old controller, resume/terminal and records projection. Lead integrates catalog/creation/router schema seams; do not edit backend owner's files without lease.

## S03: usable complete flows

Mode chooser/difficulty/free numbered list with markers, manageable pagination and retained scroll/group. Active attempt Resume or explicit discard. Phone 9×9 board plus large pad/Notes/Erase/Undo, selected cell/peers, given/editable/conflict styling and accessible labels. Practice Pause/Check only. Competition disclosure before start; display extrapolated server timer, saved result duration authoritative.

Test practice assistance/replay/pause/complete, live private common start/near finish, async sender/publish/wait/receiver/tie/decline/cancel/forfeit/replay, refresh/network/background/takeover. Laptop doesn't stretch board; small phone can scroll controls. No correctness leak via progress or inaccessible tiny pads.

## Exit

C01–C05/SUD01–SUD08/S01–S08/B04–B06 and privacy/timing/recovery runtime evidence. Actual solution count/time/digests reported; catalog import is not complete merely because files were available.
