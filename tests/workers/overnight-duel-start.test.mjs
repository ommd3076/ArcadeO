import { env } from "cloudflare:workers";
import { reset, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { beforeEach, expect, it } from "vitest";
import schema from "../../migrations/0001_initial_schema.sql?raw";
import integrity from "../../migrations/0002_review_integrity.sql?raw";
import interruptedEligibility from "../../migrations/0004_sudoku_interrupted.sql?raw";
import { getPuzzleById } from "../../worker/sudoku/catalog.ts";
import { getPrivateSolution } from "../../worker/sudoku/verification.ts";

beforeEach(async () => {
  await reset();
  for (const sql of [schema, integrity, interruptedEligibility])
    for (const statement of sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .filter((part) => part.trim())) {
      if (
        statement.includes("ADD COLUMN creationPayload") &&
        (await env.DB.prepare("PRAGMA table_info(match_registry)").all()).results.some(
          (row) => row.name === "creationPayload",
        )
      )
        continue;
      await env.DB.prepare(statement).run();
    }
  for (const [id, accent] of [
    ["A", "teal"],
    ["B", "violet"],
  ]) {
    await env.DB.prepare(
      "INSERT INTO accounts(id,username,displayName,passwordHash,salt,accentFamily,paletteFamily) VALUES(?,?,?,'unused','unused',?,'standard')",
    )
      .bind(id, id, id, accent)
      .run();
    await env.DB.prepare(
      "INSERT INTO sessions(tokenHash,accountId,csrfHash,issuedAt,expiresAt,sessionId) VALUES(?,?,'unused',?,?,?)",
    )
      .bind(`token-${id}`, id, Date.now(), Date.now() + 86400000, `session-${id}`)
      .run();
  }
});

const identity = (accountId) => ({
  "X-Actor-Account": accountId,
  "X-Session-Id": `session-${accountId}`,
});

async function createDuel() {
  const puzzle = getPuzzleById("easy-001");
  const solution = puzzle && getPrivateSolution(puzzle.puzzleId);
  if (!puzzle || !solution) throw new Error("Worker Sudoku fixture puzzle is unavailable");
  const id = crypto.randomUUID();
  const stub = env.MATCH_DO.get(env.MATCH_DO.idFromName(id));
  const participants = {
    A: { accountId: "A", displayName: "A", ready: false },
    B: { accountId: "B", displayName: "B", ready: false },
  };
  const initialized = await stub.fetch("http://do/initialize", {
    method: "POST",
    headers: identity("A"),
    body: JSON.stringify({
      matchId: id,
      gameId: "sudoku",
      mode: "duel",
      creatorAccountId: "A",
      participants,
      gameOptions: { puzzleId: puzzle.puzzleId, givens: puzzle.givens, solution },
    }),
  });
  expect(initialized.status).toBe(200);
  return { id, stub };
}

async function getView(match, accountId) {
  const response = await match.stub.fetch("http://do/view", { headers: identity(accountId) });
  expect(response.status).toBe(200);
  return response.json();
}

async function submit(match, accountId, action) {
  const view = await getView(match, accountId);
  const envelope = {
    protocolVersion: 1,
    matchId: match.id,
    actionId: crypto.randomUUID(),
    action,
    payload: {},
    expectedVersion: view.deliveryVersion,
    turnId: view.turnId,
    controllerGeneration: view.controller.controllerGeneration,
  };
  const response = await match.stub.fetch("http://do/action", {
    method: "POST",
    headers: identity(accountId),
    body: JSON.stringify(envelope),
  });
  return response.json();
}

function socketFor(match, accountId) {
  return match.stub.fetch("http://do/socket", {
    headers: { ...identity(accountId), Upgrade: "websocket", Origin: env.ALLOWED_ORIGIN },
  });
}

function listen(ws) {
  const messages = [];
  const waiters = [];
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    messages.push(data);
    for (const notify of waiters) notify(data);
  });
  ws.accept();
  return {
    messages,
    next(predicate) {
      const existing = messages.find(predicate);
      if (existing) return Promise.resolve(existing);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Expected WebSocket delivery timed out")),
          5000,
        );
        waiters.push((data) => {
          if (predicate(data)) {
            clearTimeout(timer);
            resolve(data);
          }
        });
      });
    },
  };
}

