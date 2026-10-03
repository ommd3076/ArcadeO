/**
 * ArcadeO V1 — Worker Sudoku Catalog Queries
 *
 * Exposes safe public catalog querying from content/sudoku/catalog.json.
 * Solutions are strictly excluded.
 */

import catalogData from "../../content/sudoku/catalog.json";

export type SudokuDifficulty = "easy" | "medium" | "hard" | "expert";

export interface CatalogPuzzleEntry {
  puzzleId: string;
  bucket: SudokuDifficulty;
  number: number;
  rating: number;
  givens: string;
  sourceId: string;
}

const catalog: CatalogPuzzleEntry[] = catalogData as CatalogPuzzleEntry[];
const catalogById = new Map<string, CatalogPuzzleEntry>();
const catalogByBucket = new Map<SudokuDifficulty, CatalogPuzzleEntry[]>();

for (const p of catalog) {
  catalogById.set(p.puzzleId, p);
  const list = catalogByBucket.get(p.bucket) || [];
  list.push(p);
  catalogByBucket.set(p.bucket, list);
}

/**
 * Returns a puzzle by stable puzzleId.
 */
export function getPuzzleById(puzzleId: string): CatalogPuzzleEntry | undefined {
  return catalogById.get(puzzleId);
}

/**
 * Lists all puzzles in a given difficulty bucket (sorted by number 1..250).
 */
export function listPuzzlesByBucket(bucket: SudokuDifficulty): CatalogPuzzleEntry[] {
  return catalogByBucket.get(bucket) || [];
}

/**
 * Selects an eligible puzzle for a duel or challenge.
 * Attempts to find a puzzle in the bucket not in the completedPuzzleIds list.
 * If exhausted, returns a puzzle and marks isReplay = true.
 */
export function selectEligiblePuzzle(
  bucket: SudokuDifficulty,
  completedPuzzleIds: Set<string>,
): { puzzle: CatalogPuzzleEntry; isReplay: boolean } {
  const puzzles = listPuzzlesByBucket(bucket);
  if (puzzles.length === 0) {
    throw new Error(`No puzzles available in bucket: ${bucket}`);
  }

  // Find first or random uncompleted puzzle
  const uncompleted = puzzles.filter((p) => !completedPuzzleIds.has(p.puzzleId));
  if (uncompleted.length > 0) {
    // Select first or deterministic uncompleted
    return { puzzle: uncompleted[0], isReplay: false };
  }

  // Exhausted bucket: replay first puzzle
  return { puzzle: puzzles[0], isReplay: true };
}

/**
 * Returns total puzzle count in the catalog.
 */
export function getCatalogCount(): number {
  return catalog.length;
}
