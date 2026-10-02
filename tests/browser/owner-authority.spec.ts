import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { login, create, view, request, action } from "./helpers";

async function remoteAction(page: Parameters<typeof view>[0], id: string, payload: unknown) {
  const current = await view(page, id);
  return request(page, `/api/v1/matches/${id}/actions`, "POST", {
    protocolVersion: 1,
    matchId: id,
    actionId: randomUUID(),
    action: "ludo.set-colour",
    payload,
    expectedVersion: current.deliveryVersion,
    turnId: current.turnId,
    controllerGeneration: current.controller.controllerGeneration,
  });
}

async function cleanupRemote(
  pageA: Parameters<typeof view>[0],
  pageB: Parameters<typeof view>[0],
  id: string,
) {
  const saved = await view(pageA, id);
  if (saved.lifecycle === "active") {
    await action(pageA, id, "match.request-abandon");
    await action(pageB, id, "match.agree-abandon");
  } else if (saved.lifecycle === "waiting") {
    await action(pageA, id, "match.cancel");
  }
}

test("remote Ludo colour changes belong to the authenticated seat and reject stale writes", async ({
  browser,
}) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  await login(a, "A");
  await login(b, "B");
  let id: string | undefined;

  try {
    id = await create(a, "ludo", "remote");
    const before = await view(b, id);
    const opponentAttempt = await remoteAction(b, id, { colourId: "purple", seat: "A" });
    expect(opponentAttempt.body.status).toBe("rejected");
    expect(opponentAttempt.body.code).toBe("INVALID_ACTION");

    const after = await view(b, id);
    expect(after.gameState.colours).toEqual(before.gameState.colours);

    await action(b, id, "match.accept");
    await action(a, id, "match.ready");
    await action(b, id, "match.ready");
    const initial = await view(a, id);
    const openingRoll = await request(a, `/api/v1/matches/${id}/actions`, "POST", {
      protocolVersion: 1,
      matchId: id,
      actionId: randomUUID(),
      action: "dice.roll",
      payload: {},
      expectedVersion: initial.deliveryVersion,
      turnId: initial.turnId,
      controllerGeneration: initial.controller.controllerGeneration,
    });
    expect(openingRoll.body.status).toBe("accepted");
    const beforeColour = await view(b, id);
    const ownColour = beforeColour.gameState.colours.B === "purple" ? "orange" : "purple";
    const ownAttempt = await remoteAction(b, id, { colourId: ownColour, seat: "A" });
    expect(ownAttempt.body.status).toBe("accepted");

    const colourChanged = await view(b, id);
    expect(colourChanged.gameState.colours).toEqual({
      ...beforeColour.gameState.colours,
      B: ownColour,
    });
    expect(colourChanged.gameState.colours.A).toBe(beforeColour.gameState.colours.A);
    expect(colourChanged.turnId).toBe(beforeColour.turnId);
    expect(colourChanged.gameState.activeSeat).toBe(beforeColour.gameState.activeSeat);
    expect(colourChanged.gameState.pendingRoll).toBe(beforeColour.gameState.pendingRoll);
    expect(colourChanged.gameState.tokens).toEqual(beforeColour.gameState.tokens);
    const staleBase = await view(a, id);
    const staleColour = await request(a, `/api/v1/matches/${id}/actions`, "POST", {
      protocolVersion: 1,
      matchId: id,
      actionId: randomUUID(),
      action: "ludo.set-colour",
      payload: { colourId: "orange" },
      expectedVersion: staleBase.deliveryVersion - 1,
      turnId: staleBase.turnId,
      controllerGeneration: staleBase.controller.controllerGeneration,
    });
    expect(staleColour.body.status).toBe("rejected");
    expect(staleColour.body.code).toBe("STALE_STATE");
    expect((await view(a, id)).gameState.colours).toEqual(colourChanged.gameState.colours);

    const staleGameplay = await request(b, `/api/v1/matches/${id}/actions`, "POST", {
      protocolVersion: 1,
      matchId: id,
      actionId: randomUUID(),
      action: "ludo.move",
      payload: { tokenId: 0 },
      expectedVersion: staleBase.deliveryVersion - 1,
      turnId: staleBase.turnId,
      controllerGeneration: staleBase.controller.controllerGeneration,
    });
    expect(staleGameplay.body.status).toBe("rejected");
    expect(staleGameplay.body.code).toBe("STALE_STATE");
    expect((await view(b, id)).gameState).toEqual(colourChanged.gameState);
  } finally {
    if (id) await cleanupRemote(a, b, id);
    await contextA.close();
    await contextB.close();
  }
});

for (const gameId of ["dots-boxes", "sos"] as const) {
  test(`${gameId} rejects an action that attempts to change the saved grid size`, async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const a = await contextA.newPage();
    const b = await contextB.newPage();
    await login(a, "A");
    await login(b, "B");
    let id: string | undefined;

    try {
      id = await create(a, gameId, "remote", { gridSize: 7 });
      await action(b, id, "match.accept");
      await action(a, id, "match.ready");
      await action(b, id, "match.ready");
      const before = await view(a, id);
      const gameplayAction = gameId === "dots-boxes" ? "dots-boxes.edge" : "sos.place";
      const gameplayPayload =
        gameId === "dots-boxes"
          ? { r1: 0, c1: 0, r2: 0, c2: 1, gridSize: 9 }
          : { row: 0, col: 0, letter: "S", gridSize: 9 };
      expect(before.lifecycle).toBe("active");
      const attempted = await request(a, `/api/v1/matches/${id}/actions`, "POST", {
        protocolVersion: 1,
        matchId: id,
        actionId: randomUUID(),
        action: gameplayAction,
        payload: gameplayPayload,
        expectedVersion: before.deliveryVersion,
        turnId: before.turnId,
        controllerGeneration: before.controller.controllerGeneration,
      });
      expect(attempted.body.status).toBe("rejected");
      expect(attempted.body.code).toBe("INVALID_ACTION");
      const after = await view(b, id);
      expect(after.deliveryVersion).toBe(before.deliveryVersion);
      expect(after.gameState.gridSize).toBe(7);
    } finally {
      if (id) await cleanupRemote(a, b, id);
      await contextA.close();
      await contextB.close();
    }
  });
}

for (const size of [3, 11, 99] as const) {
  for (const gameId of ["dots-boxes", "sos"] as const) {
    test(`${gameId} creation rejects unsupported grid size ${size}`, async ({ page }) => {
      await login(page, "A");
      const result = await request(page, "/api/v1/matches", "POST", {
        creationId: randomUUID(),
        gameId,
        mode: "together",
        gameOptions: { gridSize: size },
      });
      expect(result.r.status()).toBe(400);
    });
  }
}

for (const [A, B] of [
  ["blue", "cyan"],
  ["red", "pink"],
  ["yellow", "orange"],
] as const) {
  test(`Ludo creation rejects near-identical colours ${A}/${B}`, async ({ page }) => {
    await login(page, "A");
    const result = await request(page, "/api/v1/matches", "POST", {
      creationId: randomUUID(),
      gameId: "ludo",
      mode: "together",
      gameOptions: { colours: { A, B } },
    });
    expect(result.r.status()).toBe(400);
  });
}
