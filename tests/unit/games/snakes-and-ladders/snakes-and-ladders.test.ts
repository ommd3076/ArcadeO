import { describe, it, expect } from "vitest";
import {
  LADDERS,
  SNAKES,
  SNAKES_AND_LADDERS_MAX_POSITION,
  SNAKES_AND_LADDERS_START_POSITION,
  SnakesAndLaddersState,
} from "../../../../shared/games/snakes-and-ladders/types";
import {
  createInitialState,
  getBoardCoordinate,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/snakes-and-ladders/engine";
import { snakesAndLaddersEngineAdapter } from "../../../../shared/games/snakes-and-ladders/adapter";
import { ErrorCode } from "../../../../shared/protocol/errors";

describe("Snakes & Ladders Engine", () => {
  describe("Initial State & Setup", () => {
    it("creates initial state with both players off-board (position 0)", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      expect(state.positions).toEqual({ A: 0, B: 0 });
      expect(state.activeSeat).toBe("A");
      expect(state.status).toBe("active");
      expect(state.winner).toBeNull();
      expect(state.lastRoll).toBeNull();
      expect(isTerminal(state)).toBeNull();
    });

    it("respects startingSeat fact", () => {
      const stateB = createInitialState({ serverTime: 1000, startingSeat: "B" });
      expect(stateB.activeSeat).toBe("B");
    });

    it("reports legalActions accurately depending on seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(legalActions(state, "A")).toEqual(["dice.roll"]);
      expect(legalActions(state, "B")).toEqual([]);
    });

    it("serializes to public view without loss", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const view = toPublicView(state);
      expect(view.positions).toEqual({ A: 0, B: 0 });
      expect(view.activeSeat).toBe("A");
      expect(view.status).toBe("active");
      expect(view.winner).toBeNull();
    });

    it("exports standard board constants", () => {
      expect(SNAKES_AND_LADDERS_MAX_POSITION).toBe(100);
      expect(SNAKES_AND_LADDERS_START_POSITION).toBe(0);
    });
  });

  describe("Movement & Turn Alternation", () => {
    it("advances token by rolled value and alternates turn", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // Player A rolls 4: 0 -> 4 (4 is neither snake nor ladder)
      const res1 = validateAndReduce(
        state0,
        { action: "dice.roll", payload: {} },
        { serverTime: 1010, actorSeat: "A", randomValues: [4] },
      );

      expect(res1.success).toBe(true);
      if (!res1.success) return;

      expect(res1.newState.positions.A).toBe(4);
      expect(res1.newState.positions.B).toBe(0);
      expect(res1.newState.activeSeat).toBe("B");
      expect(res1.newState.lastRoll).toBe(4);
      expect(res1.effects).toEqual([
        { type: "dice-rolled", seat: "A", roll: 4 },
        { type: "token-advanced", seat: "A", from: 0, to: 4 },
        { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
      ]);

      // Player B rolls 5: 0 -> 5
      const res2 = validateAndReduce(
        res1.newState,
        { action: "dice.roll", payload: {} },
        { serverTime: 1020, actorSeat: "B", randomValues: [5] },
      );

      expect(res2.success).toBe(true);
      if (!res2.success) return;

      expect(res2.newState.positions.A).toBe(4);
      expect(res2.newState.positions.B).toBe(5);
      expect(res2.newState.activeSeat).toBe("A");
      expect(res2.newState.lastRoll).toBe(5);
    });

    it("rolling a six grants NO bonus roll; turn transfers immediately", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      const res = validateAndReduce(
        state0,
        { action: "dice.roll", payload: {} },
        { serverTime: 1030, actorSeat: "A", randomValues: [6] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.positions.A).toBe(6);
      expect(res.newState.activeSeat).toBe("B"); // Turn transferred to B!
      expect(res.effects).toContainEqual({
        type: "turn-changed",
        previousSeat: "A",
        nextSeat: "B",
      });
    });

    it("permits shared occupancy without capturing", () => {
      const state: SnakesAndLaddersState = {
        positions: { A: 10, B: 6 },
        activeSeat: "B",
        status: "active",
        winner: null,
        lastRoll: null,
      };

      // Player B rolls 4: lands on 10 (same square as A)
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1040, actorSeat: "B", randomValues: [4] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.positions.A).toBe(10);
      expect(res.newState.positions.B).toBe(10);
      expect(res.newState.activeSeat).toBe("A");
    });
  });

  describe("All Ladders", () => {
    const expectedLadders: [number, number, number][] = [
      // [startPos, roll, expectedDest]
      [0, 2, 23], // 2 -> 23
      [4, 4, 34], // 8 -> 34
      [15, 5, 41], // 20 -> 41
      [31, 1, 51], // 32 -> 51
      [46, 3, 70], // 49 -> 70
      [58, 2, 83], // 60 -> 83
      [68, 5, 94], // 73 -> 94
    ];

    for (const [startPos, roll, expectedDest] of expectedLadders) {
      const ladderOrigin = startPos + roll;
      it(`climbs ladder from ${ladderOrigin} to ${expectedDest}`, () => {
        expect(LADDERS[ladderOrigin]).toBe(expectedDest);

        const state: SnakesAndLaddersState = {
          positions: { A: startPos, B: 0 },
          activeSeat: "A",
          status: "active",
          winner: null,
          lastRoll: null,
        };

        const res = validateAndReduce(
          state,
          { action: "dice.roll", payload: {} },
          { serverTime: 1100, actorSeat: "A", randomValues: [roll] },
        );

        expect(res.success).toBe(true);
        if (!res.success) return;

        expect(res.newState.positions.A).toBe(expectedDest);
        expect(res.newState.activeSeat).toBe("B");
        expect(res.effects).toEqual([
          { type: "dice-rolled", seat: "A", roll },
          { type: "token-advanced", seat: "A", from: startPos, to: ladderOrigin },
          { type: "ladder-climbed", seat: "A", from: ladderOrigin, to: expectedDest },
          { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
        ]);
      });
    }
  });

  describe("All Snakes", () => {
    const expectedSnakes: [number, number, number][] = [
      // [startPos, roll, expectedDest]
      [24, 3, 5], // 27 -> 5
      [35, 4, 16], // 39 -> 16
      [50, 6, 35], // 56 -> 35
      [66, 2, 46], // 68 -> 46
      [78, 1, 58], // 79 -> 58
      [83, 5, 66], // 88 -> 66
      [93, 4, 76], // 97 -> 76
    ];

    for (const [startPos, roll, expectedDest] of expectedSnakes) {
      const snakeOrigin = startPos + roll;
      it(`is bitten by snake from ${snakeOrigin} to ${expectedDest}`, () => {
        expect(SNAKES[snakeOrigin]).toBe(expectedDest);

        const state: SnakesAndLaddersState = {
          positions: { A: startPos, B: 0 },
          activeSeat: "A",
          status: "active",
          winner: null,
          lastRoll: null,
        };

        const res = validateAndReduce(
          state,
          { action: "dice.roll", payload: {} },
          { serverTime: 1200, actorSeat: "A", randomValues: [roll] },
        );

        expect(res.success).toBe(true);
        if (!res.success) return;

        expect(res.newState.positions.A).toBe(expectedDest);
        expect(res.newState.activeSeat).toBe("B");
        expect(res.effects).toEqual([
          { type: "dice-rolled", seat: "A", roll },
          { type: "token-advanced", seat: "A", from: startPos, to: snakeOrigin },
          { type: "snake-bitten", seat: "A", from: snakeOrigin, to: expectedDest },
          { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
        ]);
      });
    }
  });

  describe("Exact Win & Overshoot Hold", () => {
    it("reaches exact 100 to win the match immediately", () => {
      const state: SnakesAndLaddersState = {
        positions: { A: 96, B: 90 },
        activeSeat: "A",
        status: "active",
        winner: null,
        lastRoll: null,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1300, actorSeat: "A", randomValues: [4] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.positions.A).toBe(100);
      expect(res.newState.status).toBe("completed");
      expect(res.newState.winner).toBe("A");
      expect(res.terminalResult).toBeDefined();
      expect(res.terminalResult?.winner).toBe("A");
      expect(res.terminalResult?.reason).toBe("rules_win");
      expect(res.terminalResult?.scores).toEqual({ A: 1, B: 0 });
      expect(res.effects).toEqual([
        { type: "dice-rolled", seat: "A", roll: 4 },
        { type: "token-advanced", seat: "A", from: 96, to: 100 },
        { type: "game-won", winner: "A" },
      ]);
      expect(isTerminal(res.newState)).toEqual(res.terminalResult);
      expect(legalActions(res.newState, "A")).toEqual([]);
    });

    it("overshooting 100 stays in place and passes turn to opponent", () => {
      const state: SnakesAndLaddersState = {
        positions: { A: 98, B: 50 },
        activeSeat: "A",
        status: "active",
        winner: null,
        lastRoll: null,
      };

      // Roll 5: 98 + 5 = 103 > 100 (overshoot)
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1310, actorSeat: "A", randomValues: [5] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // Token holds in place at 98
      expect(res.newState.positions.A).toBe(98);
      // Turn passes to B
      expect(res.newState.activeSeat).toBe("B");
      expect(res.effects).toEqual([
        { type: "dice-rolled", seat: "A", roll: 5 },
        { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
      ]);
    });
  });

  describe("Validation & Errors", () => {
    it("rejects actions when match is completed", () => {
      const state: SnakesAndLaddersState = {
        positions: { A: 100, B: 50 },
        activeSeat: "A",
        status: "completed",
        winner: "A",
        lastRoll: 2,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1400, actorSeat: "A", randomValues: [1] },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.MATCH_FINISHED);
      }
    });

    it("rejects roll from inactive seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1410, actorSeat: "B", randomValues: [3] },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.NOT_YOUR_TURN);
      }
    });

    it("rejects wrong action type", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(state, { action: "ludo.move", payload: {} } as any, {
        serverTime: 1420,
        actorSeat: "A",
        randomValues: [3],
      });

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects missing randomValues fact", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1430, actorSeat: "A" },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });
  });

  describe("Board Geometry & Coordinate Mapping", () => {
    it("maps 1..100 to serpentine grid coordinates correctly", () => {
      expect(getBoardCoordinate(0)).toBeNull(); // off-board
      expect(getBoardCoordinate(101)).toBeNull(); // out of range

      // Bottom row (band 0, row 9): left to right (col 0..9)
      expect(getBoardCoordinate(1)).toEqual([9, 0]);
      expect(getBoardCoordinate(10)).toEqual([9, 9]);

      // Row above (band 1, row 8): right to left (col 9..0)
      expect(getBoardCoordinate(11)).toEqual([8, 9]);
      expect(getBoardCoordinate(20)).toEqual([8, 0]);

      // Top row (band 9, row 0): right to left
      expect(getBoardCoordinate(91)).toEqual([0, 9]);
      expect(getBoardCoordinate(100)).toEqual([0, 0]);
    });
  });

  describe("Adapter & Protocol Invariants", () => {
    it("conforms to GameEngineAdapter contract", () => {
      expect(snakesAndLaddersEngineAdapter.gameId).toBe("snakes-and-ladders");
      expect(typeof snakesAndLaddersEngineAdapter.createInitialState).toBe("function");
      expect(typeof snakesAndLaddersEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof snakesAndLaddersEngineAdapter.legalActions).toBe("function");
      expect(typeof snakesAndLaddersEngineAdapter.toPublicView).toBe("function");
      expect(typeof snakesAndLaddersEngineAdapter.isTerminal).toBe("function");
    });

    it("survives JSON round-trip without corruption", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(state);
    });
  });
});
