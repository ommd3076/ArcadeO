import { afterEach, describe, expect, it, vi } from "vitest";
import {
  apiFetch,
  clearPrivateSession,
  commitAuthSessionIfCurrent,
  expireAuthSessionAfterServerRevocation,
  getAuthSessionEpoch,
  hasCurrentAuthSession,
  type AuthSession,
} from "../../src/app/auth";

afterEach(() => {
  vi.unstubAllGlobals();
  clearPrivateSession();
});

function makeSession(csrfToken = "synthetic-csrf-token"): AuthSession {
  return {
    profile: {
      id: "A",
      displayName: "Player A",
      paletteFamily: "standard",
      accentFamily: "teal",
      preferenceVersion: 1,
    },
    csrfToken,
    expiresAt: Date.now() + 60_000,
  };
}

describe("bounded API transport", () => {
  it("does not let an old unauthenticated bootstrap replace a newer session", () => {
    const oldBootstrapEpoch = getAuthSessionEpoch();
    expect(commitAuthSessionIfCurrent(makeSession(), oldBootstrapEpoch)).toBe(true);
    expect(commitAuthSessionIfCurrent(null, oldBootstrapEpoch)).toBe(false);
    expect(hasCurrentAuthSession()).toBe(true);
  });

  it("does not let an old request's 401 clear a newer authenticated session", async () => {
    const oldRequestEpoch = getAuthSessionEpoch();
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const request = apiFetch("/api/v1/profile", { timeoutMs: 500 });
    expect(commitAuthSessionIfCurrent(makeSession(), oldRequestEpoch)).toBe(true);
    resolveFetch(Response.json({ code: "AUTH_REQUIRED" }, { status: 401 }));
    const response = await request;
    expect(response.status).toBe(401);
    expect(hasCurrentAuthSession()).toBe(true);
  });

  it("clears a same-session refresh when an older request returns 401", async () => {
    const initialEpoch = getAuthSessionEpoch();
    const session = makeSession("same-session-csrf");
    expect(commitAuthSessionIfCurrent(session, initialEpoch)).toBe(true);
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const request = apiFetch("/api/v1/profile", { timeoutMs: 500 });
    const requestEpoch = getAuthSessionEpoch();

    expect(commitAuthSessionIfCurrent(makeSession("same-session-csrf"), requestEpoch)).toBe(true);
    resolveFetch(Response.json({ code: "AUTH_REQUIRED" }, { status: 401 }));
    const response = await request;

    expect(response.status).toBe(401);
    expect(hasCurrentAuthSession()).toBe(false);
  });

  it("does not let a 401 from an older session clear a different newer login", async () => {
    const initialEpoch = getAuthSessionEpoch();
    expect(commitAuthSessionIfCurrent(makeSession("old-session-csrf"), initialEpoch)).toBe(true);
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    const request = apiFetch("/api/v1/profile", { timeoutMs: 500 });
    const newLoginEpoch = getAuthSessionEpoch();

    expect(commitAuthSessionIfCurrent(makeSession("new-session-csrf"), newLoginEpoch)).toBe(true);
    resolveFetch(Response.json({ code: "AUTH_REQUIRED" }, { status: 401 }));
    const response = await request;

    expect(response.status).toBe(401);
    expect(hasCurrentAuthSession()).toBe(true);
  });

  it("clears the revoked session when a same-session refresh commits during logout", () => {
    const initialEpoch = getAuthSessionEpoch();
    const session = makeSession();
    expect(commitAuthSessionIfCurrent(session, initialEpoch)).toBe(true);
    const logoutEpoch = getAuthSessionEpoch();
    const logoutCsrfToken = session.csrfToken;
    const pendingRefreshEpoch = getAuthSessionEpoch();

    expect(commitAuthSessionIfCurrent(makeSession(), pendingRefreshEpoch)).toBe(true);
    expect(getAuthSessionEpoch()).toBeGreaterThan(logoutEpoch);
    expect(expireAuthSessionAfterServerRevocation(logoutEpoch, logoutCsrfToken)).toBe(true);
    expect(hasCurrentAuthSession()).toBe(false);
  });

  it("preserves a genuinely newer login when the older logout completes", () => {
    const initialEpoch = getAuthSessionEpoch();
    expect(commitAuthSessionIfCurrent(makeSession("old-session-csrf"), initialEpoch)).toBe(true);
    const logoutEpoch = getAuthSessionEpoch();
    const newLoginEpoch = getAuthSessionEpoch();
    expect(commitAuthSessionIfCurrent(makeSession("new-session-csrf"), newLoginEpoch)).toBe(true);

    expect(expireAuthSessionAfterServerRevocation(logoutEpoch, "old-session-csrf")).toBe(false);
    expect(hasCurrentAuthSession()).toBe(true);
  });

  it("does not let a pending refresh restore a session after successful logout", () => {
    const initialEpoch = getAuthSessionEpoch();
    const session = makeSession();
    expect(commitAuthSessionIfCurrent(session, initialEpoch)).toBe(true);
    const logoutEpoch = getAuthSessionEpoch();
    const pendingRefreshEpoch = getAuthSessionEpoch();

    expect(expireAuthSessionAfterServerRevocation(logoutEpoch, session.csrfToken)).toBe(true);
    expect(commitAuthSessionIfCurrent(session, pendingRefreshEpoch)).toBe(false);
    expect(hasCurrentAuthSession()).toBe(false);
  });

  it("bounds time spent waiting for response headers and aborts the request", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }),
    );

    await expect(apiFetch("/api/stalled", { timeoutMs: 15 })).rejects.toThrow(/took too long/);
    expect(signal?.aborted).toBe(true);
  });

  it("uses the same deadline while consuming a response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(new ReadableStream<Uint8Array>({ start() {} }), {
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    await expect(apiFetch("/api/stalled-body", { timeoutMs: 15 })).rejects.toThrow(/took too long/);
  });

  it("swallows cancellation rejection after an already-errored response stream", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.error(new Error("response stream failed"));
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    try {
      await expect(apiFetch("/api/errored-body", { timeoutMs: 500 })).rejects.toThrow(
        /Could not reach the arcade/,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("honors caller cancellation even if a fetch implementation ignores AbortSignal", async () => {
    const caller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );
    const request = apiFetch("/api/cancelled", { signal: caller.signal, timeoutMs: 500 });
    caller.abort();
    await expect(request).rejects.toThrow(/cancelled/);
  });

  it("preserves auth, policy, not-found, conflict, rate-limit, and outage statuses", async () => {
    for (const status of [401, 403, 404, 409, 429, 503]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(Response.json({ code: `HTTP_${status}` }, { status }))),
      );
      const response = await apiFetch("/api/status", { timeoutMs: 500 });
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ code: `HTTP_${status}` });
    }
  });

  it("retains malformed JSON diagnostics for a bounded response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("not-json", { status: 429 }))),
    );
    const response = await apiFetch("/api/rate-limited", { timeoutMs: 500 });
    expect(response.status).toBe(429);
    await expect(response.json()).rejects.toThrow();
  });
});
