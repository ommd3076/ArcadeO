import { describe, it, expect } from "vitest";
import {
  LUDO_HOME_PROGRESS,
  LUDO_RING_SIZE,
  LUDO_SAFE_SQUARES,
  LUDO_SAFE_SQUARES_SET,
  LUDO_SHARED_TRACK_MAX,
  LUDO_START_SQUARES,
  LUDO_YARD_PROGRESS,
  LudoState,
} from "../../../../shared/games/ludo/types";
import {
  createInitialState,
  getBoardCoordinate,
  getLegalMovesForRoll,
  getRingIndex,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/ludo/engine";
import { ludoEngineAdapter } from "../../../../shared/games/ludo/adapter";
import { ErrorCode } from "../../../../shared/protocol/errors";

describe("Ludo Engine", () => {
  describe("Initial State & Setup", () => {
    it("creates initial state with 4 tokens in yard per seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      expect(state.tokens.A).toEqual([-1, -1, -1, -1]);
      expect(state.tokens.B).toEqual([-1, -1, -1, -1]);
      expect(state.activeSeat).toBe("A");
      expect(state.phase).toBe("roll");
      expect(state.consecutiveSixes).toBe(0);
      expect(state.pendingRoll).toBeNull();
      expect(state.legalTokenIds).toEqual([]);
      expect(state.status).toBe("active");
      expect(state.winner).toBeNull();
      expect(isTerminal(state)).toBeNull();
    });

    it("respects startingSeat fact", () => {
      const stateB = createInitialState({ serverTime: 1000, startingSeat: "B" });
      expect(stateB.activeSeat).toBe("B");
    });

    it("reports legalActions accurately depending on seat and phase", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(legalActions(state, "A")).toEqual(["dice.roll"]);
      expect(legalActions(state, "B")).toEqual([]);

      const chooseState: LudoState = {
        ...state,
        phase: "choose-token",
        pendingRoll: 6,
        legalTokenIds: [0, 1],
      };
      expect(legalActions(chooseState, "A")).toEqual(["ludo.move"]);
      expect(legalActions(chooseState, "B")).toEqual([]);
    });

    it("serializes to public view without loss", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const view = toPublicView(state);
      expect(view.tokens).toEqual(state.tokens);
      expect(view.activeSeat).toBe("A");
      expect(view.phase).toBe("roll");
      expect(view.consecutiveSixes).toBe(0);
      expect(view.status).toBe("active");
    });

    it("exports standard board constants and computes legal moves correctly", () => {
      expect(LUDO_HOME_PROGRESS).toBe(56);
      expect(LUDO_RING_SIZE).toBe(52);
      expect(LUDO_SHARED_TRACK_MAX).toBe(50);
      expect(LUDO_START_SQUARES).toEqual({ A: 0, B: 26 });
      expect(LUDO_YARD_PROGRESS).toBe(-1);

      expect(getLegalMovesForRoll([-1, -1, -1, -1], 6)).toEqual([0, 1, 2, 3]);
      expect(getLegalMovesForRoll([-1, -1, -1, -1], 4)).toEqual([]);
      expect(getLegalMovesForRoll([0, -1, -1, -1], 4)).toEqual([0]);
      expect(getLegalMovesForRoll([54, -1, -1, -1], 2)).toEqual([0]);
      expect(getLegalMovesForRoll([54, -1, -1, -1], 3)).toEqual([]);
    });
  });

  describe("Entry from Yard", () => {
    it("enters yard token onto start square (progress 0) with a roll of 6", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // All 4 tokens in yard -> roll 6 -> all 4 can enter -> multiple legal moves -> phase: choose-token
      const res = validateAndReduce(
        state0,
        { action: "dice.roll", payload: {} },
        { serverTime: 1010, actorSeat: "A", randomValues: [6] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.phase).toBe("choose-token");
      expect(res.newState.pendingRoll).toBe(6);
      expect(res.newState.legalTokenIds).toEqual([0, 1, 2, 3]);
      expect(res.newState.consecutiveSixes).toBe(1);

      // Now choose token 0
      const moveRes = validateAndReduce(
        res.newState,
        { action: "ludo.move", payload: { tokenId: 0 } },
        { serverTime: 1020, actorSeat: "A" },
      );

      expect(moveRes.success).toBe(true);
      if (!moveRes.success) return;

      expect(moveRes.newState.tokens.A[0]).toBe(0);
      expect(moveRes.newState.tokens.A[1]).toBe(-1);
      // Rolling 6 grants a bonus roll -> activeSeat remains A, phase returns to "roll"
      expect(moveRes.newState.activeSeat).toBe("A");
      expect(moveRes.newState.phase).toBe("roll");
      expect(moveRes.newState.consecutiveSixes).toBe(1);
      expect(moveRes.effects).toContainEqual({
        type: "token-moved",
        seat: "A",
        tokenId: 0,
        from: -1,
        to: 0,
      });
    });

    it("passes turn when rolling non-six with all tokens in yard", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "dice.roll", payload: {} },
        { serverTime: 1010, actorSeat: "A", randomValues: [4] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // No legal moves and not a 6 -> turn passes to B
      expect(res.newState.activeSeat).toBe("B");
      expect(res.newState.phase).toBe("roll");
      expect(res.newState.consecutiveSixes).toBe(0);
      expect(res.effects).toContainEqual({
        type: "turn-changed",
        previousSeat: "A",
        nextSeat: "B",
      });
    });
  });

  describe("Movement & Auto-Selection", () => {
    it("auto-selects the only legal move when exactly 1 token can move", () => {
      const state: LudoState = {
        tokens: {
          A: [10, -1, -1, -1], // Only token 0 is active
          B: [-1, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      // Roll 3 -> only token 0 can move (tokens 1..3 in yard need a 6)
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1050, actorSeat: "A", randomValues: [3] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // Auto-selected token 0!
      expect(res.newState.tokens.A[0]).toBe(13);
      // 3 is a non-six, no capture, not home -> turn passes to B
      expect(res.newState.activeSeat).toBe("B");
      expect(res.newState.phase).toBe("roll");
      expect(res.effects).toEqual([
        { type: "dice-rolled", seat: "A", roll: 3 },
        { type: "token-moved", seat: "A", tokenId: 0, from: 10, to: 13 },
        { type: "turn-changed", previousSeat: "A", nextSeat: "B" },
      ]);
    });

    it("rejects moves that would overshoot 56 (exact finish required)", () => {
      const state: LudoState = {
        tokens: {
          A: [54, -1, -1, -1], // Needs 2 to reach 56
          B: [-1, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      // Roll 3: 54 + 3 = 57 > 56 -> no legal moves!
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1060, actorSeat: "A", randomValues: [3] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      // Turn passes to B
      expect(res.newState.tokens.A[0]).toBe(54);
      expect(res.newState.activeSeat).toBe("B");
    });

    it("emits token-entered-home and awards bonus roll on exact landing at 56", () => {
      const state: LudoState = {
        tokens: {
          A: [53, 0, -1, -1],
          B: [-1, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "choose-token",
        consecutiveSixes: 0,
        pendingRoll: 3,
        legalTokenIds: [0, 1], // Both token 0 (53->56) and token 1 (0->3) are legal
        status: "active",
        winner: null,
      };

      // Move token 0 into home (53 + 3 = 56)
      const res = validateAndReduce(
        state,
        { action: "ludo.move", payload: { tokenId: 0 } },
        { serverTime: 1070, actorSeat: "A" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.tokens.A[0]).toBe(56);
      expect(res.effects).toContainEqual({
        type: "token-entered-home",
        seat: "A",
        tokenId: 0,
      });
      // Reaching home awards bonus roll! ActiveSeat stays A, phase is "roll"
      expect(res.newState.activeSeat).toBe("A");
      expect(res.newState.phase).toBe("roll");
    });
  });

  describe("Captures & Safe Squares", () => {
    it("captures lowest-ID opposing token on unsafe square and returns it to yard", () => {
      // Seat B starts at ring 26.
      // Suppose Seat B has two tokens at ring index 10:
      // For B: ringIndex 10 means (26 + progress) % 52 = 10 => progress 36!
      // Token 1 and Token 3 of B are both at progress 36.
      // Ring index 10 is NOT a safe square (safe squares: 0, 8, 13, 21, 26, 34, 39, 47).
      // Seat A moves token 0 from progress 8 to progress 10 (ring index 10).
      const state: LudoState = {
        tokens: {
          A: [8, -1, -1, -1],
          B: [-1, 36, -1, 36], // Token 1 and 3 at ring index 10
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      // Roll 2 -> auto-selects token 0 (8 + 2 = 10)
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1100, actorSeat: "A", randomValues: [2] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.tokens.A[0]).toBe(10);
      // Lowest ID opposing token (Token 1) is captured and returned to yard (-1)
      expect(res.newState.tokens.B[1]).toBe(-1);
      // Higher ID opposing token (Token 3) stays at progress 36 (mixed occupancy permitted)
      expect(res.newState.tokens.B[3]).toBe(36);

      expect(res.effects).toContainEqual({
        type: "token-captured",
        bySeat: "A",
        byTokenId: 0,
        capturedSeat: "B",
        capturedTokenId: 1,
        ringIndex: 10,
      });

      // Capture awards bonus roll! ActiveSeat stays A
      expect(res.newState.activeSeat).toBe("A");
      expect(res.newState.phase).toBe("roll");
    });

    it("safe squares protect tokens from capture and permit mixed occupancy", () => {
      // Ring index 8 is a safe square.
      // For A: start is 0, progress 8 = ring index 8.
      // For B: start is 26, progress 34 = (26 + 34) % 52 = 60 % 52 = 8.
      const state: LudoState = {
        tokens: {
          A: [6, -1, -1, -1],
          B: [34, -1, -1, -1], // B's token 0 at ring index 8
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      // Roll 2 -> A moves 6 -> 8 (landing on safe square 8)
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1120, actorSeat: "A", randomValues: [2] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.tokens.A[0]).toBe(8);
      // B's token is NOT captured!
      expect(res.newState.tokens.B[0]).toBe(34);
      // No capture effect
      const captureEffect = res.effects.find((e) => e.type === "token-captured");
      expect(captureEffect).toBeUndefined();
      // No bonus roll -> turn passes to B
      expect(res.newState.activeSeat).toBe("B");
    });

    it("tokens in home lanes cannot capture or be captured", () => {
      // Progress 51..56 is home lane.
      const state: LudoState = {
        tokens: {
          A: [51, -1, -1, -1],
          B: [51, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1130, actorSeat: "A", randomValues: [2] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.tokens.A[0]).toBe(53);
      expect(res.newState.tokens.B[0]).toBe(51);
      expect(res.effects.some((e) => e.type === "token-captured")).toBe(false);
    });
  });

  describe("Consecutive Sixes & Bonuses", () => {
    it("third consecutive six is ignored (causes no movement) and grants another roll", () => {
      // Tokens 1, 2, 3 at home (56) so only token 0 can move on a roll of 6
      let state: LudoState = {
        tokens: {
          A: [0, 56, 56, 56],
          B: [-1, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      // 1st six: moves 0 -> 6, streak becomes 1
      const res1 = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1200, actorSeat: "A", randomValues: [6] },
      );
      expect(res1.success).toBe(true);
      if (!res1.success) return;
      expect(res1.newState.consecutiveSixes).toBe(1);
      expect(res1.newState.tokens.A[0]).toBe(6);
      expect(res1.newState.activeSeat).toBe("A");
      state = res1.newState;

      // 2nd six: moves 6 -> 12, streak becomes 2
      const res2 = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1210, actorSeat: "A", randomValues: [6] },
      );
      expect(res2.success).toBe(true);
      if (!res2.success) return;
      expect(res2.newState.consecutiveSixes).toBe(2);
      expect(res2.newState.tokens.A[0]).toBe(12);
      expect(res2.newState.activeSeat).toBe("A");
      state = res2.newState;

      // 3rd consecutive six: IGNORED! Token does NOT move! Grants another roll.
      const res3 = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1220, actorSeat: "A", randomValues: [6] },
      );
      expect(res3.success).toBe(true);
      if (!res3.success) return;
      expect(res3.newState.consecutiveSixes).toBe(2); // Capped at 2
      expect(res3.newState.tokens.A[0]).toBe(12); // Token did not move!
      expect(res3.newState.activeSeat).toBe("A"); // Grants another roll
      expect(res3.newState.phase).toBe("roll");
      expect(res3.effects).toEqual([{ type: "dice-rolled", seat: "A", roll: 6, ignored: true }]);
      state = res3.newState;

      // 4th consecutive six: also ignored, streak remains capped at 2
      const res4 = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1230, actorSeat: "A", randomValues: [6] },
      );
      expect(res4.success).toBe(true);
      if (!res4.success) return;
      expect(res4.newState.consecutiveSixes).toBe(2);
      expect(res4.newState.tokens.A[0]).toBe(12);
      state = res4.newState;

      // 5th roll: 3 (1-5 appears) -> streak resets to 0, moves token 12 -> 15
      const res5 = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1240, actorSeat: "A", randomValues: [3] },
      );
      expect(res5.success).toBe(true);
      if (!res5.success) return;
      expect(res5.newState.consecutiveSixes).toBe(0);
      expect(res5.newState.tokens.A[0]).toBe(15);
      // Turn passes to B
      expect(res5.newState.activeSeat).toBe("B");
    });

    it("single bonus roll granted even if roll of 6 and capture occur simultaneously", () => {
      // Seat B at ring index 6 (progress 32 for B: (26+32)%52 = 6). Unsafe square.
      // Seat A at ring index 0 (progress 0). Tokens 1..3 at home (56).
      // Roll 6: lands on ring index 6, captures B's token.
      const state: LudoState = {
        tokens: {
          A: [0, 56, 56, 56],
          B: [32, -1, -1, -1],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1300, actorSeat: "A", randomValues: [6] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.tokens.A[0]).toBe(6);
      expect(res.newState.tokens.B[0]).toBe(-1); // captured
      expect(res.newState.activeSeat).toBe("A");
      expect(res.newState.phase).toBe("roll");
      expect(res.newState.consecutiveSixes).toBe(1);
    });
  });

  describe("Win Detection", () => {
    it("first player to get all 4 tokens to home (progress 56) wins immediately", () => {
      const state: LudoState = {
        tokens: {
          A: [56, 56, 56, 52], // Token 3 needs 4 to reach 56
          B: [0, 0, 0, 0],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1400, actorSeat: "A", randomValues: [4] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.status).toBe("completed");
      expect(res.newState.winner).toBe("A");
      expect(res.newState.tokens.A).toEqual([56, 56, 56, 56]);
      expect(res.terminalResult).toBeDefined();
      expect(res.terminalResult?.winner).toBe("A");
      expect(res.terminalResult?.reason).toBe("rules_win");
      expect(res.terminalResult?.scores).toEqual({ A: 1, B: 0 });
      expect(res.effects).toContainEqual({ type: "game-won", winner: "A" });
      expect(isTerminal(res.newState)).toEqual(res.terminalResult);
    });

    it("winning move ends match immediately before any bonus roll", () => {
      // Even if the winning roll is a 6, game ends immediately without pending bonus roll
      const state: LudoState = {
        tokens: {
          A: [56, 56, 56, 50], // Token 3 needs 6 to reach 56
          B: [0, 0, 0, 0],
        },
        activeSeat: "A",
        phase: "roll",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "active",
        winner: null,
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1410, actorSeat: "A", randomValues: [6] },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.status).toBe("completed");
      expect(res.newState.phase).toBe("completed");
      expect(res.newState.winner).toBe("A");
    });
  });

  describe("Validation & Errors", () => {
    it("rejects actions when match is completed", () => {
      const state: LudoState = {
        tokens: { A: [56, 56, 56, 56], B: [0, 0, 0, 0] },
        activeSeat: "A",
        phase: "completed",
        consecutiveSixes: 0,
        pendingRoll: null,
        legalTokenIds: [],
        status: "completed",
        winner: "A",
      };

      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1500, actorSeat: "A", randomValues: [1] },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.MATCH_FINISHED);
      }
    });

    it("rejects action from inactive seat", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1510, actorSeat: "B", randomValues: [6] },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.NOT_YOUR_TURN);
      }
    });

    it("rejects roll without valid randomValues fact", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "dice.roll", payload: {} },
        { serverTime: 1520, actorSeat: "A" },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("rejects illegal token selection during choose-token phase", () => {
      const state: LudoState = {
        tokens: { A: [10, -1, -1, -1], B: [0, 0, 0, 0] },
        activeSeat: "A",
        phase: "choose-token",
        consecutiveSixes: 0,
        pendingRoll: 3,
        legalTokenIds: [0],
        status: "active",
        winner: null,
      };

      const res = validateAndReduce(
        state,
        { action: "ludo.move", payload: { tokenId: 2 } }, // Token 2 is not legal
        { serverTime: 1530, actorSeat: "A" },
      );

      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });
  });

  describe("Board Geometry & Ring Mapping", () => {
    it("maps ring indices 0..51 and home lanes correctly", () => {
      expect(getRingIndex("A", 0)).toBe(0);
      expect(getRingIndex("A", 50)).toBe(50);
      expect(getRingIndex("A", 51)).toBeNull(); // home lane
      expect(getRingIndex("A", -1)).toBeNull(); // yard

      expect(getRingIndex("B", 0)).toBe(26);
      expect(getRingIndex("B", 25)).toBe(51);
      expect(getRingIndex("B", 26)).toBe(0);

      // Verify coordinate lookup
      expect(getBoardCoordinate("A", -1)).toBeNull();
      expect(getBoardCoordinate("A", 0)).toEqual([6, 1]);
      expect(getBoardCoordinate("A", 51)).toEqual([7, 1]);
      expect(getBoardCoordinate("A", 56)).toEqual([7, 6]);

      expect(getBoardCoordinate("B", 0)).toEqual([8, 13]);
      expect(getBoardCoordinate("B", 51)).toEqual([7, 13]);
      expect(getBoardCoordinate("B", 56)).toEqual([7, 8]);
    });

    it("contains all 8 safe squares", () => {
      expect(LUDO_SAFE_SQUARES).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
      for (const sq of LUDO_SAFE_SQUARES) {
        expect(LUDO_SAFE_SQUARES_SET.has(sq)).toBe(true);
      }
    });
  });

  describe("Adapter & Protocol Invariants", () => {
    it("conforms to GameEngineAdapter contract", () => {
      expect(ludoEngineAdapter.gameId).toBe("ludo");
      expect(typeof ludoEngineAdapter.createInitialState).toBe("function");
      expect(typeof ludoEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof ludoEngineAdapter.legalActions).toBe("function");
      expect(typeof ludoEngineAdapter.toPublicView).toBe("function");
      expect(typeof ludoEngineAdapter.isTerminal).toBe("function");
    });

    it("survives JSON round-trip without corruption", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(state);
    });
  });
});
