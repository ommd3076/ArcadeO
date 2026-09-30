import { useState, type FormEvent } from "react";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Lock, User } from "lucide-react";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Handled by auth provider in F02
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-xl) var(--space-lg)",
        backgroundColor: "var(--color-canvas)",
      }}
    >
      <Surface
        variant="card"
        padding="xl"
        radius="xl"
        style={{
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xl)",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1
            style={{
              fontSize: "28px",
              fontWeight: 800,
              fontFamily: "var(--font-heading)",
              margin: "0 0 6px 0",
            }}
          >
            Private Arcade
          </h1>
          <p style={{ fontSize: "14px", color: "var(--color-muted-text)", margin: 0 }}>
            Enter your credentials to enter the arcade.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              backgroundColor: "var(--color-danger-surface)",
              color: "var(--color-danger-text)",
              fontSize: "13px",
              fontWeight: 500,
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
                fontSize: "12px",
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
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
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
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontSize: "12px",
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
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
                  outline: "none",
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: "var(--space-md)" }}>
            <Button type="submit" variant="primary" size="lg" fullWidth>
              Sign In
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}
