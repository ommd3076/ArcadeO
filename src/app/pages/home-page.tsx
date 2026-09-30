import { Link } from "react-router-dom";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { ArrowRight, Play, Zap } from "lucide-react";
import { useTheme } from "../../theme/theme-context";

export function HomePage() {
  const { family } = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xl)",
        padding:
          "calc(var(--space-xl) + var(--sat)) var(--space-lg) calc(var(--space-4xl) + var(--sab))",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {/* Header Greeting */}
      <header>
        <span
          style={{
            fontSize: "13px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--color-muted-text)",
          }}
        >
          Private Arcade
        </span>
        <h1
          style={{
            fontSize: "32px",
            lineHeight: 1.15,
            fontWeight: 800,
            fontFamily: "var(--font-heading)",
            marginTop: "4px",
          }}
        >
          Welcome Back
        </h1>
        <p style={{ color: "var(--color-muted-text)", fontSize: "15px", marginTop: "6px" }}>
          Weekly shared momentum: 4 games played together this week.
        </p>
      </header>

      {/* Dominant Continue Card (Mint Emphasis in Standard, Tonal in Romantic) */}
      <Surface
        variant={family === "standard" ? "emphasis-mint" : "elevated"}
        padding="xl"
        radius="xl"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: "12px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              padding: "3px 8px",
              borderRadius: "var(--radius-full)",
              backgroundColor:
                family === "standard" ? "rgba(29, 41, 21, 0.15)" : "var(--color-accent-fill)",
              color: family === "standard" ? "#1D2915" : "var(--color-accent-fg)",
            }}
          >
            Your Turn
          </span>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Active Match</span>
        </div>

        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              margin: "0 0 4px 0",
              color: family === "standard" ? "#1D2915" : "var(--color-text)",
            }}
          >
            Connect Four
          </h2>
          <p
            style={{
              fontSize: "14px",
              margin: 0,
              color: family === "standard" ? "rgba(29, 41, 21, 0.8)" : "var(--color-muted-text)",
            }}
          >
            Remote Duel • Turn 7 • Opponent placed disc at col 3
          </p>
        </div>

        <div style={{ marginTop: "var(--space-sm)" }}>
          <Link to="/matches/active-connect-four">
            <Button
              variant={family === "standard" ? "secondary" : "primary"}
              size="md"
              leftIcon={<Play size={16} />}
            >
              Continue Game
            </Button>
          </Link>
        </div>
      </Surface>

      {/* Quick Games & Active Count */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "18px", fontWeight: 700 }}>Quick Play</h3>
          <Link
            to="/games"
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-muted-text)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            All 8 Games <ArrowRight size={14} />
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "var(--space-md)",
          }}
        >
          {[
            { id: "connect-four", name: "Connect Four", badge: "Popular" },
            { id: "sudoku", name: "Sudoku", badge: "Solo / Duel" },
            { id: "ludo", name: "Ludo", badge: "Turn-based" },
            { id: "rock-paper-scissors", name: "RPS", badge: "Secret" },
          ].map((game) => (
            <Link key={game.id} to={`/games/${game.id}`} style={{ textDecoration: "none" }}>
              <Surface
                variant="card"
                padding="md"
                radius="lg"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  height: "100%",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Zap size={16} color="var(--color-focus)" />
                  <span style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                    {game.badge}
                  </span>
                </div>
                <span style={{ fontWeight: 700, fontSize: "15px", color: "var(--color-text)" }}>
                  {game.name}
                </span>
              </Surface>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
