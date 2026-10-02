import { describe, expect, it } from "vitest";
import {
  createInitialState,
  validateAndReduce,
  toPublicView,
  activateDuel,
  acceptChallenge,
  calculateElapsedMs,
} from "../../../../shared/games/sudoku/engine";
import catalog from "../../../../content/sudoku/catalog.json";
import solutions from "../../../../content/sudoku/solutions.json";
import { handleCatalogRequest } from "../../../../worker/api/catalog";
import { SudokuState } from "../../../../shared/games/sudoku/types";
const puzzle = catalog[0];
const config = { ...puzzle, solution: (solutions as Record<string, string>)[puzzle.puzzleId] };
const empty = puzzle.givens.indexOf("0");
const payload = {
  row: Math.floor(empty / 9),
  col: empty % 9,
  operation: "set" as const,
  value: Number(config.solution[empty]),
};
const create = (mode = "practice") =>
  createInitialState({ serverTime: 1000, startingSeat: "A", config: { ...config, mode } });
const viewer = (seat: "A" | "B", time: number) => ({
  viewerAccountId: seat,
  viewerSeat: seat,
  mode: "duel" as const,
  isController: true,
  serverTime: time,
});
describe("Sudoku review regressions", () => {
  it("requires server catalog facts rather than silently creating an unsolvable blank board", () => {
    expect(() => createInitialState({ serverTime: 1000, startingSeat: "A" })).toThrow(
      /verified catalog/,
    );
  });
  it("practice pause masks the saved board and resuming preserves it", () => {
    const state = create();
    const paused = validateAndReduce(
      state,
      { action: "sudoku.pause", payload: {} },
      { actorSeat: "A", serverTime: 2000 },
    );
    expect(paused.success).toBe(true);
    if (!paused.success) return;
    const view = toPublicView(paused.newState, viewer("A", 9000));
    expect(view.givens).toBe("0".repeat(81));
    expect(view.self.cells).toBeUndefined();
    expect(view.self.notes).toBeUndefined();
    expect(view.self.elapsedMs).toBe(1000);
    const resumed = validateAndReduce(
      paused.newState,
      { action: "sudoku.resume", payload: {} },
      { actorSeat: "A", serverTime: 10000 },
    );
    expect(resumed.success).toBe(true);
    if (resumed.success) expect(resumed.newState.players.A.cells).toEqual(state.players.A.cells);
  });
  it.each([
    { ...payload, row: -1, col: 9 },
    { ...payload, row: 0, col: 9 },
    { ...payload, row: 0.5 },
    { ...payload, value: 1.5 },
    { ...payload, value: NaN },
    { ...payload, row: NaN },
    null,
  ])("rejects malformed coordinate/digit independently of flattened index", (p) => {
    const state = create();
    const before = JSON.stringify(state);
    expect(
      validateAndReduce(
        state,
        { action: "sudoku.edit", payload: p as any },
        { actorSeat: "A", serverTime: 2000 },
      ).success,
    ).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("waits for both Ready and counts duel time from the common future start", () => {
    const state = create("duel");
    expect(toPublicView(state, viewer("A", 100000)).givens).toBe("0".repeat(81));
    expect(
      validateAndReduce(
        state,
        { action: "sudoku.edit", payload },
        { actorSeat: "A", serverTime: 100000 },
      ).success,
    ).toBe(false);
    const active = activateDuel(state, 100000);
    expect(active.scheduledStartTime).toBe(103000);
    expect(activateDuel(active, 200000)).toBe(active);
    expect(toPublicView(active, viewer("A", 102999)).self.cells).toBeUndefined();
    expect(calculateElapsedMs(active.players.A, 103100)).toBe(100);
    expect(calculateElapsedMs(active.players.B, 203000)).toBe(100000);
  });
  it("opposite edits advance independent revisions while private boards stay private", () => {
    let state = activateDuel(create("duel"), 1000);
    for (const seat of ["A", "B"] as const) {
      const r = validateAndReduce(
        state,
        { action: "sudoku.edit", payload },
        { actorSeat: seat, serverTime: 5000 },
      );
      expect(r.success).toBe(true);
      if (r.success) state = r.newState;
    }
    expect(state.players.A.progressRevision).toBe(2);
    expect(state.players.B.progressRevision).toBe(2);
    const view = toPublicView(state, viewer("B", 5000));
    expect(view.self.progressRevision).toBe(2);
    expect(view.opponent?.cells).toBeUndefined();
    expect(view.opponent?.notes).toBeUndefined();
    expect(view.opponent?.incorrectCells).toBeUndefined();
    expect(JSON.stringify(view)).not.toContain(config.solution);
  });
  it("challenge receiver gets neither board nor edit access before acceptance; waiting is excluded", () => {
    let state = create("challenge");
    state = { ...state, challengePublished: true, senderElapsedMs: 12000 };
    expect(toPublicView(state, viewer("B", 50000)).givens).toBe("0".repeat(81));
    expect(
      validateAndReduce(
        state,
        { action: "sudoku.edit", payload },
        { actorSeat: "B", serverTime: 50000 },
      ).success,
    ).toBe(false);
    state = acceptChallenge(state, "B", 60000, true);
    expect(toPublicView(state, viewer("A", 60123)).opponent).toBeUndefined();
    expect(calculateElapsedMs(state.players.B, 60123)).toBe(123);
    expect(state.replay).toBe(true);
    expect(acceptChallenge(state, "B", 100000, false)).toBe(state);
  });
  it("a replay completes as saved unscored terminal rather than awaiting impossible eligibility", () => {
    const state: SudokuState = { ...activateDuel(create("duel"), 1000), replay: true };
    state.players.A.cells = [...config.solution].map(Number);
    state.players.A.cells[empty] = 0;
    const r = validateAndReduce(
      state,
      { action: "sudoku.edit", payload },
      { actorSeat: "A", serverTime: 12000 },
    );
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.terminalResult?.details?.scored).toBe(false);
      expect(r.newState.terminalResult).toEqual(r.terminalResult);
    }
  });
  it("catalog exposes stable metadata only and validates pagination", async () => {
    const response = await handleCatalogRequest(
      new Request("https://arcade/api/v1/sudoku/catalog?bucket=easy&limit=250"),
    );
    const body = (await response!.json()) as any;
    expect(body.puzzles).toHaveLength(250);
    expect(body.puzzles[0].puzzleId).toBe("easy-001");
    expect(body.puzzles[0].givens).toBeUndefined();
    expect(body.puzzles[0].solution).toBeUndefined();
    for (const query of ["limit=-1", "limit=1.5", "offset=-1", "bucket=unknown"]) {
      expect(
        (await handleCatalogRequest(new Request("https://arcade/api/v1/sudoku/catalog?" + query)))!
          .status,
      ).toBe(400);
    }
  });
});
