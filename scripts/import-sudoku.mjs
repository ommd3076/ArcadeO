/**
 * Sudoku Puzzle Bank Importer and Solver
 * Task S01: Qualifies and imports exactly 1,000 launch puzzles (250 per bucket)
 * Validates SHA-256 bank digests, solves each puzzle to prove exactly 1 solution,
 * extracts private solutions, and produces:
 * - content/sudoku/manifest.json
 * - content/sudoku/catalog.json (public metadata + givens only)
 * - content/sudoku/solutions.json (private server-only solutions)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const BUCKET_DEFINITIONS = [
  {
    bucket: 'easy',
    sourceFile: 'assets/sudoku-exchange-puzzle-bank-master/easy.txt',
    expectedHash: '789aab6f52cc4588e0c3aa4269ad3282cfda7e1cc79ea693d16507decde3fc50',
    expectedBytes: 10000000,
    targetCount: 250,
  },
  {
    bucket: 'medium',
    sourceFile: 'assets/sudoku-exchange-puzzle-bank-master/medium.txt',
    expectedHash: 'c2a5f8fac99dcf215b25d46ece47f346375e51730b182de70a6f8f2107b2b38d',
    expectedBytes: 35264300,
    targetCount: 250,
  },
  {
    bucket: 'hard',
    sourceFile: 'assets/sudoku-exchange-puzzle-bank-master/hard.txt',
    expectedHash: 'abcff1512411e601abd5e861c60add5be5d877739b6faa249ee86960f5ad85e9',
    expectedBytes: 32159200,
    targetCount: 250,
  },
  {
    bucket: 'expert',
    sourceFile: 'assets/sudoku-exchange-puzzle-bank-master/diabolical.txt',
    expectedHash: '08553d0c1145ea4d7c13008040f47ea8205d21fe1eaf8f4ab17a1a6981928b35',
    expectedBytes: 11968100,
    targetCount: 250,
  },
];

/**
 * Exact bitmask Sudoku solver with MRV heuristic.
 * Counts solutions up to maxCount (default 2) to guarantee uniqueness,
 * and extracts the first valid 81-char solution string.
 */
