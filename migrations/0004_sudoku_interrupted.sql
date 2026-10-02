-- Additive eligibility metadata; accepted history and completion rows stay intact.
ALTER TABLE results ADD COLUMN interrupted INTEGER NOT NULL DEFAULT 0 CHECK (interrupted IN (0, 1));
ALTER TABLE sudoku_records ADD COLUMN interrupted INTEGER NOT NULL DEFAULT 0 CHECK (interrupted IN (0, 1));

-- Only backfill explicitly recorded interruption, never infer it from elapsed time.
UPDATE results SET interrupted = 1
WHERE gameId = 'sudoku' AND mode = 'duel'
  AND json_valid(details)
  AND json_extract(details, '$.interrupted') = 1;

UPDATE sudoku_records SET interrupted = 1
WHERE mode = 'duel' AND resultMatchId IN (
  SELECT matchId FROM results WHERE gameId = 'sudoku' AND mode = 'duel' AND interrupted = 1
);
