import { describe, expect, it } from "vitest";
import {
  createInitialState,
  getBoardCoordinate,
  getLegalMovesForRoll,
  getRingIndex,
  validateAndReduce,
} from "../../../../shared/games/ludo/engine";
import {
  LUDO_HOUSES,
  LUDO_HOME_COORDINATES,
  LUDO_RING_COORDINATES,
  LUDO_SAFE_SQUARES,
  type LudoState,
} from "../../../../shared/games/ludo/types";

function state(
  tokensA: [number, number, number, number],
  tokensB: [number, number, number, number] = [-1, -1, -1, -1],
): LudoState {
  return {
    ...createInitialState({ serverTime: 1, startingSeat: "A" }),
    tokens: { A: tokensA, B: tokensB },
  };
}

function roll(current: LudoState, die: number) {
  return validateAndReduce(
    current,
    { action: "dice.roll", payload: {} },
    { actorSeat: current.activeSeat, serverTime: 10, randomValues: [die] },
  );
}

function move(current: LudoState, tokenId: number) {
  return validateAndReduce(
    current,
    { action: "ludo.move", payload: { tokenId } },
    { actorSeat: current.activeSeat, serverTime: 20 },
  );
}

describe("Ludo saved selection", () => {
  it("lets either account change its own colour without touching a pending move", () => {
    const rolled = roll(state([10, -1, -1, -1]), 3);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;
    const before = rolled.newState;
    const changed = validateAndReduce(
      before,
      { action: "ludo.set-colour", payload: { colourId: "red" } },
      { actorSeat: "B", serverTime: 11 },
    );
    expect(changed.success).toBe(true);
    if (!changed.success) return;
    expect(changed.newState.colours).toEqual({ A: "blue", B: "red" });
    expect(changed.newState.tokens).toEqual(before.tokens);
    expect(changed.newState.pendingRoll).toBe(3);
    expect(changed.newState.legalTokenIds).toEqual([0]);
    expect(
      validateAndReduce(
        changed.newState,
        { action: "ludo.set-colour", payload: { colourId: "pink" } },
        { actorSeat: "A", serverTime: 12 },
      ).success,
    ).toBe(false);
    expect(
      validateAndReduce(
        changed.newState,
        { action: "ludo.set-colour", payload: { colourId: "magenta" } },
        { actorSeat: "A", serverTime: 12 },
      ).success,
    ).toBe(false);
  });
  it("requires pawn selection even for exactly one legal move and survives JSON restoration", () => {
    const rolled = roll(state([10, -1, -1, -1]), 3);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;
    expect(rolled.newState.tokens.A[0]).toBe(10);
    expect(rolled.newState.phase).toBe("choose-token");
    expect(rolled.newState.pendingRoll).toBe(3);
    expect(rolled.newState.legalTokenIds).toEqual([0]);
    const restored = JSON.parse(JSON.stringify(rolled.newState)) as LudoState;
    expect(roll(restored, 6).success).toBe(false);
    const selected = move(restored, 0);
    expect(selected.success).toBe(true);
    if (!selected.success) return;
    expect(selected.newState.tokens.A[0]).toBe(13);
    expect(selected.newState.activeSeat).toBe("B");
  });

  it("offers all legal pawns and rejects an illegal selection", () => {
    const rolled = roll(state([10, 11, -1, -1]), 3);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;
    expect(rolled.newState.legalTokenIds).toEqual([0, 1]);
    expect(move(rolled.newState, 2).success).toBe(false);
    const selected = move(rolled.newState, 1);
    expect(selected.success).toBe(true);
    if (selected.success) expect(selected.newState.tokens.A).toEqual([10, 14, -1, -1]);
  });

  it("passes on no legal move and enforces exact finish", () => {
    const noEntry = roll(state([-1, -1, -1, -1]), 4);
    expect(noEntry.success && noEntry.newState.activeSeat).toBe("B");
    if (noEntry.success) expect(noEntry.newState.lastRollNotice).toBe("no-legal-move");
    const overshoot = roll(state([54, -1, -1, -1]), 3);
    expect(overshoot.success && overshoot.newState.tokens.A[0]).toBe(54);
    expect(getLegalMovesForRoll([54, -1, -1, -1], 2)).toEqual([0]);
  });

  it("enters yard only on six, then offers bonus roll after selected move", () => {
    const rolled = roll(state([-1, -1, -1, -1]), 6);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;
    expect(rolled.newState.legalTokenIds).toEqual([0, 1, 2, 3]);
    const selected = move(rolled.newState, 2);
    expect(selected.success).toBe(true);
    if (selected.success) {
      expect(selected.newState.tokens.A[2]).toBe(0);
      expect(selected.newState.activeSeat).toBe("A");
      expect(selected.newState.phase).toBe("roll");
      expect(selected.newState.consecutiveSixes).toBe(1);
    }
  });

  it("captures exactly the lowest numbered opposing pawn on unsafe landing", () => {
    const rolled = roll(state([8, -1, -1, -1], [-1, 36, -1, 36]), 2);
    expect(rolled.success).toBe(true);
    if (!rolled.success) return;
    const selected = move(rolled.newState, 0);
    expect(selected.success).toBe(true);
    if (!selected.success) return;
    expect(selected.newState.tokens.A[0]).toBe(10);
    expect(selected.newState.tokens.B).toEqual([-1, -1, -1, 36]);
    expect(selected.effects).toContainEqual({
      type: "token-captured",
      bySeat: "A",
      byTokenId: 0,
      capturedSeat: "B",
      capturedTokenId: 1,
      ringIndex: 10,
    });
    expect(selected.newState.activeSeat).toBe("A");
  });

  it("protects a safe square and finishes on an exact selected move", () => {
    const safeRoll = roll(state([6, -1, -1, -1], [34, -1, -1, -1]), 2);
    expect(safeRoll.success).toBe(true);
    if (!safeRoll.success) return;
    const safeMove = move(safeRoll.newState, 0);
    expect(safeMove.success).toBe(true);
    if (safeMove.success) {
      expect(safeMove.newState.tokens.B[0]).toBe(34);
      expect(safeMove.effects.some((effect) => effect.type === "token-captured")).toBe(false);
    }
    const winRoll = roll(state([56, 56, 56, 52]), 4);
    expect(winRoll.success).toBe(true);
    if (!winRoll.success) return;
    const winMove = move(winRoll.newState, 3);
    expect(winMove.success).toBe(true);
    if (winMove.success) {
      expect(winMove.newState.status).toBe("completed");
      expect(winMove.terminalResult?.winner).toBe("A");
    }
  });

  it("ignores third and later six while retaining earlier accepted moves", () => {
    let current = state([0, 56, 56, 56]);
    for (const expected of [6, 12]) {
      const rolled = roll(current, 6);
      expect(rolled.success).toBe(true);
      if (!rolled.success) return;
      const selected = move(rolled.newState, 0);
      expect(selected.success).toBe(true);
      if (!selected.success) return;
      current = selected.newState;
      expect(current.tokens.A[0]).toBe(expected);
    }
    for (let index = 0; index < 2; index++) {
      const ignored = roll(current, 6);
      expect(ignored.success).toBe(true);
      if (!ignored.success) return;
      expect(ignored.newState.tokens.A[0]).toBe(12);
      expect(ignored.newState.phase).toBe("roll");
      expect(ignored.newState.lastRollNotice).toBe("ignored-six");
      expect(ignored.effects).toEqual([{ type: "dice-rolled", seat: "A", roll: 6, ignored: true }]);
      current = ignored.newState;
    }
  });
});

describe("Ludo geometry", () => {
  it("keeps a 52-cell unique ring, four houses and safe squares", () => {
    expect(LUDO_RING_COORDINATES).toHaveLength(52);
    expect(new Set(LUDO_RING_COORDINATES.map(([row, col]) => `${row},${col}`)).size).toBe(52);
    expect(Object.keys(LUDO_HOUSES)).toEqual(["A", "topRight", "bottomLeft", "B"]);
    expect(LUDO_SAFE_SQUARES).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    expect(getRingIndex("B", 0)).toBe(26);
    expect(getBoardCoordinate("A", 0)).toEqual([6, 1]);
    expect(getBoardCoordinate("B", 0)).toEqual([8, 13]);
    expect(getBoardCoordinate("A", 51)).toEqual(LUDO_HOME_COORDINATES.A[0]);
  });
});
