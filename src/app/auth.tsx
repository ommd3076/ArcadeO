import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { AccountId, PaletteFamily, AccentFamily } from "../../shared/protocol/types";
export interface SessionProfile {
  id: AccountId;
  displayName: string;
  paletteFamily: PaletteFamily;
  accentFamily: AccentFamily;
  preferenceVersion: number;
}
interface Session {
  profile: SessionProfile;
  csrfToken: string;
  expiresAt: number;
}
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
let currentSession: Session | null = null;
const changes = new Set<() => void>();
function publish(session: Session | null) {
  currentSession = session;
  for (const listener of changes) listener();
}
export function clearPrivateSession() {
  if (typeof sessionStorage !== "undefined") {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith("pa_pending_")) sessionStorage.removeItem(key);
  }
  publish(null);
}
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!/^(GET|HEAD)$/i.test(init.method ?? "GET") && currentSession)
    headers.set("X-CSRF-Token", currentSession.csrfToken);
  const response = await fetch(input, {
    ...init,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (response.status === 401) clearPrivateSession();
  return response;
}
async function bootstrap() {
  const response = await apiFetch("/api/v1/auth/session");
  if (!response.ok) throw new Error("Unable to check your session. Retry when connected.");
  const data = (await response.json()) as Session & { authenticated: boolean };
  publish(data.authenticated ? data : null);
}
const AuthContext = createContext<{
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState(currentSession);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    setLoading(currentSession === null);
    setError(null);
    try {
      await bootstrap();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const change = () => setSession(currentSession);
    changes.add(change);
    void refresh();
    return () => {
      changes.delete(change);
    };
  }, []);
  useEffect(() => {
    if (!session) return;
    return scheduleSessionExpiry(session.expiresAt, clearPrivateSession);
  }, [session]);
  const logout = async () => {
    const response = await apiFetch("/api/v1/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Sign out failed. Please retry.");
    clearPrivateSession();
  };
  if (error)
    return (
      <main role="alert">
        <p>{error}</p>
        <button onClick={() => void refresh()}>Retry connection</button>
      </main>
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
  if (loading) return <main role="status">Opening your arcade…</main>;
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ returnTo: location.pathname + location.search }} replace />
  );
}
