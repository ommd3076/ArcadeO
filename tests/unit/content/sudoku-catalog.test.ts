import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Sudoku Catalog and Solutions (Task S01)", () => {
  const rootDir = process.cwd();
  const manifestPath = path.resolve(rootDir, "content/sudoku/manifest.json");
  const catalogPath = path.resolve(rootDir, "content/sudoku/catalog.json");
  const solutionsPath = path.resolve(rootDir, "content/sudoku/solutions.json");

  it("generates all expected files in content/sudoku/", () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(fs.existsSync(catalogPath)).toBe(true);
    expect(fs.existsSync(solutionsPath)).toBe(true);
  });

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  const solutions = JSON.parse(fs.readFileSync(solutionsPath, "utf-8"));

  it("manifest records accurate metadata, SHA-256 hashes, and 1,000 count", () => {
    expect(manifest.catalogVersion).toBe(1);
    expect(manifest.totalPuzzles).toBe(1000);
    expect(Object.keys(manifest.buckets)).toEqual(["easy", "medium", "hard", "expert"]);

    const expectedHashes: Record<string, string> = {
      easy: "789aab6f52cc4588e0c3aa4269ad3282cfda7e1cc79ea693d16507decde3fc50",
      medium: "c2a5f8fac99dcf215b25d46ece47f346375e51730b182de70a6f8f2107b2b38d",
      hard: "abcff1512411e601abd5e861c60add5be5d877739b6faa249ee86960f5ad85e9",
      expert: "08553d0c1145ea4d7c13008040f47ea8205d21fe1eaf8f4ab17a1a6981928b35",
    };

    for (const [bucket, meta] of Object.entries<any>(manifest.buckets)) {
      expect(meta.importedCount).toBe(250);
      expect(meta.sourceSha256).toBe(expectedHashes[bucket]);
      expect(meta.validationOutcome).toBe("EXACTLY_ONE_SOLUTION_VERIFIED");
      expect(meta.numberRange).toEqual([1, 250]);
    }
  });

  it("catalog has exactly 1,000 puzzles, 250 per bucket", () => {
    expect(catalog).toHaveLength(1000);

    const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0, expert: 0 };
    for (const p of catalog) {
      counts[p.bucket] = (counts[p.bucket] || 0) + 1;
    }

    expect(counts).toEqual({
      easy: 250,
      medium: 250,
      hard: 250,
      expert: 250,
    });
  });

  it("puzzle numbers are strictly 1..250 in each bucket", () => {
    for (const bucket of ["easy", "medium", "hard", "expert"]) {
      const bucketPuzzles = catalog.filter((p: any) => p.bucket === bucket);
      expect(bucketPuzzles).toHaveLength(250);
      const numbers = bucketPuzzles.map((p: any) => p.number);
      const expectedNumbers = Array.from({ length: 250 }, (_, i) => i + 1);
      expect(numbers).toEqual(expectedNumbers);
    }
  });

  it("all givens have exactly 81 characters containing digits 0..9 and unique across catalog", () => {
    const seenGivens = new Set<string>();
    const seenPuzzleIds = new Set<string>();

    for (const p of catalog) {
      expect(typeof p.givens).toBe("string");
      expect(p.givens).toHaveLength(81);
      expect(/^[0-9]{81}$/.test(p.givens)).toBe(true);

      expect(seenGivens.has(p.givens)).toBe(false);
      seenGivens.add(p.givens);

      expect(seenPuzzleIds.has(p.puzzleId)).toBe(false);
      seenPuzzleIds.add(p.puzzleId);

      expect(p.puzzleId).toBe(p.bucket + "-" + String(p.number).padStart(3, "0"));
    }

    expect(seenGivens.size).toBe(1000);
    expect(seenPuzzleIds.size).toBe(1000);
  });

  it("catalog NEVER exposes private solutions or solution properties", () => {
    for (const p of catalog) {
      expect(p).not.toHaveProperty("solution");
      expect(p).not.toHaveProperty("solutions");
      expect(p).not.toHaveProperty("answer");
    }
  });

  it("solutions.json contains solutions for all 1,000 puzzles matching catalog", () => {
    const solutionKeys = Object.keys(solutions);
    expect(solutionKeys).toHaveLength(1000);

    for (const p of catalog) {
      const sol = solutions[p.puzzleId];
      expect(sol).toBeDefined();
      expect(typeof sol).toBe("string");
      expect(sol).toHaveLength(81);
      expect(/^[1-9]{81}$/.test(sol)).toBe(true);
    }
  });

  it("every solution satisfies the givens and all 9 rows, 9 columns, and 9 boxes", () => {
    for (const p of catalog) {
      const givens = p.givens;
      const sol = solutions[p.puzzleId];

      const rowMasks = new Int32Array(9);
      const colMasks = new Int32Array(9);
      const boxMasks = new Int32Array(9);

      for (let i = 0; i < 81; i++) {
        const givenChar = givens[i];
        const solChar = sol[i];
        const digit = solChar.charCodeAt(0) - 48;

        if (givenChar !== "0") {
          expect(solChar).toBe(givenChar);
        }

        const r = Math.floor(i / 9);
        const c = i % 9;
        const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
        const bit = 1 << digit;

        expect((rowMasks[r] & bit) === 0).toBe(true);
        expect((colMasks[c] & bit) === 0).toBe(true);
        expect((boxMasks[b] & bit) === 0).toBe(true);

        rowMasks[r] |= bit;
        colMasks[c] |= bit;
        boxMasks[b] |= bit;
      }

      const fullMask = 0x3fe;
      for (let idx = 0; idx < 9; idx++) {
        expect(rowMasks[idx]).toBe(fullMask);
        expect(colMasks[idx]).toBe(fullMask);
        expect(boxMasks[idx]).toBe(fullMask);
      }
    }
  }, 15000);
});
