import { describe, it, expect } from "vitest";
import {
  evaluateRPS,
  createInitialState,
  isTerminal,
  legalActions,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/rps/engine";
import { rpsEngineAdapter } from "../../../../shared/games/rps/adapter";
import { RPSState } from "../../../../shared/games/rps/types";
import { ErrorCode } from "../../../../shared/protocol/errors";
import { ViewerContext } from "../../../../shared/protocol/types";

describe("Rock Paper Scissors Engine", () => {
  describe("Matchup Evaluation (evaluateRPS)", () => {
    it("correctly evaluates all 9 matchup combinations", () => {
      // 3 wins for A
      expect(evaluateRPS("rock", "scissors")).toBe("A");
      expect(evaluateRPS("scissors", "paper")).toBe("A");
      expect(evaluateRPS("paper", "rock")).toBe("A");

      // 3 wins for B (reversed matchups)
      expect(evaluateRPS("scissors", "rock")).toBe("B");
      expect(evaluateRPS("paper", "scissors")).toBe("B");
      expect(evaluateRPS("rock", "paper")).toBe("B");

      // 3 draws
      expect(evaluateRPS("rock", "rock")).toBe("draw");
      expect(evaluateRPS("paper", "paper")).toBe("draw");
      expect(evaluateRPS("scissors", "scissors")).toBe("draw");
    });
  });

  describe("Initial State Creation", () => {
    it("defaults to best-of-3 with targetWins = 2", () => {
      const state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      expect(state.targetWins).toBe(2);
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.roundId).toBe(1);
      expect(state.phase).toBe("locking");
      expect(state.secretChoices).toEqual({});
      expect(state.lockedSeats).toEqual([]);
      expect(state.roundResult).toBeNull();
      expect(state.revealed).toBe(false);
      expect(state.readiness).toEqual({ A: false, B: false });
      expect(state.terminalResult).toBeUndefined();
      expect(isTerminal(state)).toBeNull();
    });

    it("respects best-of-5 with targetWins = 3", () => {
      const state = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { format: "best-of-5" },
      });
      expect(state.targetWins).toBe(3);
    });

    it("respects best-of-7 with targetWins = 4", () => {
      const state = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { format: "best-of-7" },
      });
      expect(state.targetWins).toBe(4);
    });
  });

  describe("Single Seat Lock & Duplicate Lock Prevention", () => {
    it("allows Seat A to lock secret choice without revealing choice to view", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      expect(res.newState.phase).toBe("locking");
      expect(res.newState.lockedSeats).toEqual(["A"]);
      expect(res.newState.secretChoices.A).toBe("rock");
      expect(res.newState.secretChoices.B).toBeUndefined();
      expect(res.effects).toEqual([{ type: "secret-locked", seat: "A", roundId: 1 }]);
    });

    it("rejects duplicate lock from the same seat with CHOICE_LOCKED", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res1 = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(res1.success).toBe(true);
      if (!res1.success) return;

      const res2 = validateAndReduce(
        res1.newState,
        { action: "secret.lock", payload: { choice: "paper" } },
        { serverTime: 1100, actorSeat: "A" },
      );

      expect(res2.success).toBe(false);
      if (res2.success) return;
      expect(res2.error.code).toBe(ErrorCode.CHOICE_LOCKED);
      // Ensure state remains completely unmutated
      expect(res1.newState.secretChoices.A).toBe("rock");
      expect(res1.newState.lockedSeats).toEqual(["A"]);
    });

    it("rejects invalid choices", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "fire" as any } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(res.success).toBe(false);
      if (res.success) return;
      expect(res.error.code).toBe(ErrorCode.INVALID_ACTION);
    });
  });

  describe("Both Seats Lock & Round Resolution", () => {
    it("resolves round when second seat locks, awarding point to winner", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // A locks Rock
      const resA = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      // B locks Scissors
      const resB = validateAndReduce(
        resA.newState,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      const state = resB.newState;
      expect(state.phase).toBe("resolved");
      expect(state.scores).toEqual({ A: 1, B: 0 });
      expect(state.roundResult).toEqual({
        roundId: 1,
        choices: { A: "rock", B: "scissors" },
        winner: "A",
      });
      expect(resB.effects).toEqual([
        { type: "secret-locked", seat: "B", roundId: 1 },
        {
          type: "round-resolved",
          roundId: 1,
          winner: "A",
          scores: { A: 1, B: 0 },
        },
      ]);
    });

    it("handles tie: scores neither, completes round and transitions to resolved", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // A locks Rock
      const resA = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      // B locks Rock
      const resB = validateAndReduce(
        resA.newState,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      const state = resB.newState;
      expect(state.phase).toBe("resolved");
      expect(state.scores).toEqual({ A: 0, B: 0 });
      expect(state.roundResult).toEqual({
        roundId: 1,
        choices: { A: "rock", B: "rock" },
        winner: "draw",
      });
      expect(resB.effects).toEqual([
        { type: "secret-locked", seat: "B", roundId: 1 },
        {
          type: "round-resolved",
          roundId: 1,
          winner: "draw",
          scores: { A: 0, B: 0 },
        },
      ]);
    });
  });

  describe("Next Round Progression & Readiness", () => {
    it("progresses to next round when both seats acknowledge secret.next in remote mode", () => {
      // Setup resolved round
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const resA = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      const resB = validateAndReduce(
        (resA as any).newState,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      state = (resB as any).newState;
      expect(state.phase).toBe("resolved");

      // Player A sends secret.next
      const nextA = validateAndReduce(
        state,
        { action: "secret.next", payload: {} },
        { serverTime: 1200, actorSeat: "A" },
      );
      expect(nextA.success).toBe(true);
      if (!nextA.success) return;
      expect(nextA.newState.phase).toBe("resolved");
      expect(nextA.newState.readiness).toEqual({ A: true, B: false });
      expect(nextA.newState.roundId).toBe(1);

      // Player B sends secret.next -> advances round!
      const nextB = validateAndReduce(
        nextA.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1250, actorSeat: "B" },
      );
      expect(nextB.success).toBe(true);
      if (!nextB.success) return;

      const round2State = nextB.newState;
      expect(round2State.phase).toBe("locking");
      expect(round2State.roundId).toBe(2);
      expect(round2State.scores).toEqual({ A: 1, B: 0 }); // Score preserved
      expect(round2State.secretChoices).toEqual({});
      expect(round2State.lockedSeats).toEqual([]);
      expect(round2State.roundResult).toBeNull();
      expect(round2State.readiness).toEqual({ A: false, B: false });
    });

    it("handles together mode reveal and progression", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const resA = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "paper" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      const resB = validateAndReduce(
        (resA as any).newState,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      state = (resB as any).newState;
      expect(state.phase).toBe("resolved");
      expect(state.revealed).toBe(false);

      // In together mode, legalAction before reveal is secret.reveal
      expect(legalActions(state, "A", "together")).toEqual(["secret.reveal"]);

      // Perform secret.reveal
      const revealRes = validateAndReduce(
        state,
        { action: "secret.reveal", payload: {} },
        { serverTime: 1150, actorSeat: "A" },
      );
      expect(revealRes.success).toBe(true);
      if (!revealRes.success) return;
      expect(revealRes.newState.revealed).toBe(true);

      // Now legal action is secret.next
      expect(legalActions(revealRes.newState, "A", "together")).toEqual(["secret.next"]);

      // In together mode, both A and B can confirm readiness, or two calls advance
      const nextA = validateAndReduce(
        revealRes.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1200, actorSeat: "A" },
      );
      expect(nextA.success).toBe(true);
      if (!nextA.success) return;

      const nextB = validateAndReduce(
        nextA.newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1250, actorSeat: "B" },
      );
      expect(nextB.success).toBe(true);
      if (!nextB.success) return;
      expect(nextB.newState.roundId).toBe(2);
      expect(nextB.newState.phase).toBe("locking");
    });
  });

  describe("Match Deciding Win & Terminal Handling", () => {
    it("ends match when a player reaches targetWins in best-of-3 (target 2)", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });

      // Round 1: A wins
      let res = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      res = validateAndReduce(
        (res as any).newState,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      state = (res as any).newState;
      expect(state.scores).toEqual({ A: 1, B: 0 });

      // Advance to Round 2
      res = validateAndReduce(
        state,
        { action: "secret.next", payload: {} },
        { serverTime: 1150, actorSeat: "A" },
      );
      res = validateAndReduce(
        (res as any).newState,
        { action: "secret.next", payload: {} },
        { serverTime: 1200, actorSeat: "B" },
      );
      state = (res as any).newState;
      expect(state.roundId).toBe(2);

      // Round 2: A wins again -> reaches 2 wins!
      res = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "paper" } },
        { serverTime: 1250, actorSeat: "A" },
      );
      res = validateAndReduce(
        (res as any).newState,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1300, actorSeat: "B" },
      );

      expect(res.success).toBe(true);
      if (!res.success) return;

      const finalState = res.newState;
      expect(finalState.phase).toBe("terminal");
      expect(finalState.scores).toEqual({ A: 2, B: 0 });
      expect(finalState.terminalResult).toEqual({
        winner: "A",
        reason: "rules_win",
        scores: { A: 2, B: 0 },
        finishedAt: 1300,
      });
      expect(isTerminal(finalState)).toEqual(finalState.terminalResult);
      expect(res.effects).toContainEqual({
        type: "game-won",
        winner: "A",
        scores: { A: 2, B: 0 },
      });

      // Subsequent moves must be rejected
      const lateMove = validateAndReduce(
        finalState,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1350, actorSeat: "B" },
      );
      expect(lateMove.success).toBe(false);
      if (lateMove.success) return;
      expect(lateMove.error.code).toBe(ErrorCode.MATCH_FINISHED);
      expect(legalActions(finalState, "A")).toEqual([]);
      expect(legalActions(finalState, "B")).toEqual([]);
    });

    it("supports best-of-5 with 3 wins target", () => {
      let state = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { format: "best-of-5" },
      });
      expect(state.targetWins).toBe(3);

      // Play 2 wins for B
      for (let r = 1; r <= 2; r++) {
        let res = validateAndReduce(
          state,
          { action: "secret.lock", payload: { choice: "rock" } },
          { serverTime: 1000 + r * 100, actorSeat: "A" },
        );
        res = validateAndReduce(
          (res as any).newState,
          { action: "secret.lock", payload: { choice: "paper" } },
          { serverTime: 1000 + r * 100 + 10, actorSeat: "B" },
        );
        state = (res as any).newState;
        expect(state.phase).toBe("resolved");

        // Advance
        res = validateAndReduce(
          state,
          { action: "secret.next", payload: {} },
          { serverTime: 1000 + r * 100 + 20, actorSeat: "A" },
        );
        res = validateAndReduce(
          (res as any).newState,
          { action: "secret.next", payload: {} },
          { serverTime: 1000 + r * 100 + 30, actorSeat: "B" },
        );
        state = (res as any).newState;
      }

      expect(state.scores).toEqual({ A: 0, B: 2 });
      expect(state.phase).toBe("locking");

      // Round 3: B wins 3rd time
      let res3 = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1500, actorSeat: "A" },
      );
      res3 = validateAndReduce(
        (res3 as any).newState,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1510, actorSeat: "B" },
      );
      expect(res3.success).toBe(true);
      if (!res3.success) return;
      expect(res3.newState.phase).toBe("terminal");
      expect(res3.newState.terminalResult?.winner).toBe("B");
      expect(res3.newState.scores).toEqual({ A: 0, B: 3 });
    });
  });

  describe("Privacy & Public View Filtering", () => {
    it("guarantees secretChoices are NEVER leaked while in locking phase", () => {
      const state0 = createInitialState({ serverTime: 1000, startingSeat: "A" });
      const res = validateAndReduce(
        state0,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(res.success).toBe(true);
      if (!res.success) return;

      const state = res.newState;
      const viewerA: ViewerContext = {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: false,
        mode: "remote",
      };
      const viewerB: ViewerContext = {
        viewerAccountId: "B",
        viewerSeat: "B",
        isController: false,
        mode: "remote",
      };

      const viewA = toPublicView(state, viewerA);
      const viewB = toPublicView(state, viewerB);

      // Verify that secretChoices does not exist on view at all
      expect((viewA as any).secretChoices).toBeUndefined();
      expect((viewB as any).secretChoices).toBeUndefined();

      // View contains lockedSeats
      expect(viewA.lockedSeats).toEqual(["A"]);
      expect(viewB.lockedSeats).toEqual(["A"]);
      expect(viewA.roundResult).toBeNull();
      expect(viewB.roundResult).toBeNull();
    });

    it("withholds roundResult in together mode until explicitly revealed", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let res = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      res = validateAndReduce(
        (res as any).newState,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      state = (res as any).newState;
      expect(state.phase).toBe("resolved");
      expect(state.revealed).toBe(false);

      const togetherViewer: ViewerContext = {
        viewerAccountId: "A",
        viewerSeat: "A",
        isController: true,
        mode: "together",
      };

      // Unrevealed in together mode -> roundResult is hidden
      const unrevealedView = toPublicView(state, togetherViewer);
      expect(unrevealedView.roundResult).toBeNull();

      // Reveal action
      const revealRes = validateAndReduce(
        state,
        { action: "secret.reveal", payload: {} },
        { serverTime: 1150, actorSeat: "A" },
      );
      expect(revealRes.success).toBe(true);
      if (!revealRes.success) return;

      // Revealed in together mode -> roundResult is now visible
      const revealedView = toPublicView(revealRes.newState, togetherViewer);
      expect(revealedView.roundResult).toEqual({
        roundId: 1,
        choices: { A: "rock", B: "scissors" },
        winner: "A",
      });
    });

    it("exposes roundResult immediately in remote mode once resolved", () => {
      let state = createInitialState({ serverTime: 1000, startingSeat: "A" });
      let res = validateAndReduce(
        state,
        { action: "secret.lock", payload: { choice: "rock" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      res = validateAndReduce(
        (res as any).newState,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      state = (res as any).newState;

      const remoteViewer: ViewerContext = {
        viewerAccountId: "B",
        viewerSeat: "B",
        isController: false,
        mode: "remote",
      };

      const view = toPublicView(state, remoteViewer);
      expect(view.roundResult).toEqual({
        roundId: 1,
        choices: { A: "rock", B: "scissors" },
        winner: "A",
      });
    });
  });

  describe("JSON Serialization Round-Trip & Adapter Verification", () => {
    it("survives JSON serialization and deserialization intact across phases", () => {
      const state = createInitialState({
        serverTime: 1000,
        startingSeat: "A",
        config: { format: "best-of-5" },
      });

      // Locking phase serialization
      const json1 = JSON.stringify(state);
      const parsed1: RPSState = JSON.parse(json1);
      expect(parsed1).toEqual(state);

      // Lock A
      const resA = validateAndReduce(
        parsed1,
        { action: "secret.lock", payload: { choice: "scissors" } },
        { serverTime: 1050, actorSeat: "A" },
      );
      expect(resA.success).toBe(true);
      if (!resA.success) return;

      const json2 = JSON.stringify(resA.newState);
      const parsed2: RPSState = JSON.parse(json2);
      expect(parsed2).toEqual(resA.newState);

      // Lock B -> Resolved
      const resB = validateAndReduce(
        parsed2,
        { action: "secret.lock", payload: { choice: "paper" } },
        { serverTime: 1100, actorSeat: "B" },
      );
      expect(resB.success).toBe(true);
      if (!resB.success) return;

      const json3 = JSON.stringify(resB.newState);
      const parsed3: RPSState = JSON.parse(json3);
      expect(parsed3).toEqual(resB.newState);
    });

    it("adheres strictly to GameEngineAdapter contract", () => {
      expect(rpsEngineAdapter.gameId).toBe("rock-paper-scissors");
      const state = rpsEngineAdapter.createInitialState({
        serverTime: 1000,
        startingSeat: "A",
      });
      expect(state.phase).toBe("locking");
      expect(rpsEngineAdapter.legalActions(state, "A")).toEqual(["secret.lock"]);
      expect(rpsEngineAdapter.isTerminal(state)).toBeNull();
    });
  });
});
