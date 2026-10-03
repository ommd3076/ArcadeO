/**
 * ArcadeO V1 — Worker Sudoku Verification
 *
 * Server-only verification using content/sudoku/solutions.json.
 * Solutions are NEVER delivered to client bundles.
 */

import solutionsData from "../../content/sudoku/solutions.json";

const solutionsMap: Record<string, string> = solutionsData as Record<string, string>;

/**
 * Returns the private 81-character solution for a puzzleId.
 * Server-internal only.
 */
export function getPrivateSolution(puzzleId: string): string | undefined {
  return solutionsMap[puzzleId];
}

/**
 * Verifies if an 81-digit string or number array matches the puzzle's solution.
 */
export function verifySudokuSolution(puzzleId: string, candidate: number[] | string): boolean {
  const solution = solutionsMap[puzzleId];
  if (!solution || solution.length !== 81) return false;

  if (typeof candidate === "string") {
    return candidate === solution;
  }

  if (!Array.isArray(candidate) || candidate.length !== 81) return false;

  for (let i = 0; i < 81; i++) {
    if (candidate[i] !== parseInt(solution[i], 10)) {
      return false;
    }
  }

  return true;
}