it("real Worker alarm refreshes both authorized Duel sockets at the persisted start without an event or reload", async () => {
  const match = await createDuel();
  expect((await submit(match, "B", "match.accept")).status).toBe("accepted");
  expect((await submit(match, "A", "match.ready")).status).toBe("accepted");
  expect((await submit(match, "B", "match.ready")).status).toBe("accepted");

  const preStartA = await getView(match, "A");
  const preStartB = await getView(match, "B");
  const version = preStartA.deliveryVersion;
  const scheduledStartTime = preStartA.gameState.scheduledStartTime;
  expect(preStartB.deliveryVersion).toBe(version);
  expect(scheduledStartTime).toBeGreaterThan(Date.now());
  const reconstructedStart = await runInDurableObject(match.stub, (instance, state) => {
    const ReconstructedMatch = instance.constructor;
    return new ReconstructedMatch(state, instance.env).getSnapshot().gameState.scheduledStartTime;
  });
  expect(reconstructedStart).toBe(scheduledStartTime);
  for (const view of [preStartA, preStartB]) {
    expect(view.gameState.hasStarted).toBe(false);
    expect(view.gameState.givens).toBe("0".repeat(81));
    expect(view.legalActions).not.toContain("sudoku.edit");
  }

  // Both authorized sockets remain connected through the scheduled start.
  const [responseA, responseB] = await Promise.all([socketFor(match, "A"), socketFor(match, "B")]);
  expect(responseA.status).toBe(101);
  expect(responseB.status).toBe(101);
  const socketA = listen(responseA.webSocket);
  const socketB = listen(responseB.webSocket);
  const initialA = await socketA.next((message) => message.type === "snapshot");
  const initialB = await socketB.next((message) => message.type === "snapshot");
  expect(initialA.view.deliveryVersion).toBe(version);
  expect(initialB.view.deliveryVersion).toBe(version);
  expect(initialA.view.gameState.hasStarted).toBe(false);
  expect(initialB.view.gameState.hasStarted).toBe(false);

  const waitMs = Math.max(0, scheduledStartTime - Date.now() + 250);
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  const startedA = await socketA.next(
    (message) => message.type === "snapshot" && message.view.gameState.hasStarted,
  );
  const startedB = await socketB.next(
    (message) => message.type === "snapshot" && message.view.gameState.hasStarted,
  );
  for (const view of [startedA.view, startedB.view]) {
    expect(view.deliveryVersion).toBe(version);
    expect(view.controller.isController).toBe(true);
    expect(view.gameState.givens).not.toBe("0".repeat(81));
    expect(view.legalActions).toContain("sudoku.edit");
    expect(view.gameState.self.cells).toHaveLength(81);
    expect(view.gameState.opponent.cells).toBeUndefined();
  }
  expect(startedA.view.gameState.solution).toBeUndefined();
  expect(startedB.view.gameState.solution).toBeUndefined();
  await runInDurableObject(match.stub, async (_instance, state) => {
    expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM events").one().n).toBe(3);
    expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM action_receipts").one().n).toBe(3);
    expect(await state.storage.getAlarm()).toBe(null);
  });
});

it.each(["saved", "terminal"])(
  "does not publish a scheduled start snapshot for a %s Duel",
  async (endState) => {
    const match = await createDuel();
    expect((await submit(match, "B", "match.accept")).status).toBe("accepted");
    expect((await submit(match, "A", "match.ready")).status).toBe("accepted");
    expect((await submit(match, "B", "match.ready")).status).toBe("accepted");

    const [responseA, responseB] = await Promise.all([
      socketFor(match, "A"),
      socketFor(match, "B"),
    ]);
    expect(responseA.status).toBe(101);
    expect(responseB.status).toBe(101);
    const socketA = listen(responseA.webSocket);
    const socketB = listen(responseB.webSocket);
    const initialA = await socketA.next((message) => message.type === "snapshot");
    const initialB = await socketB.next((message) => message.type === "snapshot");
    expect(initialA.view.gameState.hasStarted).toBe(false);
    expect(initialB.view.gameState.hasStarted).toBe(false);

    const action = endState === "saved" ? "match.leave-save" : "match.resign";
    const ended = await submit(match, "A", action);
    expect(ended.status).toBe("accepted");
    const expectedLifecycle = endState === "saved" ? "saved" : "resigned";
    await socketA.next(
      (message) => message.type === "event" && message.view.lifecycle === expectedLifecycle,
    );
    await socketB.next(
      (message) => message.type === "event" && message.view.lifecycle === expectedLifecycle,
    );
    const messageCounts = [socketA.messages.length, socketB.messages.length];

    // Simulate a stale wakeup racing with an explicit save or terminal result.
    await runInDurableObject(match.stub, async (_instance, state) => {
      await state.storage.setAlarm(Date.now() - 1);
    });
    await runDurableObjectAlarm(match.stub);
    expect(socketA.messages).toHaveLength(messageCounts[0]);
    expect(socketB.messages).toHaveLength(messageCounts[1]);
    const viewA = await getView(match, "A");
    expect(viewA.lifecycle).toBe(expectedLifecycle);
    expect(viewA.legalActions).not.toContain("sudoku.edit");
  },
);
