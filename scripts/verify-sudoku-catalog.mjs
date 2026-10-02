/**
 * Sudoku Catalog Verification Script
 * Validates the four difficulty buckets (easy, medium, hard, diabolical -> expert)
 * Ensures every puzzle has valid format, valid clues, and exactly 1 unique solution.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BUCKET_FILES = {
  easy: "assets/sudoku-exchange-puzzle-bank-master/easy.txt",
  medium: "assets/sudoku-exchange-puzzle-bank-master/medium.txt",
  hard: "assets/sudoku-exchange-puzzle-bank-master/hard.txt",
  expert: "assets/sudoku-exchange-puzzle-bank-master/diabolical.txt",
};

// Fast Bitmask-based Sudoku Solver that counts solutions up to maxCount
function countSolutions(boardStr, maxCount = 2) {
  const grid = new Int32Array(81);
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);

  for (let i = 0; i < 81; i++) {
    const ch = boardStr.charCodeAt(i) - 48; // '0' is 48
    if (ch >= 1 && ch <= 9) {
      grid[i] = ch;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const bit = 1 << ch;
      if (rows[r] & bit || cols[c] & bit || boxes[b] & bit) {
        return 0; // Contradiction in given clues
      }
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    }
  }

  let solutions = 0;

  function solve() {
    if (solutions >= maxCount) return;

    // Find cell with fewest candidates (MRV heuristic)
    let bestCell = -1;
    let minCandidates = 10;
    let bestMask = 0;

    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const used = rows[r] | cols[c] | boxes[b];
        const mask = ~used & 0x3fe; // Bits 1..9
        // Count set bits
        let count = 0;
        let temp = mask;
        while (temp > 0) {
          count++;
          temp &= temp - 1;
        }

        if (count === 0) return; // Dead end
        if (count < minCandidates) {
          minCandidates = count;
          bestCell = i;
          bestMask = mask;
          if (count === 1) break;
        }
      }
    }

    if (bestCell === -1) {
      // Solved!
      solutions++;
      return;
    }

    const r = Math.floor(bestCell / 9);
    const c = bestCell % 9;
    const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);

    for (let num = 1; num <= 9; num++) {
      const bit = 1 << num;
      if (bestMask & bit) {
        grid[bestCell] = num;
        rows[r] |= bit;
        cols[c] |= bit;
        boxes[b] |= bit;

        solve();

        grid[bestCell] = 0;
        rows[r] &= ~bit;
        cols[c] &= ~bit;
        boxes[b] &= ~bit;

        if (solutions >= maxCount) return;
      }
    }
  }

  solve();
  return solutions;
}

// Independently verifies the SHIPPED catalog, rather than a sample from the source bank.
export function verifyCatalogSample() {
  const catalog = JSON.parse(fs.readFileSync("content/sudoku/catalog.json", "utf8"));
  const solutions = JSON.parse(fs.readFileSync("content/sudoku/solutions.json", "utf8"));
  const manifest = JSON.parse(fs.readFileSync("content/sudoku/manifest.json", "utf8"));
  if (
    catalog.length !== 1000 ||
    Object.keys(solutions).length !== 1000 ||
    manifest.totalPuzzles !== 1000
  )
    throw new Error("Expected 1000 shipped puzzles and solutions");
  const ids = new Set(),
    boards = new Set();
  const evidence = {};
  for (const [bucket, filePath] of Object.entries(BUCKET_FILES)) {
    const bytes = fs.readFileSync(filePath);
    const hash = crypto.createHash("sha256").update(bytes).digest("hex");
    const meta = manifest.buckets[bucket];
    if (hash !== meta.sourceSha256 || bytes.length !== meta.sourceBytes)
      throw new Error("Source provenance mismatch: " + bucket);
    const source = new Map(
      bytes
        .toString("utf8")
        .trim()
        .split(/\r?\n/)
        .map((line) => {
          const [id, givens, rating] = line.trim().split(/\s+/);
          return [id, { givens, rating: Number(rating) }];
        }),
    );
    const puzzles = catalog.filter((p) => p.bucket === bucket);
    if (puzzles.length !== 250) throw new Error("Expected 250 puzzles: " + bucket);
    for (let i = 0; i < puzzles.length; i++) {
      const p = puzzles[i];
      if (p.number !== i + 1 || p.puzzleId !== bucket + "-" + String(i + 1).padStart(3, "0"))
        throw new Error("Stable identity mismatch");
      if (ids.has(p.puzzleId) || boards.has(p.givens) || !/^[0-9]{81}$/.test(p.givens))
        throw new Error("Duplicate or malformed puzzle");
      ids.add(p.puzzleId);
      boards.add(p.givens);
      const origin = source.get(p.sourceId);
      if (!origin || origin.givens !== p.givens || origin.rating !== p.rating)
        throw new Error("Source puzzle mismatch: " + p.puzzleId);
      if (countSolutions(p.givens, 2) !== 1)
        throw new Error("Not uniquely solvable: " + p.puzzleId);
      const solution = solutions[p.puzzleId];
      if (
        !/^[1-9]{81}$/.test(solution) ||
        countSolutions(solution, 2) !== 1 ||
        [...p.givens].some((g, j) => g !== "0" && g !== solution[j])
      )
        throw new Error("Private solution mismatch: " + p.puzzleId);
    }
    evidence[bucket] = {
      verified: puzzles.length,
      sourceSha256: hash,
      ratingRange: [
        Math.min(...puzzles.map((p) => p.rating)),
        Math.max(...puzzles.map((p) => p.rating)),
      ],
    };
  }
  console.log(
    JSON.stringify(
      { catalogVersion: manifest.catalogVersion, verified: ids.size, evidence },
      null,
      2,
    ),
  );
  return evidence;
}
if (process.argv[1]?.endsWith("verify-sudoku-catalog.mjs")) verifyCatalogSample();
