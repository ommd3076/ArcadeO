import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createMockD1Database } from "../auth/d1-mock";
import { createMockDONamespace } from "./do-mock";
import { createSession } from "../../../worker/auth/session";
import { handleMatchesRequest } from "../../../worker/api/matches";

export async function apiFixture() {
  const sqlite = new DatabaseSync(":memory:");
  const DB = createMockD1Database(sqlite);
  for (const file of fs
    .readdirSync("migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort())
    await DB.exec(fs.readFileSync(`migrations/${file}`, "utf8"));
  for (const account of ["A", "B"] as const)
    await DB.prepare(
      "INSERT INTO accounts(id,username,displayName,passwordHash,salt,accentFamily,paletteFamily) VALUES(?,?,?,?,?,?,?)",
    )
      .bind(
        account,
        account.toLowerCase(),
        account,
        "fixture-hash",
        "fixture-salt",
        account === "A" ? "teal" : "violet",
        account === "A" ? "standard" : "romantic",
      )
      .run();
  const secret = "explicit-fixture-csrf-secret-at-least-32-chars";
  const sessions = {
    A: await createSession(DB, "A", secret),
    B: await createSession(DB, "B", secret),
  };
  const env: any = { DB, CSRF_SECRET: secret, ALLOWED_ORIGIN: "https://arcade.internal" };
  const namespace = createMockDONamespace(() => env);
  env.MATCH_DO = namespace;
  async function request(
    path: string,
    actor: "A" | "B" = "A",
    body?: unknown,
    origin = env.ALLOWED_ORIGIN,
  ) {
    return (await handleMatchesRequest(
      new Request(`https://arcade.internal/api/v1/matches${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Cookie: `__Host-arcade-session=${sessions[actor].rawToken}`,
          Origin: origin,
          "x-csrf-token": sessions[actor].csrfToken,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
      env,
    ))!;
  }
  async function create(
    mode = "together",
    gameId = "connect-four",
    creationId = crypto.randomUUID(),
    actor: "A" | "B" = "A",
    gameOptions?: unknown,
  ) {
    const response = await request("", actor, { creationId, mode, gameId, gameOptions });
    return { response, match: (await response.json()) as any, creationId };
  }
  async function action(
    matchId: string,
    action: string,
    actor: "A" | "B" = "A",
    payload = {},
    extra = {},
  ) {
    const current = (await (await request(`/${matchId}`, actor)).json()) as any;
    const envelope = {
      protocolVersion: 1,
      matchId,
      actionId: crypto.randomUUID(),
      action,
      payload,
      expectedVersion: current.deliveryVersion,
      turnId: current.turnId,
      roundId: current.roundId,
      controllerGeneration: current.controller?.controllerGeneration,
      progressRevision: current.gameState?.self?.progressRevision,
      ...extra,
    };
    const response = await request(`/${matchId}/actions`, actor, envelope);
    return { response, reply: (await response.json()) as any, envelope };
  }
  return { sqlite, DB, env, namespace, sessions, request, create, action };
}
