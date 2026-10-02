import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth";
import { useLocation, useNavigate } from "react-router-dom";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Lock, User } from "lucide-react";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useAuth();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please provide username and password");
      if (!username.trim()) usernameRef.current?.focus();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Login failed (${res.status})`);
      }

      await refresh();
      setPassword("");
      const returnTo = location.state?.returnTo;
      navigate(
        typeof returnTo === "string" && returnTo.startsWith("/") && !returnTo.startsWith("//")
          ? returnTo
          : "/",
        { replace: true },
      );
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding:
          "calc(var(--space-xl) + var(--sat)) max(16px, var(--space-lg)) calc(var(--space-xl) + var(--sab))",
        backgroundColor: "var(--color-canvas)",
      }}
    >
      <Surface
        variant="card"
        padding="xl"
        radius="xl"
        style={{
          width: "100%",
          maxWidth: "440px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xl)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "clamp(32px, 8vw, 40px)",
              lineHeight: 1.05,
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              margin: "0 0 6px 0",
            }}
          >
            Private Arcade
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-muted-text)", margin: 0 }}>
            Sign in to your private two-player arcade.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            id="login-error"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-danger-surface)",
              color: "var(--color-danger-text)",
              fontSize: "14px",
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
        >
          <div>
            <label
              htmlFor="username"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-muted-text)",
                marginBottom: "6px",
              }}
            >
              Account
            </label>
            <div style={{ position: "relative" }}>
              <User
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-muted-text)",
                }}
              />
              <input
                id="username"
                ref={usernameRef}
                type="text"
                name="username"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (error === "Please provide username and password") setError(null);
                }}
                placeholder="Account username"
                aria-invalid={
                  error === "Please provide username and password" && !username.trim()
                    ? true
                    : undefined
                }
                aria-describedby={error ? "login-error" : undefined}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "40px",
                  paddingRight: "12px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-inset)",
                  color: "var(--color-text)",
                  fontSize: "15px",
                  minHeight: "48px",
                  outlineColor: "var(--color-focus)",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--color-muted-text)",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={18}
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--color-muted-text)",
                }}
              />
              <input
                id="password"
                type="password"
                name="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error === "Please provide username and password") setError(null);
                }}
                placeholder="Password"
                aria-invalid={
                  error === "Please provide username and password" && !password ? true : undefined
                }
                aria-describedby={error ? "login-error" : undefined}
                style={{
                  width: "100%",
                  height: "44px",
                  paddingLeft: "40px",
                  paddingRight: "12px",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-inset)",
                  color: "var(--color-text)",
                  fontSize: "15px",
                  minHeight: "48px",
                  outlineColor: "var(--color-focus)",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: "var(--space-md)" }}>
            <Button type="submit" variant="primary" size="lg" fullWidth disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}
