import { describe, expect, it } from "vitest";
import * as rps from "../../../../shared/games/rps/engine";
import * as cricket from "../../../../shared/games/hand-cricket/engine";
import { ActionType } from "../../../../shared/protocol/types";
const facts = { serverTime: 1000, startingSeat: "A" as const, config: { mode: "together" } };
const viewer = {
  viewerAccountId: "A" as const,
  viewerSeat: "A" as const,
  isController: true,
  mode: "together" as const,
};
function reduce(engine: any, state: any, action: ActionType, payload: any = {}, seat = "A") {
  const result = engine.validateAndReduce(
    state,
    { action, payload },
    { actorSeat: seat, serverTime: 2000 },
  );
  expect(result.success).toBe(true);
  return result;
}
describe("Together secret rules review regressions", () => {
  it("RPS masks winning score/result even final round and commits terminal only after reveal", () => {
    let state = rps.createInitialState(facts);
    state.scores.A = 1;
    state = reduce(rps, state, "secret.lock", { choice: "rock" }).newState;
    const second = reduce(rps, state, "secret.lock", { choice: "scissors" }, "B");
    state = second.newState;
    expect(second.terminalResult).toBeUndefined();
    expect(state.terminalResult?.winner).toBe("A");
    expect(rps.isTerminal(state)).toBeNull();
    const view = rps.toPublicView(state, viewer);
    expect(view.scores.A).toBe(1);
    expect(view.roundResult).toBeNull();
    expect(view.terminalResult).toBeUndefined();
    expect(rps.legalActions(state, "A")).toEqual(["secret.reveal"]);
    state = reduce(rps, JSON.parse(JSON.stringify(state)), "secret.reveal").newState;
    expect(rps.isTerminal(state)?.winner).toBe("A");
  });
  it("one together Next advances the revealed RPS round; unrevealed Next fails", () => {
    let state = rps.createInitialState(facts);
    state = reduce(rps, state, "secret.lock", { choice: "rock" }).newState;
    state = reduce(rps, state, "secret.lock", { choice: "rock" }, "B").newState;
    expect(
      rps.validateAndReduce(
        state,
        { action: "secret.next", payload: {} },
        { actorSeat: "A", serverTime: 2000 },
      ).success,
    ).toBe(false);
    state = reduce(rps, state, "secret.reveal").newState;
    state = reduce(rps, state, "secret.next").newState;
    expect(state.roundId).toBe(2);
    expect(state.lockedSeats).toEqual([]);
  });
  it("Cricket hides dismissal/target until reveal, one Next swaps innings, monotonic delivery IDs prevent reuse", () => {
    let state = cricket.createInitialState(facts);
    state = reduce(cricket, state, "cricket.choose-role", { role: "bat" }).newState;
    state = reduce(cricket, state, "secret.lock", { value: 1 }).newState;
    state = reduce(cricket, state, "secret.lock", { value: 1 }, "B").newState;
    expect(cricket.toPublicView(state, viewer).lastDelivery).toBeNull();
    expect(cricket.toPublicView(state, viewer).target).toBeNull();
    expect(cricket.legalActions(state, "A")).toEqual(["secret.reveal"]);
    state = reduce(cricket, state, "secret.reveal").newState;
    state = reduce(cricket, state, "secret.next").newState;
    expect(state.innings).toBe(2);
    expect(state.deliveryId).toBe(2);
    state = reduce(cricket, state, "secret.lock", { value: 2 }).newState;
    const finish = reduce(cricket, state, "secret.lock", { value: 1 }, "B");
    state = finish.newState;
    expect(finish.terminalResult).toBeUndefined();
    expect(cricket.isTerminal(state)).toBeNull();
    const view = cricket.toPublicView(state, viewer);
    expect(view.secondInningsRuns).toBe(0);
    expect(view.terminalResult).toBeUndefined();
    expect(view.lastDelivery).toBeNull();
    const reveal = reduce(cricket, JSON.parse(JSON.stringify(state)), "secret.reveal");
    expect(reveal.terminalResult?.winner).toBe("B");
    expect(cricket.isTerminal(reveal.newState)?.winner).toBe("B");
  });
  it("Cricket hides newly scored runs until explicit reveal", () => {
    let state = cricket.createInitialState(facts);
    state = reduce(cricket, state, "cricket.choose-role", { role: "bat" }).newState;
    state = reduce(cricket, state, "secret.lock", { value: 6 }).newState;
    state = reduce(cricket, state, "secret.lock", { value: 1 }, "B").newState;
    expect(state.firstInningsRuns).toBe(6);
    expect(cricket.toPublicView(state, viewer).firstInningsRuns).toBe(0);
  });
});
