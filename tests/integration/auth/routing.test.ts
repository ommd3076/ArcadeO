import { describe, expect, it } from "vitest";
import worker from "../../../worker/index";
import { createMockD1Database } from "./d1-mock";
import { DatabaseSync } from "node:sqlite";

function makeEnv() {
  const assetRequests: string[] = [];
  const env = {
    DB: createMockD1Database(new DatabaseSync(":memory:")),
    MATCH_DO: {} as DurableObjectNamespace,
    ENVIRONMENT: "development",
    ALLOWED_ORIGIN: "http://arcade.example",
    CSRF_SECRET: "development-test-only-csrf-secret-12345",
    ASSETS: {
      fetch: async (request: Request) => {
        const pathname = new URL(request.url).pathname;
        assetRequests.push(pathname);
        if (pathname === "/") {
          return new Response("<!doctype html><div id=app></div>", {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          });
        }
        return new Response("asset missing", {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    } as unknown as Fetcher,
    assetRequests,
  };
  return env;
}

describe("Worker routing errors and asset boundaries", () => {
  it("returns useful no-store JSON for unknown API routes", async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request("http://arcade.example/api/v1/not-a-route"),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("serves the app shell for supported and unknown document routes but preserves 404", async () => {
    const env = makeEnv();
    const supported = await worker.fetch(
      new Request("http://arcade.example/matches/unknown-id", {
        headers: { Accept: "text/html" },
      }),
      env,
      {} as ExecutionContext,
    );
    const unknown = await worker.fetch(
      new Request("http://arcade.example/this-route-is-not-defined", {
        headers: { Accept: "text/html" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(supported.status).toBe(200);
    expect(unknown.status).toBe(404);
    expect(await unknown.text()).toContain("<div id=app>");
    expect(env.assetRequests).toEqual(["/", "/"]);
  });

  it("keeps missing public assets as their own 404 response", async () => {
    const env = makeEnv();
    const response = await worker.fetch(
      new Request("http://arcade.example/assets/chunk-that-does-not-exist.js", {
        headers: { Accept: "*/*" },
      }),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(await response.text()).toBe("asset missing");
    expect(env.assetRequests).toEqual(["/assets/chunk-that-does-not-exist.js"]);
  });

  it("rejects production wildcard origin configuration before routing API requests", async () => {
    const env = { ...makeEnv(), ENVIRONMENT: "production", ALLOWED_ORIGIN: "*" };
    const response = await worker.fetch(
      new Request("https://arcade.example/api/v1/not-a-route"),
      env,
      {} as ExecutionContext,
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "CONFIGURATION_ERROR" });
  });
});