export function solveAndCount(boardStr, maxCount = 2) {
  if (typeof boardStr !== 'string' || boardStr.length !== 81) {
    return { count: 0, solution: null };
  }

  const grid = new Int32Array(81);
  const rows = new Int32Array(9);
  const cols = new Int32Array(9);
  const boxes = new Int32Array(9);

  for (let i = 0; i < 81; i++) {
    const ch = boardStr.charCodeAt(i) - 48;
    if (ch >= 1 && ch <= 9) {
      grid[i] = ch;
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const bit = 1 << ch;
      if ((rows[r] & bit) || (cols[c] & bit) || (boxes[b] & bit)) {
        return { count: 0, solution: null };
      }
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
    } else if (ch !== 0) {
      return { count: 0, solution: null };
    }
  }

  let solutions = 0;
  let firstSolution = null;

  function solve() {
    if (solutions >= maxCount) return;

    let bestCell = -1;
    let minCandidates = 10;
    let bestMask = 0;

    for (let i = 0; i < 81; i++) {
      if (grid[i] === 0) {
        const r = Math.floor(i / 9);
        const c = i % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const used = rows[r] | cols[c] | boxes[b];
        const mask = (~used) & 0x3fe;
        let count = 0;
        let temp = mask;
        while (temp > 0) {
          count++;
          temp &= temp - 1;
        }

        if (count === 0) return;
        if (count < minCandidates) {
          minCandidates = count;
          bestCell = i;
          bestMask = mask;
          if (count === 1) break;
        }
      }
    }

    if (bestCell === -1) {
      solutions++;
      if (solutions === 1) {
        firstSolution = Array.from(grid).join('');
      }
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
  return { count: solutions, solution: firstSolution };
}

export function importSudokuPuzzles(options = {}) {
  const rootDir = options.rootDir || process.cwd();
  const outputDir = path.resolve(rootDir, 'content/sudoku');
  fs.mkdirSync(outputDir, { recursive: true });

  const manifest = {
    catalogVersion: 1,
    generatedAt: new Date().toISOString(),
    totalPuzzles: 1000,
    buckets: {},
  };

  const catalog = [];
  const solutions = {};
  const seenPuzzleIds = new Set();
  const seenGivens = new Set();

  console.log('Starting Sudoku catalog import and validation...');

  for (const def of BUCKET_DEFINITIONS) {
    const fullPath = path.resolve(rootDir, def.sourceFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Source file missing: ' + fullPath);
    }

    const buffer = fs.readFileSync(fullPath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    if (sha256 !== def.expectedHash) {
      throw new Error(
        'SHA-256 mismatch for ' + def.bucket + ': expected ' + def.expectedHash + ' but got ' + sha256
      );
    }
    if (buffer.length !== def.expectedBytes) {
      throw new Error(
        'Byte count mismatch for ' + def.bucket + ': expected ' + def.expectedBytes + ' but got ' + buffer.length
      );
    }

    const contentStr = buffer.toString('utf-8');
    const lines = contentStr.trim().split('\n').filter(Boolean);

    console.log(
      'Processing bucket [' + def.bucket + ']: ' + lines.length + ' source puzzles, verified digest ' + sha256.substring(0, 16) + '...'
    );

    const step = Math.floor(lines.length / def.targetCount);
    let bucketMinRating = Infinity;
    let bucketMaxRating = -Infinity;

    for (let i = 0; i < def.targetCount; i++) {
      const line = lines[i * step].trim();
      const parts = line.split(/\s+/);
      const [sourceId, givens, ratingRaw] = parts;
      const number = i + 1;
      const puzzleId = def.bucket + '-' + String(number).padStart(3, '0');
      const rating = parseFloat(parseFloat(ratingRaw).toFixed(1));

      if (!givens || givens.length !== 81 || !/^[0-9]{81}$/.test(givens)) {
        throw new Error('Invalid givens format for puzzle ' + puzzleId + ': ' + givens);
      }

      if (seenPuzzleIds.has(puzzleId)) {
        throw new Error('Duplicate puzzleId: ' + puzzleId);
      }
      seenPuzzleIds.add(puzzleId);

      if (seenGivens.has(givens)) {
        throw new Error('Duplicate puzzle givens: ' + givens);
      }
      seenGivens.add(givens);

      const solveResult = solveAndCount(givens, 2);
      if (solveResult.count !== 1) {
        throw new Error(
          'Puzzle ' + puzzleId + ' (source: ' + sourceId + ') does not have a unique solution! Found: ' + solveResult.count
        );
      }
      if (!solveResult.solution || solveResult.solution.length !== 81) {
        throw new Error('Failed to derive 81-char solution for ' + puzzleId);
      }

      if (rating < bucketMinRating) bucketMinRating = rating;
      if (rating > bucketMaxRating) bucketMaxRating = rating;

      catalog.push({
        puzzleId,
        bucket: def.bucket,
        number,
        rating,
        givens,
        sourceId,
      });

      solutions[puzzleId] = solveResult.solution;
    }

    manifest.buckets[def.bucket] = {
      sourceFile: def.sourceFile,
      sourceSha256: sha256,
      sourceBytes: buffer.length,
      totalSourcePuzzles: lines.length,
      importedCount: def.targetCount,
      ratingRange: [bucketMinRating, bucketMaxRating],
      numberRange: [1, def.targetCount],
      validationOutcome: 'EXACTLY_ONE_SOLUTION_VERIFIED',
    };
  }

  const manifestPath = path.resolve(outputDir, 'manifest.json');
  const catalogPath = path.resolve(outputDir, 'catalog.json');
  const solutionsPath = path.resolve(outputDir, 'solutions.json');

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2) + '\n');
  fs.writeFileSync(solutionsPath, JSON.stringify(solutions, null, 2) + '\n');

  console.log('Successfully generated:');
  console.log(' - ' + manifestPath);
  console.log(' - ' + catalogPath + ' (' + catalog.length + ' puzzles)');
  console.log(' - ' + solutionsPath + ' (' + Object.keys(solutions).length + ' solutions)');

  return { manifest, catalog, solutions };
}

if (process.argv[1] && process.argv[1].endsWith('import-sudoku.mjs')) {
  importSudokuPuzzles();
}
