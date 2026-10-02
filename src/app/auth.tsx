import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { AccountId, PaletteFamily, AccentFamily } from "../../shared/protocol/types";
import { RefreshCw, WifiOff } from "lucide-react";
import { Button } from "../components/button";
import { Surface } from "../components/surface";
import "./auth.css";

export interface SessionProfile {
  id: AccountId;
  displayName: string;
  paletteFamily: PaletteFamily;
  accentFamily: AccentFamily;
  preferenceVersion: number;
}

export interface AuthSession {
  profile: SessionProfile;
  csrfToken: string;
  expiresAt: number;
}

export interface ApiFetchInit extends RequestInit {
  /** Total time allowed for request headers and response body together. */
  timeoutMs?: number;
}

export const API_REQUEST_TIMEOUT_MS = 12_000;
const API_RESPONSE_LIMIT_BYTES = 4 * 1024 * 1024;

export function scheduleSessionExpiry(expiresAt: number, expire: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      expire();
      return;
    }
    timer = setTimeout(schedule, Math.min(remaining, 86400000));
  };
  schedule();
  return () => clearTimeout(timer);
}

let currentSession: AuthSession | null = null;
let authSessionEpoch = 0;
const changes = new Set<() => void>();
function publish(session: AuthSession | null) {
  currentSession = session;
  authSessionEpoch += 1;
  for (const listener of changes) listener();
}
export function clearPrivateSession() {
  publish(null);
}

export function getAuthSessionEpoch(): number {
  return authSessionEpoch;
}

export function hasCurrentAuthSession(): boolean {
  return currentSession !== null;
}

export function commitAuthSessionIfCurrent(
  session: AuthSession | null,
  expectedEpoch: number,
): boolean {
  if (authSessionEpoch !== expectedEpoch) return false;
  publish(session);
  return true;
}

export function expireAuthSessionIfCurrent(expectedEpoch: number): boolean {
  return commitAuthSessionIfCurrent(null, expectedEpoch);
}

/** Clear only the session identity the server confirmed is no longer valid. */
export function expireAuthSessionAfterServerRevocation(
  requestEpoch: number,
  requestCsrfToken: string | null,
): boolean {
  if (requestCsrfToken && currentSession?.csrfToken === requestCsrfToken) {
    publish(null);
    return true;
  }

  // A logged-out bootstrap may still be pending when an unauthenticated
  // request returns 401. Bump only the unchanged epoch in that case.
  if (currentSession === null && authSessionEpoch === requestEpoch) {
    publish(null);
    return true;
  }

  // A different CSRF token means a newer authenticated session replaced the
  // identity this request carried; its result cannot clear that session.
  return false;
}

function AuthStateView({
  loading,
  message,
  onRetry,
}: {
  loading: boolean;
  message: string;
  onRetry?: () => void;
}) {
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const StatusIcon = loading ? RefreshCw : WifiOff;
  return (
    <main
      className="auth-state"
      role={loading ? "status" : "alert"}
      aria-live="polite"
      aria-busy={loading || undefined}
    >
      <Surface className="auth-state__surface" variant="card" padding="2xl" radius="xl">
        <span className={`auth-state__icon${loading ? " auth-state__icon--loading" : ""}`}>
          <StatusIcon size={22} aria-hidden="true" />
        </span>
        <div className="auth-state__copy">
          <p className="auth-state__eyebrow">PRIVATE ARCADE</p>
          <h1 className="auth-state__title">
            {loading ? "Opening your arcade…" : "Reconnect to your arcade"}
          </h1>
          <p className="auth-state__message">{message}</p>
        </div>
        {onRetry && (
          <Button
            className="auth-state__retry"
            variant="primary"
            size="lg"
            fullWidth
            disabled={!online}
            leftIcon={<RefreshCw size={17} aria-hidden="true" />}
            onClick={onRetry}
          >
            Retry connection
          </Button>
        )}
      </Surface>
    </main>
  );
}

function requestFailure(message: string): Error {
  return new Error(message);
}

function cancelReaderSafely(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // Cancellation is cleanup only. A stream that already errored can reject it.
  }
}

