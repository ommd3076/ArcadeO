import { describe, expect, it } from "vitest";
import {
  createInitialState,
  isTerminal,
  toPublicView,
  validateAndReduce,
} from "../../../../shared/games/hand-cricket/engine";
import type { CricketState } from "../../../../shared/games/hand-cricket/types";
import type { ActionType, Seat } from "../../../../shared/protocol/types";

function accept(
  state: CricketState,
  action: ActionType,
  payload: unknown = {},
  actorSeat: Seat = "A",
) {
  const result = validateAndReduce(
    state,
    { action, payload },
    { actorSeat, serverTime: 2000 + state.deliveryId },
  );
  if (!result.success) throw new Error(result.error.message);
  return result.newState;
}

function start(batter: Seat): CricketState {
  return accept(
    createInitialState({
      serverTime: 1000,
      startingSeat: batter,
      config: { rulesVersion: 2, mode: "together" },
    }),
    "cricket.choose-role",
    { role: "bat" },
    batter,
  );
}

function ball(state: CricketState, bat: number, bowl: number): CricketState {
  const first = accept(state, "secret.lock", { value: bat }, state.roles!.bat);
  return accept(first, "secret.lock", { value: bowl }, state.roles!.bowl);
}

function next(state: CricketState): CricketState {
  return accept(accept(state, "secret.reveal"), "secret.next");
}

describe("Together Hand Cricket: bat until out", () => {
  it.each<Seat>(["A", "B"])(
    "keeps %s batting across scoring balls, swaps only after out, and finishes after both outs",
    (batter) => {
      let state = start(batter);
      const bowler = state.roles!.bowl;
      for (const [bat, bowl, total] of [
        [7, 3, 7],
        [4, 1, 11],
      ]) {
        const before = state.firstInningsRuns;
        state = ball(state, bat, bowl);
        expect(state.roles).toEqual({ bat: batter, bowl: bowler });
        expect(toPublicView(state).lastDelivery).toBeNull();
        expect(toPublicView(state).firstInningsRuns).toBe(before);
        state = accept(state, "secret.reveal");
        expect(toPublicView(state).firstInningsRuns).toBe(total);
        expect(toPublicView(state).lastDelivery?.scoredRuns).toBe(bat);
        state = accept(state, "secret.next");
        expect(state.revealed).toBe(false);
        expect(toPublicView(state).revealed).toBe(false);
        expect(toPublicView(state).expectedChooser).toBe(batter);
        expect(state.lastDelivery).toBeNull();
      }

      state = ball(state, 10, 10);
      expect(state.firstInningsRuns).toBe(11);
      expect(state.roles!.bat).toBe(batter);
      expect(state.lastDelivery?.scoredRuns).toBe(0);
      state = next(state);
      expect(state.roles).toEqual({ bat: bowler, bowl: batter });
      expect(toPublicView(state).target).toBeNull();

      state = next(ball(state, 10, 3));
      state = next(ball(state, 7, 2));
      expect(state.secondInningsRuns).toBe(17);
      expect(state.phase).toBe("second_innings");
      expect(isTerminal(state)).toBeNull();
      expect(state.roles!.bat).toBe(bowler);

      state = ball(state, 5, 5);
      expect(isTerminal(state)).toBeNull();
      expect(toPublicView(state).terminalResult).toBeUndefined();
      state = accept(state, "secret.reveal");
      expect(isTerminal(state)?.winner).toBe(bowler);
      expect(isTerminal(state)?.scores).toEqual({ [batter]: 11, [bowler]: 17 });
    },
  );

  it("draws when both batting totals are equal", () => {
    let state = next(ball(start("A"), 3, 1));
    state = next(ball(state, 4, 4));
    state = next(ball(state, 3, 1));
    state = accept(ball(state, 8, 8), "secret.reveal");
    expect(isTerminal(state)).toMatchObject({
      winner: null,
      reason: "rules_draw",
      scores: { A: 3, B: 3 },
    });
  });

  it("restores a playable public view for old saved balls with a stale reveal flag", () => {
    const state = { ...start("B"), revealed: true, deliveryId: 2, firstInningsRuns: 7 };
    expect(toPublicView(state)).toMatchObject({
      revealed: false,
      expectedChooser: "B",
      lockedSeats: [],
      lastDelivery: null,
    });
  });

  it("keeps an unrevealed old chase-winning ball playable without changing completed results", () => {
    const state = ball(next(ball(start("A"), 1, 1)), 7, 3);
    const oldPending: CricketState = {
      ...state,
      phase: "terminal",
      terminalResult: {
        winner: "B",
        reason: "rules_win",
        scores: { A: 0, B: 7 },
        finishedAt: 1000,
      },
    };
    const revealed = accept(oldPending, "secret.reveal");
    expect(revealed.phase).toBe("second_innings");
    expect(revealed.secondInningsRuns).toBe(7);
    expect(isTerminal(revealed)).toBeNull();
    expect(accept(revealed, "secret.next").roles?.bat).toBe("B");
    const completed = { ...oldPending, revealed: true };
    expect(isTerminal(completed)).toEqual(oldPending.terminalResult);
    expect(
      validateAndReduce(
        completed,
        { action: "secret.next", payload: {} },
        { actorSeat: "A", serverTime: 3000 },
      ).success,
    ).toBe(false);
  });
});
