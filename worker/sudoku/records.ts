/**
 * ArcadeO V1 — Worker Sudoku Records Projection Helper
 *
 * Implements projections from terminal DO outcomes to D1 `sudoku_records` table.
 * Source is server-authoritative DO snapshot, NOT client-submitted scores.
 */

import { AccountId, SudokuPlayMode } from "../../shared/protocol/types";

export interface SudokuRecordRow {
  attemptId: string;
  accountId: AccountId;
  puzzleId: string;
  mode: SudokuPlayMode;
  elapsedMs: number;
  assisted: number; // 0 or 1
  replay: number; // 0 or 1
  interrupted: number; // 0 or 1; Duel eligibility only
  completedAt: number; // UTC ms
  resultMatchId: string | null;
}

export interface SudokuRecordParams {
  attemptId: string;
  accountId: AccountId;
  puzzleId: string;
  mode: SudokuPlayMode;
  elapsedMs: number;
  assisted: boolean;
  replay: boolean;
  interrupted?: boolean;
  completedAt: number;
  resultMatchId?: string;
}

/**
 * Projects a completed Sudoku attempt into D1 `sudoku_records`.
 * Completion facts are immutable; later projections may only add assistance/replay flags.
 */
export async function projectSudokuRecord(
  d1: D1Database,
  params: SudokuRecordParams,
): Promise<void> {
  const assistedInt = params.assisted ? 1 : 0;
  const replayInt = params.replay ? 1 : 0;
  const interruptedInt = params.interrupted ? 1 : 0;
  const resultMatchId = params.resultMatchId || null;

  await d1
    .prepare(
      `INSERT INTO sudoku_records (
        attemptId,
        accountId,
        puzzleId,
        mode,
        elapsedMs,
        assisted,
        replay,
        interrupted,
        completedAt,
        resultMatchId
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(attemptId, accountId) DO UPDATE SET
        assisted = MAX(sudoku_records.assisted, excluded.assisted),
        replay = MAX(sudoku_records.replay, excluded.replay),
        interrupted = MAX(sudoku_records.interrupted, excluded.interrupted),
        resultMatchId = COALESCE(sudoku_records.resultMatchId, excluded.resultMatchId)`,
    )
    .bind(
      params.attemptId,
      params.accountId,
      params.puzzleId,
      params.mode,
      params.elapsedMs,
      assistedInt,
      replayInt,
      interruptedInt,
      params.completedAt,
      resultMatchId,
    )
    .run();
}

/**
 * Queries completed puzzle IDs for an account in a specific difficulty bucket or all.
 */
export async function getCompletedPuzzleIds(
  d1: D1Database,
  accountId: AccountId,
): Promise<Set<string>> {
  const result = await d1
    .prepare(`SELECT DISTINCT puzzleId FROM sudoku_records WHERE accountId = ?`)
    .bind(accountId)
    .all<{ puzzleId: string }>();

  const set = new Set<string>();
  if (result.results) {
    for (const r of result.results) {
      set.add(r.puzzleId);
    }
  }
  return set;
}

/**
 * Queries best unassisted time for an account on a specific puzzle.
 */
export async function getBestUnassistedTime(
  d1: D1Database,
  accountId: AccountId,
  puzzleId: string,
): Promise<number | null> {
  const row = await d1
    .prepare(
      `SELECT MIN(elapsedMs) as bestMs FROM sudoku_records 
       WHERE accountId = ? AND puzzleId = ? AND assisted = 0 AND replay = 0 AND interrupted = 0`,
    )
    .bind(accountId, puzzleId)
    .first<{ bestMs: number | null }>();

  return row?.bestMs ?? null;
}