async function readBoundedBody(
  response: Response,
  race: <T>(promise: Promise<T>) => Promise<T>,
): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const part = await race(reader.read());
      if (part.done) break;
      byteLength += part.value.byteLength;
      if (byteLength > API_RESPONSE_LIMIT_BYTES) {
        cancelReaderSafely(reader);
        throw requestFailure("The server response was too large to process safely.");
      }
      chunks.push(part.value);
    }
  } catch (error) {
    cancelReaderSafely(reader);
    throw error;
  }

  const body = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * Fetches same-origin API responses with one deadline covering both headers
 * and body. Returning a buffered Response preserves existing response.json()
 * consumers while preventing a stalled stream from leaving a screen loading.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchInit = {},
): Promise<Response> {
  const { timeoutMs = API_REQUEST_TIMEOUT_MS, signal: callerSignal, ...requestInit } = init;
  const requestAuthEpoch = authSessionEpoch;
  const requestCsrfToken = currentSession?.csrfToken ?? null;
  const headers = new Headers(requestInit.headers);
  if (!/^(GET|HEAD)$/i.test(requestInit.method ?? "GET") && requestCsrfToken) {
    headers.set("X-CSRF-Token", requestCsrfToken);
  }

  const controller = new AbortController();
  let callerAbortListener: (() => void) | undefined;
  let rejectTimeout: ((reason: Error) => void) | undefined;
  let rejectCallerAbort: ((reason: Error) => void) | undefined;

  const timeoutFailure = new Promise<never>((_resolve, reject) => {
    rejectTimeout = reject;
  });
  const callerAbortFailure = new Promise<never>((_resolve, reject) => {
    rejectCallerAbort = reject;
  });
  const race = <T,>(promise: Promise<T>) =>
    Promise.race([promise, timeoutFailure, callerAbortFailure]) as Promise<T>;

  if (callerSignal?.aborted) {
    throw requestFailure("This request was cancelled. Retry when ready.");
  }

  const deadlineMs =
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : API_REQUEST_TIMEOUT_MS;
  const timeoutId = setTimeout(() => {
    controller.abort();
    rejectTimeout?.(
      requestFailure("The server took too long to respond. Check your connection and retry."),
    );
  }, deadlineMs);
  if (callerSignal) {
    callerAbortListener = () => {
      controller.abort();
      rejectCallerAbort?.(requestFailure("This request was cancelled. Retry when ready."));
    };
    callerSignal.addEventListener("abort", callerAbortListener, { once: true });
  }

  try {
    const response = await race(
      fetch(input, {
        ...requestInit,
        headers,
        signal: controller.signal,
        credentials: "same-origin",
        cache: "no-store",
      }),
    );
    if (response.status === 401) {
      expireAuthSessionAfterServerRevocation(requestAuthEpoch, requestCsrfToken);
    }

    const hasNoBody =
      requestInit.method?.toUpperCase() === "HEAD" ||
      response.status === 204 ||
      response.status === 205 ||
      response.status === 304;
    const bytes = hasNoBody ? null : await readBoundedBody(response, race);
    return new Response(bytes as BodyInit | null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    if (error instanceof Error && /too long|too large|cancelled/i.test(error.message)) throw error;
    throw requestFailure("Could not reach the arcade. Check your connection and retry.");
  } finally {
    clearTimeout(timeoutId);
    if (callerSignal && callerAbortListener) {
      callerSignal.removeEventListener("abort", callerAbortListener);
    }
  }
}

async function bootstrap() {
  const response = await apiFetch("/api/v1/auth/session");
  if (!response.ok) throw new Error("Unable to check your session. Retry when connected.");
  const data = (await response.json()) as AuthSession & { authenticated: boolean };
  return data.authenticated ? data : null;
}

const AuthContext = createContext<{
  session: AuthSession | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(currentSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshSequence = useRef(0);
  const refresh = async () => {
    const sequence = ++refreshSequence.current;
    const requestEpoch = authSessionEpoch;
    setLoading(currentSession === null);
    setError(null);
    try {
      const nextSession = await bootstrap();
      if (sequence !== refreshSequence.current) return;
      commitAuthSessionIfCurrent(nextSession, requestEpoch);
    } catch (e) {
      if (sequence === refreshSequence.current && requestEpoch === authSessionEpoch) {
        setError((e as Error).message);
      }
    } finally {
      if (sequence === refreshSequence.current && requestEpoch === authSessionEpoch) {
        setLoading(false);
      }
    }
  };
  useEffect(() => {
    const change = () => {
      setSession(currentSession);
      setLoading(false);
      setError(null);
    };
    changes.add(change);
    void refresh();
    return () => {
      changes.delete(change);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    const expiryEpoch = authSessionEpoch;
    return scheduleSessionExpiry(session.expiresAt, () => expireAuthSessionIfCurrent(expiryEpoch));
  }, [session]);
  const logout = async () => {
    const logoutEpoch = authSessionEpoch;
    const logoutCsrfToken = currentSession?.csrfToken ?? null;
    const response = await apiFetch("/api/v1/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Sign out failed. Please retry.");
    expireAuthSessionAfterServerRevocation(logoutEpoch, logoutCsrfToken);
  };
  if (error)
    return (
      <AuthStateView loading={false} message={error} onRetry={() => window.location.reload()} />
    );
  return (
    <AuthContext.Provider value={{ session, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider required");
  return value;
}

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <AuthStateView loading message="Checking your session and reconnecting securely." />;
  }
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />
  );
}
