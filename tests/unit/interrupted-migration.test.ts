import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

describe("additive interruption migration compatibility", () => {
  it("backfills only explicit Duel metadata and retains malformed, unknown and other history", () => {
    const db = new DatabaseSync(":memory:");
    try {
      db.exec(`
        CREATE TABLE results(matchId TEXT PRIMARY KEY, gameId TEXT, mode TEXT, details TEXT);
        CREATE TABLE sudoku_records(attemptId TEXT PRIMARY KEY, mode TEXT, resultMatchId TEXT);
      `);
      const fixtures = [
        ["known", "sudoku", "duel", '{"interrupted":true}'],
        ["unknown", "sudoku", "duel", "{}"],
        ["malformed", "sudoku", "duel", "invalid"],
        ["practice", "sudoku", "practice", '{"interrupted":true}'],
        ["other", "ludo", "remote", '{"interrupted":true}'],
      ];
      for (const [id, game, mode, details] of fixtures) {
        db.prepare("INSERT INTO results VALUES(?,?,?,?)").run(id, game, mode, details);
        db.prepare("INSERT INTO sudoku_records VALUES(?,?,?)").run(id, mode, id);
      }
      db.exec(readFileSync("migrations/0004_sudoku_interrupted.sql", "utf8"));
      expect(db.prepare("SELECT matchId FROM results WHERE interrupted=1").all()).toEqual([
        { matchId: "known" },
      ]);
      expect(db.prepare("SELECT attemptId FROM sudoku_records WHERE interrupted=1").all()).toEqual([
        { attemptId: "known" },
      ]);
      expect(db.prepare("SELECT COUNT(*) AS count FROM results").get()?.count).toBe(5);
      expect(db.prepare("SELECT COUNT(*) AS count FROM sudoku_records").get()?.count).toBe(5);
      expect(() => db.prepare("UPDATE results SET interrupted=2").run()).toThrow();
    } finally {
      db.close();
    }
  });
});
