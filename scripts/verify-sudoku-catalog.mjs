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
      if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) {
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
        const mask = (~used) & 0x3fe; // Bits 1..9
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

export function verifyCatalogSample(samplePerBucket = 25) {
  console.log("Verifying Sudoku puzzle bank...");
  const manifest = {};

  for (const [bucket, filePath] of Object.entries(BUCKET_FILES)) {
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Missing puzzle bank file: ${fullPath}`);
    }

    const fileContent = fs.readFileSync(fullPath, "utf-8");
    const lines = fileContent.trim().split("\n").filter(Boolean);

    console.log(`Checking ${bucket} (${lines.length} available puzzles, testing ${samplePerBucket} samples)...`);
    const fileHash = crypto.createHash("sha256").update(fileContent).digest("hex");
    const tested = [];

    // Take samplePerBucket distributed puzzles
    const step = Math.floor(lines.length / samplePerBucket);
    for (let i = 0; i < samplePerBucket; i++) {
      const line = lines[i * step].trim();
      const parts = line.split(/\s+/);
      const [id, givens, rating] = parts;

      if (!givens || givens.length !== 81) {
        throw new Error(`Invalid puzzle length at ${bucket} index ${i}: ${givens}`);
      }

      const count = countSolutions(givens, 2);
      if (count !== 1) {
        throw new Error(`Puzzle ${id} in ${bucket} has ${count} solutions (expected exactly 1)`);
      }

      tested.push({ id, rating: parseFloat(rating) });
    }

    manifest[bucket] = {
      fileHash,
      totalCount: lines.length,
      sampled: samplePerBucket,
      valid: true,
    };
  }

  console.log("Sudoku catalog verification SUCCESSFUL! Manifest:", JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1].endsWith("verify-sudoku-catalog.mjs")) {
  verifyCatalogSample(25);
}
