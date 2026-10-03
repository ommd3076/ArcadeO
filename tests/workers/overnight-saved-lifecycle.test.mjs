import { env } from "cloudflare:workers";
import { runInDurableObject, runDurableObjectAlarm, reset } from "cloudflare:test";
import { beforeEach, it, expect } from "vitest";
import schema from "../../migrations/0001_initial_schema.sql?raw";
import integrity from "../../migrations/0002_review_integrity.sql?raw";
import interruptedEligibility from "../../migrations/0004_sudoku_interrupted.sql?raw";

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

async function createMatch(mode = "together") {
  const id = crypto.randomUUID();
  const stub = env.MATCH_DO.get(env.MATCH_DO.idFromName(id));
  const participants = {
    A: { accountId: "A", displayName: "A", ready: true },
    B: { accountId: "B", displayName: "B", ready: true },
  };
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO match_registry(matchId,creationId,creatorAccountId,gameId,mode,participants,doName,initializationState,lifecycle,deliveryVersion,schemaVersion,rulesVersion,createdAt,lastActionAt) VALUES(?,?, 'A','connect-four',?,?,?,'initialized','active',0,1,1,?,?)",
  )
    .bind(id, crypto.randomUUID(), mode, JSON.stringify(participants), id, now, now)
    .run();
  await env.DB.prepare(
    "INSERT INTO active_slots(slotKey,matchId,creationId,reservedAt) VALUES(?,?,?,?)",
  )
    .bind(`connect-four:${mode}:${id}`, id, id, now)
    .run();
  const response = await stub.fetch("http://do/initialize", {
    method: "POST",
    headers: { "X-Actor-Account": "A", "X-Session-Id": "session-A" },
    body: JSON.stringify({
      matchId: id,
      gameId: "connect-four",
      mode,
      creatorAccountId: "A",
      participants,
    }),
  });
  expect(response.status).toBe(200);
  return { id, stub };
}

async function getView(match, actor = "A") {
  const response = await match.stub.fetch("http://do/view", {
    headers: { "X-Actor-Account": actor, "X-Session-Id": `session-${actor}` },
  });
  expect(response.status).toBe(200);
  return response.json();
}

async function submit(match, action, payload = {}, actor = "A") {
  const current = await getView(match, actor);
  const envelope = {
    protocolVersion: 1,
    matchId: match.id,
    actionId: crypto.randomUUID(),
    action,
    payload,
    expectedVersion: current.deliveryVersion,
    turnId: current.turnId,
    controllerGeneration: current.controller.controllerGeneration,
  };
  const response = await match.stub.fetch("http://do/action", {
    method: "POST",
    headers: { "X-Actor-Account": actor, "X-Session-Id": `session-${actor}` },
    body: JSON.stringify(envelope),
  });
  return response.json();
}

async function activateRemoteMatch(match) {
  expect((await submit(match, "match.accept", {}, "B")).status).toBe("accepted");
  expect((await submit(match, "match.ready", {}, "A")).status).toBe("accepted");
  const ready = await submit(match, "match.ready", {}, "B");
  expect(ready.status).toBe("accepted");
  expect(ready.view.lifecycle).toBe("active");
}

it("real Worker alarm preserves a saved match with legacy expiry metadata older than 72 hours", async () => {
  const match = await createMatch();
  const saved = await submit(match, "match.leave-save");
  expect(saved.status).toBe("accepted");
  expect(saved.view.lifecycle).toBe("saved");

  const savedAt = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const expiredAt = savedAt + 72 * 60 * 60 * 1000;
  await runInDurableObject(match.stub, (_instance, state) => {
    state.storage.sql
      .exec("UPDATE match_snapshot SET savedAt = ?, expiresAt = ?", savedAt, expiredAt)
      .toArray();
    state.storage.setAlarm(Date.now() - 1);
  });

  expect(await runDurableObjectAlarm(match.stub)).toBe(true);
  const afterAlarm = await getView(match);
  expect(afterAlarm.lifecycle).toBe("saved");
  expect(afterAlarm.savedAt).toBe(savedAt);
  const persistedTimes = await runInDurableObject(match.stub, (_instance, state) =>
    state.storage.sql.exec("SELECT savedAt, expiresAt FROM match_snapshot").one(),
  );
  expect(persistedTimes.savedAt).toBe(savedAt);
  expect(persistedTimes.expiresAt).toBe(expiredAt);
  expect(
    (await env.DB.prepare("SELECT matchId FROM active_slots WHERE matchId = ?").bind(match.id).first())
      ?.matchId,
  ).toBe(match.id);
});

