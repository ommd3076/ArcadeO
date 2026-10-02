import { describe, it, expect } from "vitest";
import {
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/hand-cricket/engine";
import { handCricketEngineAdapter } from "../../../../shared/games/hand-cricket/adapter";
import { CricketState } from "../../../../shared/games/hand-cricket/types";
import { ErrorCode } from "../../../../shared/protocol/errors";
import { ViewerContext } from "../../../../shared/protocol/types";

describe("Hand Cricket Engine", () => {
  describe("Toss and Role Selection (HC01)", () => {
    it("initializes in toss phase with startingSeat as toss winner", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(state.phase).toBe("toss");
      expect(state.innings).toBe(1);
      expect(state.tossWinner).toBe("A");
      expect(state.roles).toBeNull();
      expect(state.firstInningsRuns).toBe(0);
      expect(state.secondInningsRuns).toBe(0);
      expect(state.target).toBeNull();
      expect(state.deliveryId).toBe(1);
      expect(state.secretDeliveries).toEqual({});
      expect(state.lockedSeats).toEqual([]);
      expect(state.lastDelivery).toBeNull();
      expect(isTerminal(state)).toBeNull();

      expect(legalActions(state, "A")).toEqual(["cricket.choose-role"]);
      expect(legalActions(state, "B")).toEqual([]);
    });

    it("rejects role selection by non-toss winner", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "B" },
      );

      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe(ErrorCode.NOT_YOUR_TURN);
    });

    it("rejects invalid role selection", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "cricket.choose-role", payload: { role: "field" as any } },
        { serverTime: 1005, actorSeat: "A" },
      );

      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
    });

    it("toss winner choosing 'bat' sets tossWinner as batter and other as bowler", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.phase).toBe("first_innings");
      expect(res.newState.roles).toEqual({ bat: "A", bowl: "B" });
      expect(res.effects).toEqual([
        { type: "toss-resolved", tossWinner: "A" },
        {
          type: "role-chosen",
          tossWinner: "A",
          choice: "bat",
          batter: "A",
          bowler: "B",
        },
      ]);
    });

    it("toss winner choosing 'bowl' sets tossWinner as bowler and other as batter", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "B" });
      const res = validateAndReduce(
        state,
        { action: "cricket.choose-role", payload: { role: "bowl" } },
        { serverTime: 1005, actorSeat: "B" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.phase).toBe("first_innings");
      expect(res.newState.roles).toEqual({ bat: "A", bowl: "B" });
      expect(res.effects).toEqual([
        { type: "toss-resolved", tossWinner: "B" },
        {
          type: "role-chosen",
          tossWinner: "B",
          choice: "bowl",
          batter: "A",
          bowler: "B",
        },
      ]);
    });
  });

  describe("First Innings: Run Scoring and Delivery Lifecycle (HC02)", () => {
    function setupFirstInnings(batSeat: "A" | "B" = "A"): CricketState {
      const s0 = createInitialState({ serverTime: 1000, startingSeat: batSeat });
      const r0 = validateAndReduce(
        s0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: batSeat },
      );
      if (!r0.success) throw new Error("setup failed");
      return r0.newState;
    }

    it("both players can secretly lock numbers 1..6", () => {
      const state0 = setupFirstInnings("A");
      expect(legalActions(state0, "A")).toEqual(["secret.lock"]);
      expect(legalActions(state0, "B")).toEqual(["secret.lock"]);

      // A locks 4
      const resA = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      expect(resA.newState.lockedSeats).toEqual(["A"]);
      expect(resA.newState.secretDeliveries.A).toBe(4);
      expect(resA.newState.secretDeliveries.B).toBeUndefined();
      expect(resA.newState.lastDelivery).toBeNull();
      expect(resA.effects).toEqual([
        { type: "delivery-locked", seat: "A", innings: 1, deliveryId: 1 },
      ]);

      // A cannot lock again
      expect(legalActions(resA.newState, "A")).toEqual([]);
      expect(legalActions(resA.newState, "B")).toEqual(["secret.lock"]);

      const dupA = validateAndReduce(
        resA.newState,
        { action: "secret.lock", payload: { value: 6 } },
        { serverTime: 1012, actorSeat: "A" },
      );
      expect(dupA.success).toBe(false);
      if (dupA.success) return;
      expect(dupA.error.code).toBe(ErrorCode.CHOICE_LOCKED);
    });

    it("rejects numbers outside 1..6 or non-integers", () => {
      const state0 = setupFirstInnings("A");
      for (const invalidVal of [0, 7, -1, 3.5, NaN, "4" as any, null as any]) {
        const res = validateAndReduce(
          state0,
          { action: "secret.lock", payload: { value: invalidVal } },
          { serverTime: 1010, actorSeat: "A" },
        );
        expect(res.success).toBe(false);
        if (res.success) return;
        expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
      }
    });

    it("scores batter's number when numbers are different", () => {
      const state0 = setupFirstInnings("A"); // A is batter, B is bowler

      // A plays 6, B plays 2
      const resA = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 6 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!resA.success) return;

      const resB = validateAndReduce(
        resA.newState,
        { action: "secret.lock", payload: { value: 2 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      expect(resB.newState.firstInningsRuns).toBe(6);
      expect(resB.newState.lastDelivery).toEqual({
        innings: 1,
        deliveryId: 1,
        runs: { bat: 6, bowl: 2 },
        outcome: "runs",
        scoredRuns: 6,
        batterRunsAfter: 6,
      });

      expect(resB.effects).toEqual([
        { type: "delivery-locked", seat: "B", innings: 1, deliveryId: 1 },
        {
          type: "delivery-resolved",
          innings: 1,
          deliveryId: 1,
          batter: "A",
          bowler: "B",
          batterNumber: 6,
          bowlerNumber: 2,
          scoredRuns: 6,
          totalRuns: 6,
        },
      ]);

      // Both players must acknowledge with secret.next before next delivery
      expect(legalActions(resB.newState, "A")).toEqual(["secret.next"]);
      expect(legalActions(resB.newState, "B")).toEqual(["secret.next"]);
    });

    it("advances to next delivery when both players call secret.next", () => {
      const state0 = setupFirstInnings("A");
      const r1 = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!r1.success) return;
      const r2 = validateAndReduce(
        r1.newState,
        { action: "secret.lock", payload: { value: 5 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      if (!r2.success) return;

      // Delivery 1 resolved, 3 runs scored.
      // A acknowledges secret.next
      const n1 = validateAndReduce(
        r2.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1020, actorSeat: "A" },
      );
      expect(n1.success).toBe(true);
      if (!n1.success) return;
      expect(n1.newState.readiness).toEqual({ A: true, B: false });
      expect(n1.newState.deliveryId).toBe(1); // not yet advanced

      // B acknowledges secret.next -> advances deliveryId to 2 and clears secretDeliveries
      const n2 = validateAndReduce(
        n1.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1025, actorSeat: "B" },
      );
      expect(n2.success).toBe(true);
      if (!n2.success) return;
      expect(n2.newState.deliveryId).toBe(2);
      expect(n2.newState.secretDeliveries).toEqual({});
      expect(n2.newState.lockedSeats).toEqual([]);
      expect(n2.newState.lastDelivery).toBeNull();
      expect(n2.newState.readiness).toEqual({ A: false, B: false });
      expect(legalActions(n2.newState, "A")).toEqual(["secret.lock"]);
      expect(legalActions(n2.newState, "B")).toEqual(["secret.lock"]);
    });
  });

  describe("First Innings: Dismissal and Innings Transition (HC03)", () => {
    function setupFirstInnings(batSeat: "A" | "B" = "A"): CricketState {
      const s0 = createInitialState({ serverTime: 1000, startingSeat: batSeat });
      const r0 = validateAndReduce(
        s0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: batSeat },
      );
      if (!r0.success) throw new Error("setup failed");
      return r0.newState;
    }

    it("dismisses batter when numbers match and sets target = runs + 1", () => {
      const state0 = setupFirstInnings("A"); // A bats, B bowls
      // Score 4 on ball 1
      const d1A = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!d1A.success) return;
      const d1B = validateAndReduce(
        d1A.newState,
        { action: "secret.lock", payload: { value: 1 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      if (!d1B.success) return;
      const n1A = validateAndReduce(
        d1B.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1020, actorSeat: "A" },
      );
      if (!n1A.success) return;
      const n1B = validateAndReduce(
        n1A.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1025, actorSeat: "B" },
      );
      if (!n1B.success) return;

      // Ball 2: both play 3 (equal numbers -> OUT!)
      const d2A = validateAndReduce(
        n1B.newState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1030, actorSeat: "A" },
      );
      if (!d2A.success) return;
      const d2B = validateAndReduce(
        d2A.newState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1035, actorSeat: "B" },
      );
      expect(d2B.success).toBe(true);
      if (!d2B.success) return;

      expect(d2B.newState.firstInningsRuns).toBe(4);
      expect(d2B.newState.target).toBe(5); // 4 + 1
      expect(d2B.newState.lastDelivery).toEqual({
        innings: 1,
        deliveryId: 2,
        runs: { bat: 3, bowl: 3 },
        outcome: "out",
        scoredRuns: 0,
        batterRunsAfter: 4,
      });

      expect(d2B.effects).toEqual([
        { type: "delivery-locked", seat: "B", innings: 1, deliveryId: 2 },
        {
          type: "wicket-fallen",
          innings: 1,
          deliveryId: 2,
          batter: "A",
          bowler: "B",
          number: 3,
          finalInningsRuns: 4,
        },
      ]);

      // Both players call secret.next to swap innings
      const nextA = validateAndReduce(
        d2B.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1040, actorSeat: "A" },
      );
      if (!nextA.success) return;

      const nextB = validateAndReduce(
        nextA.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1045, actorSeat: "B" },
      );
      expect(nextB.success).toBe(true);
      if (!nextB.success) return;

      expect(nextB.newState.phase).toBe("second_innings");
      expect(nextB.newState.innings).toBe(2);
      expect(nextB.newState.roles).toEqual({ bat: "B", bowl: "A" }); // roles swapped
      expect(nextB.newState.target).toBe(5);
      expect(nextB.newState.deliveryId).toBe(3); // IDs never repeat across innings.
      expect(nextB.newState.secretDeliveries).toEqual({});
      expect(nextB.newState.lockedSeats).toEqual([]);
      expect(nextB.newState.lastDelivery).toBeNull();
      expect(nextB.effects).toEqual([
        {
          type: "innings-swapped",
          innings: 2,
          newBatter: "B",
          newBowler: "A",
          target: 5,
        },
      ]);
    });

    it("zero-run first innings results in target = 1", () => {
      const state0 = setupFirstInnings("A");
      // Immediate wicket on ball 1: both play 5
      const d1A = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 5 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!d1A.success) return;
      const d1B = validateAndReduce(
        d1A.newState,
        { action: "secret.lock", payload: { value: 5 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      expect(d1B.success).toBe(true);
      if (!d1B.success) return;

      expect(d1B.newState.firstInningsRuns).toBe(0);
      expect(d1B.newState.target).toBe(1); // 0 + 1 = 1

      // Advance to 2nd innings
      const s1 = validateAndReduce(
        d1B.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1020, actorSeat: "A" },
      );
      if (!s1.success) return;
      const s2 = validateAndReduce(
        s1.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1025, actorSeat: "B" },
      );
      expect(s2.success).toBe(true);
      if (!s2.success) return;

      expect(s2.newState.phase).toBe("second_innings");
      expect(s2.newState.target).toBe(1);
    });
  });

  describe("Second Innings: Chase & Terminal Outcomes (HC04, HC05)", () => {
    function setupSecondInnings(target: number): CricketState {
      // Setup state where A scored (target - 1) runs in innings 1 and got out
      const firstInningsRuns = target - 1;
      return {
        phase: "second_innings",
        innings: 2,
        tossWinner: "A",
        roles: { bat: "B", bowl: "A" }, // B is chasing
        firstInningsRuns,
        secondInningsRuns: 0,
        target,
        deliveryId: 1,
        secretDeliveries: {},
        lockedSeats: [],
        lastDelivery: null,
        readiness: { A: false, B: false },
      };
    }

    it("chasing batter wins immediately upon reaching or exceeding target", () => {
      // First innings runs = 4, target = 5.
      const state0 = setupSecondInnings(5);

      // Ball 1: B plays 6, A plays 2 -> 6 runs scored >= target (5) -> Immediate WIN for B!
      const d1B = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 6 } },
        { serverTime: 1010, actorSeat: "B" },
      );
      if (!d1B.success) return;

      const d1A = validateAndReduce(
        d1B.newState,
        { action: "secret.lock", payload: { value: 2 } },
        { serverTime: 1015, actorSeat: "A" },
      );
      expect(d1A.success).toBe(true);
      if (!d1A.success) return;

      expect(d1A.newState.phase).toBe("terminal");
      expect(d1A.newState.secondInningsRuns).toBe(6);
      expect(d1A.newState.terminalResult).toEqual({
        winner: "B",
        reason: "rules_win",
        scores: { A: 4, B: 6 },
        finishedAt: 1015,
        details: {
          firstInningsRuns: 4,
          secondInningsRuns: 6,
          target: 5,
        },
      });

      expect(isTerminal(d1A.newState)).toEqual(d1A.newState.terminalResult);
      expect(legalActions(d1A.newState, "A")).toEqual([]);
      expect(legalActions(d1A.newState, "B")).toEqual([]);

      expect(d1A.effects).toEqual([
        { type: "delivery-locked", seat: "A", innings: 2, deliveryId: 1 },
        {
          type: "delivery-resolved",
          innings: 2,
          deliveryId: 1,
          batter: "B",
          bowler: "A",
          batterNumber: 6,
          bowlerNumber: 2,
          scoredRuns: 6,
          totalRuns: 6,
        },
        {
          type: "game-won",
          winner: "B",
          scores: { A: 4, B: 6 },
          reason: "Seat B reached target of 5 runs",
        },
      ]);
    });

    it("first batter wins (defended total) when chasing batter is dismissed below target", () => {
      // First innings runs = 10, target = 11.
      const state0 = setupSecondInnings(11);

      // Ball 1: B scores 4
      const d1B = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1010, actorSeat: "B" },
      );
      if (!d1B.success) return;
      const d1A = validateAndReduce(
        d1B.newState,
        { action: "secret.lock", payload: { value: 1 } },
        { serverTime: 1015, actorSeat: "A" },
      );
      if (!d1A.success) return;

      const n1B = validateAndReduce(
        d1A.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1020, actorSeat: "B" },
      );
      if (!n1B.success) return;
      const n1A = validateAndReduce(
        n1B.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1025, actorSeat: "A" },
      );
      if (!n1A.success) return;

      // Ball 2: B plays 3, A plays 3 (Wicket! B dismissed on 4 runs < 10 runs)
      const d2B = validateAndReduce(
        n1A.newState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1030, actorSeat: "B" },
      );
      if (!d2B.success) return;
      const d2A = validateAndReduce(
        d2B.newState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1035, actorSeat: "A" },
      );
      expect(d2A.success).toBe(true);
      if (!d2A.success) return;

      expect(d2A.newState.phase).toBe("terminal");
      expect(d2A.newState.terminalResult).toEqual({
        winner: "A",
        reason: "rules_win",
        scores: { A: 10, B: 4 },
        finishedAt: 1035,
        details: {
          firstInningsRuns: 10,
          secondInningsRuns: 4,
        },
      });

      expect(d2A.effects).toEqual([
        { type: "delivery-locked", seat: "A", innings: 2, deliveryId: 2 },
        {
          type: "wicket-fallen",
          innings: 2,
          deliveryId: 2,
          batter: "B",
          bowler: "A",
          number: 3,
          finalInningsRuns: 4,
        },
        {
          type: "game-won",
          winner: "A",
          scores: { A: 10, B: 4 },
          reason: "Seat A defended 10 runs",
        },
      ]);
    });

    it("results in DRAW when chasing batter is dismissed with runs equal to first innings", () => {
      // First innings runs = 5, target = 6.
      const state0 = setupSecondInnings(6);

      // Ball 1: B scores 5 (equal to A's 5 runs)
      const d1B = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { value: 5 } },
        { serverTime: 1010, actorSeat: "B" },
      );
      if (!d1B.success) return;
      const d1A = validateAndReduce(
        d1B.newState,
        { action: "secret.lock", payload: { value: 2 } },
        { serverTime: 1015, actorSeat: "A" },
      );
      if (!d1A.success) return;

      // Acknowledge ball 1
      const n1 = validateAndReduce(
        d1A.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1020, actorSeat: "A" },
      );
      if (!n1.success) return;
      const n2 = validateAndReduce(
        n1.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1025, actorSeat: "B" },
      );
      if (!n2.success) return;

      // Ball 2: B plays 4, A plays 4 -> WICKET! Both scored 5 runs!
      const d2B = validateAndReduce(
        n2.newState,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1030, actorSeat: "B" },
      );
      if (!d2B.success) return;
      const d2A = validateAndReduce(
        d2B.newState,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1035, actorSeat: "A" },
      );
      expect(d2A.success).toBe(true);
      if (!d2A.success) return;

      expect(d2A.newState.phase).toBe("terminal");
      expect(d2A.newState.terminalResult).toEqual({
        winner: null,
        reason: "rules_draw",
        scores: { A: 5, B: 5 },
        finishedAt: 1035,
        details: {
          firstInningsRuns: 5,
          secondInningsRuns: 5,
        },
      });

      expect(d2A.effects).toEqual([
        { type: "delivery-locked", seat: "A", innings: 2, deliveryId: 2 },
        {
          type: "wicket-fallen",
          innings: 2,
          deliveryId: 2,
          batter: "B",
          bowler: "A",
          number: 4,
          finalInningsRuns: 5,
        },
        {
          type: "game-drawn",
          scores: { A: 5, B: 5 },
          reason: "Match tied: both scored 5 runs",
        },
      ]);
    });
  });

  describe("Privacy & Public View Masking", () => {
    it("never exposes secret delivery numbers in toPublicView while delivery is unresolved", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const r0 = validateAndReduce(
        state0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!r0.success) return;

      // A locks 6
      const r1 = validateAndReduce(
        r0.newState,
        { action: "secret.lock", payload: { value: 6 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!r1.success) return;

      // Public view for B, A, or bystander
      const viewerB: ViewerContext = {
        viewerAccountId: "B",
        viewerSeat: "B",
        isController: false,
        mode: "remote",
      };
      const viewB = toPublicView(r1.newState, viewerB);
      expect(viewB.lockedSeats).toEqual(["A"]);
      expect(viewB.lastDelivery).toBeNull();
      // Internal secretDeliveries must not exist in view
      expect((viewB as any).secretDeliveries).toBeUndefined();
    });

    it("reveals resolved delivery in lastDelivery once both players lock", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const r0 = validateAndReduce(
        state0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!r0.success) return;

      const r1 = validateAndReduce(
        r0.newState,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!r1.success) return;
      const r2 = validateAndReduce(
        r1.newState,
        { action: "secret.lock", payload: { value: 2 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      if (!r2.success) return;

      const view = toPublicView(r2.newState);
      expect(view.lastDelivery).toEqual({
        innings: 1,
        deliveryId: 1,
        runs: { bat: 4, bowl: 2 },
        outcome: "runs",
        scoredRuns: 4,
        batterRunsAfter: 4,
      });
    });
  });

  describe("Rejection of Invalid & Out-of-Turn Actions", () => {
    it("rejects actions after terminal", () => {
      const terminalState: CricketState = {
        phase: "terminal",
        innings: 2,
        tossWinner: "A",
        roles: { bat: "B", bowl: "A" },
        firstInningsRuns: 4,
        secondInningsRuns: 6,
        target: 5,
        deliveryId: 1,
        secretDeliveries: {},
        lockedSeats: [],
        lastDelivery: null,
        readiness: { A: false, B: false },
        terminalResult: {
          winner: "B",
          reason: "rules_win",
          scores: { A: 4, B: 6 },
          finishedAt: 1000,
        },
      };

      const res = validateAndReduce(
        terminalState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe(ErrorCode.MATCH_FINISHED);
    });

    it("rejects locking when previous delivery is awaiting secret.next acknowledgment", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const r0 = validateAndReduce(
        state0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!r0.success) return;

      const r1 = validateAndReduce(
        r0.newState,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!r1.success) return;
      const r2 = validateAndReduce(
        r1.newState,
        { action: "secret.lock", payload: { value: 2 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      if (!r2.success) return;

      // Attempt to lock again without secret.next
      const prematureLock = validateAndReduce(
        r2.newState,
        { action: "secret.lock", payload: { value: 3 } },
        { serverTime: 1020, actorSeat: "A" },
      );
      expect(prematureLock.success).toBe(false);
      if (prematureLock.success) return;
      expect(prematureLock.error.code).toBe(ErrorCode.INVALID_ACTION);
    });

    it("rejects secret.next when no delivery is awaiting acknowledgment", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const r0 = validateAndReduce(
        state0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!r0.success) return;

      const prematureNext = validateAndReduce(
        r0.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(prematureNext.success).toBe(false);
      if (prematureNext.success) return;
      expect(prematureNext.error.code).toBe(ErrorCode.INVALID_ACTION);
    });

    it("rejects unrecognized action", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "dice.roll" as any, payload: {} },
        { serverTime: 1005, actorSeat: "A" },
      );
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
    });
  });

  describe("Determinism, JSON Serialization & Immutability", () => {
    it("preserves state accurately across JSON serialization", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "B" });
      const json = JSON.stringify(state0);
      const parsed: CricketState = JSON.parse(json);
      expect(parsed).toEqual(state0);
    });

    it("does not mutate original state upon reduction", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const state0Snapshot = JSON.parse(JSON.stringify(state0));

      validateAndReduce(
        state0,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );

      expect(state0).toEqual(state0Snapshot);
    });

    it("adapter correctly exposes all required methods and properties", () => {
      expect(handCricketEngineAdapter.gameId).toBe("hand-cricket");
      expect(typeof handCricketEngineAdapter.createInitialState).toBe("function");
      expect(typeof handCricketEngineAdapter.validateAndReduce).toBe("function");
      expect(typeof handCricketEngineAdapter.legalActions).toBe("function");
      expect(typeof handCricketEngineAdapter.toPublicView).toBe("function");
      expect(typeof handCricketEngineAdapter.isTerminal).toBe("function");
    });
  });

  describe("Hand Cricket V2 (1..10 Choices & Batter-First Chooser Order)", () => {
    it("rejects values > 6 in rulesVersion 1, but accepts 1..10 in rulesVersion 2", () => {
      // V1
      const v1 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 1 },
      });
      const v1Role = validateAndReduce(
        v1,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      expect(v1Role.success).toBe(true);
      if (!v1Role.success) return;

      const v1Reject7 = validateAndReduce(
        v1Role.newState,
        { action: "secret.lock", payload: { value: 7 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(v1Reject7.success).toBe(false);
      if (v1Reject7.success) return;
      expect(v1Reject7.error.code).toBe(ErrorCode.INVALID_ACTION);

      // V2
      const v2 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 2 },
      });
      expect(v2.rulesVersion).toBe(2);

      const v2Role = validateAndReduce(
        v2,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      expect(v2Role.success).toBe(true);
      if (!v2Role.success) return;

      const v2Accept10 = validateAndReduce(
        v2Role.newState,
        { action: "secret.lock", payload: { value: 10 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(v2Accept10.success).toBe(true);

      const v2Reject11 = validateAndReduce(
        v2Role.newState,
        { action: "secret.lock", payload: { value: 11 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      expect(v2Reject11.success).toBe(false);
    });

    it("scores runs correctly with 1..10 in V2", () => {
      const v2 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 2 },
      });
      const v2Role = validateAndReduce(
        v2,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!v2Role.success) throw new Error("setup failed");

      // Batter A plays 9, Bowler B plays 4
      const lockA = validateAndReduce(
        v2Role.newState,
        { action: "secret.lock", payload: { value: 9 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!lockA.success) throw new Error("lockA failed");

      const lockB = validateAndReduce(
        lockA.newState,
        { action: "secret.lock", payload: { value: 4 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      expect(lockB.success).toBe(true);
      if (!lockB.success) return;

      expect(lockB.newState.firstInningsRuns).toBe(9);
      expect(lockB.newState.lastDelivery?.outcome).toBe("runs");
      expect(lockB.newState.lastDelivery?.scoredRuns).toBe(9);
    });

    it("triggers wicket on equal 10 in V2", () => {
      const v2 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 2 },
      });
      const v2Role = validateAndReduce(
        v2,
        { action: "cricket.choose-role", payload: { role: "bat" } },
        { serverTime: 1005, actorSeat: "A" },
      );
      if (!v2Role.success) throw new Error("setup failed");

      const lockA = validateAndReduce(
        v2Role.newState,
        { action: "secret.lock", payload: { value: 10 } },
        { serverTime: 1010, actorSeat: "A" },
      );
      if (!lockA.success) throw new Error("lockA failed");

      const lockB = validateAndReduce(
        lockA.newState,
        { action: "secret.lock", payload: { value: 10 } },
        { serverTime: 1015, actorSeat: "B" },
      );
      expect(lockB.success).toBe(true);
      if (!lockB.success) return;

      expect(lockB.newState.firstInningsRuns).toBe(0);
      expect(lockB.newState.target).toBe(1);
      expect(lockB.newState.lastDelivery?.outcome).toBe("out");
    });

    it("exposes correct allowedNumbers in public view", () => {
      const v1 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 1 },
      });
      const v1View = toPublicView(v1, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: true,
        mode: "remote",
      });
      expect(v1View.allowedNumbers).toEqual([1, 2, 3, 4, 5, 6]);

      const v2 = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { rulesVersion: 2 },
      });
      const v2View = toPublicView(v2, {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: true,
        mode: "remote",
      });
      expect(v2View.allowedNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });
  });
});
