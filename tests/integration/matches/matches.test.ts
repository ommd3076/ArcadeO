import { createSession } from "../../../worker/auth/session";
import { describe, it, expect, beforeEach } from "vitest";
import { apiFixture } from "./api-fixture";

describe("Match API contract with real SQLite adapters (not Workers runtime)", () => {
  let f: Awaited<ReturnType<typeof apiFixture>>;
  beforeEach(async () => {
    f = await apiFixture();
  });
  it("reserves one slot and rejects a concurrent different creation", async () => {
    const results = await Promise.all([f.create(), f.create()]);
    expect(results.map((result) => result.response.status).sort()).toEqual([201, 409]);
    expect(f.sqlite.prepare("SELECT COUNT(*) AS n FROM active_slots").get()?.n).toBe(1);
    expect(f.sqlite.prepare("SELECT COUNT(*) AS n FROM match_registry").get()?.n).toBe(1);
  });
  it("returns same creation and rejects changed payload or different creator", async () => {
    const first = await f.create();
    const again = await f.create("together", "connect-four", first.creationId);
    expect(again.response.status).toBe(200);
    expect(again.match.matchId).toBe(first.match.matchId);
    expect((await f.create("remote", "connect-four", first.creationId)).response.status).toBe(409);
    expect(
      (await f.create("together", "connect-four", first.creationId, "B")).response.status,
    ).toBe(409);
  });
  it("returns existingMatchId and human-readable error when slot is occupied", async () => {
    const first = await f.create("together", "connect-four");
    expect(first.response.status).toBe(201);
    const second = await f.create("together", "connect-four");
    expect(second.response.status).toBe(409);
    expect(second.match.code).toBe("SLOT_OCCUPIED");
    expect(second.match.existingMatchId).toBe(first.match.matchId);
    expect(second.match.error).toBe("A match is already in progress for this game mode.");
  });
  it("cleans up active slot if match_registry records the previous match as terminal", async () => {
    const first = await f.create("together", "connect-four");
    expect(first.response.status).toBe(201);
    f.sqlite
      .prepare("UPDATE match_registry SET lifecycle = 'abandoned' WHERE matchId = ?")
      .run(first.match.matchId);
    const second = await f.create("together", "connect-four");
    expect(second.response.status).toBe(201);
    expect(second.match.matchId).not.toBe(first.match.matchId);
  });
  it("abandons together match and frees slot allowing new creation", async () => {
    const first = await f.create("together", "connect-four");
    expect(first.response.status).toBe(201);
    const abandonResult = await f.action(first.match.matchId, "match.agree-abandon", "A");
    expect(abandonResult.reply.status).toBe("accepted");
    expect(abandonResult.reply.view.lifecycle).toBe("abandoned");
    const second = await f.create("together", "connect-four");
    expect(second.response.status).toBe(201);
  });
  it("repairs a reserved creation after failed authority initialization", async () => {
    const id = crypto.randomUUID();
    const actual = f.env.MATCH_DO;
    f.env.MATCH_DO = {
      idFromName: actual.idFromName,
      get: () => ({ fetch: async () => new Response("failure", { status: 503 }) }),
    };
    expect((await f.create("together", "connect-four", id)).response.status).toBe(500);
    f.env.MATCH_DO = actual;
    const repaired = await f.create("together", "connect-four", id);
    expect(repaired.response.status).toBe(200);
    expect(repaired.match.view.lifecycle).toBe("active");
  });
  it("requires explicit accept then both readiness acknowledgments", async () => {
    const { match } = await f.create("remote");
    expect(
      (await f.action(match.matchId, "connect-four.drop", "A", { column: 0 })).reply.status,
    ).toBe("rejected");
    expect((await f.action(match.matchId, "match.accept", "A")).reply.code).toBe("FORBIDDEN");
    expect((await f.action(match.matchId, "match.accept", "B")).reply.view.lifecycle).toBe(
      "waiting",
    );
    expect((await f.action(match.matchId, "match.ready", "A")).reply.view.lifecycle).toBe(
      "waiting",
    );
    expect((await f.action(match.matchId, "match.ready", "B")).reply.view.lifecycle).toBe("active");
    expect(
      (await f.action(match.matchId, "connect-four.drop", "B", { column: 0 })).reply.code,
    ).toBe("NOT_YOUR_TURN");
  });
  it("finishes Connect Four once, refreshes saved result and projects/releases slot", async () => {
    const { match } = await f.create();
    let last: any;
    for (const column of [0, 1, 0, 1, 0, 1, 0]) {
      last = (await f.action(match.matchId, "connect-four.drop", "A", { column })).reply;
      expect(last.status).toBe("accepted");
    }
    expect(last.view.lifecycle).toBe("completed");
    expect(last.view.result.winner).toBe("A");
    expect(
      (await f.action(match.matchId, "connect-four.drop", "A", { column: 2 })).reply.code,
    ).toBe("MATCH_FINISHED");
    const authority = f.namespace._instances.get(match.matchId)!.do;
    await authority.flushProjectionOutbox();
    expect(f.sqlite.prepare("SELECT COUNT(*) AS n FROM results").get()?.n).toBe(1);
    expect(f.sqlite.prepare("SELECT COUNT(*) AS n FROM active_slots").get()?.n).toBe(0);
    expect(((await (await f.request(`/${match.matchId}`)).json()) as any).result.winner).toBe("A");
  });
  it("enforces exact Origin and session revocation on new writes", async () => {
    expect(
      (
        await f.request(
          "",
          "A",
          { creationId: crypto.randomUUID(), gameId: "connect-four", mode: "together" },
          "https://evil.example",
        )
      ).status,
    ).toBe(403);
    const { match } = await f.create();
    const envelope = {
      protocolVersion: 1,
      matchId: match.matchId,
      actionId: crypto.randomUUID(),
      action: "connect-four.drop",
      payload: { column: 0 },
      expectedVersion: 1,
      turnId: 1,
      controllerGeneration: 1,
    };
    await f.DB.prepare("UPDATE sessions SET revokedAt=? WHERE sessionId=?")
      .bind(Date.now(), f.sessions.A.sessionId)
      .run();
    expect((await f.request(`/${match.matchId}/actions`, "A", envelope)).status).toBe(401);
    expect(f.namespace._instances.get(match.matchId)!.do.getSnapshot()?.deliveryVersion).toBe(1);
  });
  it("creates Sudoku from private catalog rather than supplied solution", async () => {
    const { response, match } = await f.create("practice", "sudoku", crypto.randomUUID(), "A", {
      puzzleId: "easy-001",
      solution: "1".repeat(81),
    });
    expect(response.status).toBe(201);
    expect(match.view.lifecycle).toBe("active");
    expect(JSON.stringify(match.view)).not.toContain("solution");
    expect(
      (f.namespace._instances.get(match.matchId)!.do.getSnapshot()?.gameState as any).solution,
    ).not.toBe("1".repeat(81));
  });
  it("tombstones an expired uninitialized reservation before admitting a replacement", async () => {
    const id = crypto.randomUUID();
    const actual = f.env.MATCH_DO;
    f.env.MATCH_DO = {
      idFromName: actual.idFromName,
      get: () => ({ fetch: async () => new Response("failure", { status: 503 }) }),
    };
    const failed = await f.create("together", "connect-four", id);
    expect(failed.response.status).toBe(500);
    f.env.MATCH_DO = actual;
    f.sqlite.exec("UPDATE active_slots SET reservedAt=0");
    const replacement = await f.create();
    expect(replacement.response.status).toBe(201);
    const old = f.sqlite
      .prepare("SELECT matchId FROM match_registry WHERE creationId=?")
      .get(id) as { matchId: string };
    await expect(
      actual.get(actual.idFromName(old.matchId)).fetch(
        new Request("https://internal/initialize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: old.matchId,
            gameId: "connect-four",
            mode: "together",
            creatorAccountId: "A",
            participants: {
              A: { accountId: "A", displayName: "A", ready: true },
              B: { accountId: "B", displayName: "B", ready: true },
            },
          }),
        }),
      ),
    ).rejects.toThrow("Reservation expired");
    expect(f.sqlite.prepare("SELECT COUNT(*) AS n FROM active_slots").get()?.n).toBe(1);
  });
  it("abandons solo practice immediately without score and releases its saved slot", async () => {
    const { match } = await f.create("practice", "sudoku", crypto.randomUUID(), "A", {
      puzzleId: "easy-001",
    });
    expect(match.view.participants.B).toBeUndefined();
    const abandoned = await f.action(match.matchId, "match.request-abandon");
    expect(abandoned.reply.status).toBe("accepted");
    expect(abandoned.reply.view.lifecycle).toBe("abandoned");
    expect(abandoned.reply.view.result.winner).toBeNull();
    expect(abandoned.reply.view.result.details.scored).toBe(false);
    const authority = f.namespace._instances.get(match.matchId)!.do;
    await authority.flushProjectionOutbox();
    expect(
      f.sqlite.prepare("SELECT COUNT(*) AS n FROM active_slots WHERE matchId=?").get(match.matchId)
        ?.n,
    ).toBe(0);
    expect(
      f.sqlite
        .prepare("SELECT COUNT(*) AS n FROM sudoku_records WHERE attemptId=?")
        .get(match.matchId)?.n,
    ).toBe(0);
    const refresh = (await (await f.request(`/${match.matchId}`)).json()) as any;
    expect(refresh.lifecycle).toBe("abandoned");
    expect(
      (await f.action(match.matchId, "sudoku.edit", "A", { row: 0, col: 0, operation: "erase" }))
        .reply.code,
    ).toBe("MATCH_FINISHED");
    expect((await f.create("practice", "sudoku")).response.status).toBe(201);
  });
  it("keeps legacy solo attempts private across reads, sockets, actions, receipts and discovery", async () => {
    const { match } = await f.create("practice", "sudoku");
    const item = f.namespace._instances.get(match.matchId)!;
    const oldParts = {
      A: { accountId: "A", displayName: "A", ready: true },
      B: { accountId: "B", displayName: "B", ready: true },
    };
    item.sqlite.prepare("UPDATE match_snapshot SET participants=?").run(JSON.stringify(oldParts));
    f.sqlite
      .prepare("UPDATE match_registry SET participants=? WHERE matchId=?")
      .run(JSON.stringify(oldParts), match.matchId);
    expect((await f.request(`/${match.matchId}`, "B")).status).toBe(403);
    const receipts = await f.request(`/${match.matchId}/receipts/${crypto.randomUUID()}`, "B");
    expect(JSON.stringify(await receipts.json())).not.toContain("gameState");
    const attempted = await f.action(match.matchId, "match.request-abandon", "B");
    expect(attempted.reply.code).toBe("FORBIDDEN");
    expect(attempted.reply.latestView).toBeUndefined();
    const socket = await item.do.fetch(
      new Request("https://internal/socket", {
        headers: {
          Upgrade: "websocket",
          Origin: f.env.ALLOWED_ORIGIN,
          "X-Actor-Account": "B",
          "X-Session-Id": f.sessions.B.sessionId,
        },
      }),
    );
    expect(socket.status).toBe(403);
    const discovered = (await (await f.request("", "B")).json()) as any;
    expect(discovered.matches.some((row: any) => row.matchId === match.matchId)).toBe(false);
    expect(item.do.getSnapshot()!.lifecycle).toBe("active");
  });
  it("projects together control by the viewing session and changes it only on explicit takeover", async () => {
    const { match } = await f.create();
    const previous = f.sessions.A;
    const moved = await f.action(match.matchId, "connect-four.drop", "A", { column: 0 });
    expect(moved.reply.view.controller.isController).toBe(true);
    f.sessions.A = await createSession(f.DB, "A", f.env.CSRF_SECRET);
    const alternate = (await (await f.request(`/${match.matchId}`)).json()) as any;
    expect(alternate.controller.isController).toBe(false);
    expect(alternate.legalActions).toEqual([]);
    expect(JSON.stringify(alternate)).not.toContain(previous.sessionId);
    const receipt = (await (
      await f.request(`/${match.matchId}/receipts/${moved.envelope.actionId}`)
    ).json()) as any;
    expect(receipt.view.controller.isController).toBe(false);
    const takeover = (await (
      await f.request(`/${match.matchId}/controller`, "A", { expectedControllerGeneration: 1 })
    ).json()) as any;
    expect(takeover.view.controller.isController).toBe(true);
    f.sessions.A = previous;
    const old = (await (await f.request(`/${match.matchId}`)).json()) as any;
    expect(old.controller.isController).toBe(false);
    expect(
      (await f.action(match.matchId, "connect-four.drop", "A", { column: 1 })).reply.code,
    ).toBe("CONTROL_TRANSFERRED");
  });
  it("broadcasts per-session filtered takeover controllers without private IDs", async () => {
    const { match } = await f.create();
    const oldSession = f.sessions.A;
    const nextSession = await createSession(f.DB, "A", f.env.CSRF_SECRET);
    const item = f.namespace._instances.get(match.matchId)!;
    const oldMessages: string[] = [];
    const newMessages: string[] = [];
    const socket = (sessionId: string, messages: string[]) => ({
      readyState: 1,
      deserializeAttachment: () => ({ accountId: "A", sessionId }),
      send: (message: string) => messages.push(message),
      close: () => {},
    });
    item.state.getWebSockets = () => [
      socket(oldSession.sessionId, oldMessages),
      socket(nextSession.sessionId, newMessages),
    ];
    f.sessions.A = nextSession;
    const response = await f.request(`/${match.matchId}/controller`, "A", {
      expectedControllerGeneration: 1,
    });
    expect(response.status).toBe(200);
    expect(oldMessages).toHaveLength(1);
    expect(newMessages).toHaveLength(1);
    const old = JSON.parse(oldMessages[0]);
    const current = JSON.parse(newMessages[0]);
    expect(old.type).toBe("control-changed");
    expect(old.controller).toEqual(old.view.controller);
    expect(old.controller.isController).toBe(false);
    expect(current.controller).toEqual(current.view.controller);
    expect(current.controller.isController).toBe(true);
    for (const message of [...oldMessages, ...newMessages]) {
      expect(message).not.toContain(oldSession.sessionId);
      expect(message).not.toContain(nextSession.sessionId);
      expect(message).not.toContain("controllingSessionId");
      expect(message).not.toContain("playerControllers");
    }
  });
});