it("a real Durable Object closes a revoked native session before accepting its next socket write", async () => {
  const match = await createMatch();
  const socketResponse = await match.stub.fetch("http://do/socket", {
    headers: {
      Upgrade: "websocket",
      Origin: env.ALLOWED_ORIGIN,
      "X-Actor-Account": "A",
      "X-Session-Id": "session-A",
    },
  });
  expect(socketResponse.status).toBe(101);
  const socket = socketResponse.webSocket;
  const initialView = await getView(match);
  const envelope = {
    protocolVersion: 1,
    matchId: match.id,
    actionId: crypto.randomUUID(),
    action: "connect-four.drop",
    payload: { column: 0 },
    expectedVersion: initialView.deliveryVersion,
    turnId: initialView.turnId,
    controllerGeneration: initialView.controller.controllerGeneration,
  };
  const initialSnapshot = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Initial authenticated snapshot timed out")), 5000);
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timer);
        resolve(JSON.parse(event.data));
      },
      { once: true },
    );
  });
  socket.accept();
  const firstFrame = await initialSnapshot;
  expect(firstFrame.type).toBe("snapshot");

  await env.DB.prepare("UPDATE sessions SET revokedAt = ? WHERE sessionId = 'session-A'")
    .bind(Date.now())
    .run();
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Revoked socket remained open")), 5000);
    socket.addEventListener(
      "close",
      (event) => {
        clearTimeout(timer);
        resolve(event.code);
      },
      { once: true },
    );
  });
  socket.send(JSON.stringify({ type: "action", envelope }));
  expect(await closed).toBe(1008);
  await runInDurableObject(match.stub, (_instance, state) => {
    const snapshot = state.storage.sql
      .exec("SELECT deliveryVersion FROM match_snapshot")
      .one();
    expect(snapshot.deliveryVersion).toBe(initialView.deliveryVersion);
    expect(state.storage.sql.exec("SELECT COUNT(*) AS n FROM action_receipts").one().n).toBe(0);
  });
});

it("an actual Worker alarm does not forfeit a disconnected Remote match after stale legacy contact", async () => {
  const match = await createMatch("remote");
  await activateRemoteMatch(match);
  const accepted = await submit(match, "connect-four.drop", { column: 0 });
  expect(accepted.status).toBe("accepted");
  const acceptedVersion = accepted.view.deliveryVersion;

  const socketResponse = await match.stub.fetch("http://do/socket", {
    headers: {
      Upgrade: "websocket",
      Origin: env.ALLOWED_ORIGIN,
      "X-Actor-Account": "A",
      "X-Session-Id": "session-A",
    },
  });
  expect(socketResponse.status).toBe(101);
  const socket = socketResponse.webSocket;
  const initialSnapshot = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Reconnect snapshot timed out")), 5000);
    socket.addEventListener(
      "message",
      (event) => {
        clearTimeout(timer);
        resolve(JSON.parse(event.data));
      },
      { once: true },
    );
  });
  socket.accept();
  expect((await initialSnapshot).type).toBe("snapshot");
  const closed = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Disconnected socket did not close")), 5000);
    socket.addEventListener(
      "close",
      () => {
        clearTimeout(timer);
        resolve(undefined);
      },
      { once: true },
    );
  });
  socket.close(1000, "Synthetic disconnect fixture");
  await closed;

  const now = Date.now();
  await runInDurableObject(match.stub, (_instance, state) => {
    // Match the deleted pre-approval disconnect policy's exact in-memory clock inputs.
    _instance.seatLastContact = { A: now - 31 * 60 * 1000, B: now };
    state.storage.setAlarm(Date.now() - 1);
  });

  expect(await runDurableObjectAlarm(match.stub)).toBe(true);
  const afterAlarm = await getView(match);
  expect(afterAlarm.lifecycle).toBe("active");
  expect(afterAlarm.deliveryVersion).toBe(acceptedVersion);
  const authorityAfterAlarm = await runInDurableObject(match.stub, (_instance, state) =>
    state.storage.sql.exec("SELECT lifecycle, deliveryVersion, result FROM match_snapshot").one(),
  );
  expect(authorityAfterAlarm).toMatchObject({
    lifecycle: "active",
    deliveryVersion: acceptedVersion,
    result: null,
  });
  expect(
    (await env.DB.prepare("SELECT matchId FROM active_slots WHERE matchId = ?").bind(match.id).first())
      ?.matchId,
  ).toBe(match.id);

  const peerMove = await submit(match, "connect-four.drop", { column: 1 }, "B");
  expect(peerMove.status).toBe("accepted");
  expect(peerMove.view.deliveryVersion).toBe(acceptedVersion + 1);
});

it("an explicit two-sided abandon releases the real active slot", async () => {
  const match = await createMatch("remote");
  await activateRemoteMatch(match);
  const request = await submit(match, "match.request-abandon");
  expect(request.status).toBe("accepted");
  expect(request.view.lifecycle).toBe("active");
  const agreement = await submit(match, "match.agree-abandon", {}, "B");
  expect(agreement.status).toBe("accepted");
  expect(agreement.view.lifecycle).toBe("abandoned");
  await runInDurableObject(match.stub, async (instance) => instance.flushProjectionOutbox());
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS count FROM active_slots WHERE matchId = ?")
      .bind(match.id)
      .first("count"),
  ).toBe(0);
});
