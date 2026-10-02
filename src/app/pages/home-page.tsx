import { apiFetch, useAuth } from "../auth";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { ArrowRight, Play, Zap, Clock } from "lucide-react";
import { useTheme } from "../../theme/theme-context";
import { LibraryControls } from "./library-controls";

interface ActiveMatchSummary {
  matchId: string;
  gameId: string;
  mode: "remote" | "together";
  turnSeat?: string;
  lifecycle: string;
  startedAt?: number;
}

interface RecordsSummary {
  summary: {
    totalPlayed: number;
    winsA: number;
    winsB: number;
    currentStreak: { holder: string | null; count: number };
    thisWeek?: { total: number };
    calcuttaWeek?: {
      weekStartMs: number;
      matchesThisWeek: number;
      winsAThisWeek: number;
      winsBThisWeek: number;
    };
  };
}

export function HomePage() {
  const { session } = useAuth();
  const { family } = useTheme();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeMatches, setActiveMatches] = useState<ActiveMatchSummary[]>([]);
  const [recordsSummary, setRecordsSummary] = useState<RecordsSummary | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        const [matchesRes, recordsRes] = await Promise.all([
          apiFetch("/api/v1/matches").then((r) =>
            r.ok
              ? (r.json() as Promise<{ matches?: ActiveMatchSummary[] }>)
              : Promise.reject(new Error("Unable to load saved matches")),
          ),
          apiFetch("/api/v1/records/summary").then((r) =>
            r.ok ? (r.json() as Promise<RecordsSummary>) : null,
          ),
        ]);

        if (isMounted) {
          if (matchesRes?.matches) {
            setActiveMatches(
              matchesRes.matches.filter(
                (match) => match.lifecycle === "active" || match.lifecycle === "waiting",
              ),
            );
          }
          if (recordsRes?.summary) {
            setRecordsSummary(recordsRes);
          }
        }
      } catch (err) {
        if (isMounted) setLoadError((err as Error).message);
      }
    }

    loadDashboard();
    return () => {
      isMounted = false;
    };
  }, []);

  const dominantMatch = activeMatches[0] ?? null;
  const weeklyCount =
    recordsSummary?.summary?.thisWeek?.total ??
    recordsSummary?.summary?.calcuttaWeek?.matchesThisWeek ??
    0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2xl)",
        padding: "calc(var(--space-xl) + var(--sat)) var(--space-lg) calc(96px + var(--sab))",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      {loadError && <p role="alert">{loadError}. Refresh to retry.</p>}
      {/* Header Greeting & Weekly Sentence */}
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
          {session?.profile.displayName ? `, ${session.profile.displayName}` : ""}
        </h1>
        <p
          style={{
            color: family === "standard" ? "#102426" : "var(--color-muted-text)",
            background:
              family === "standard" ? "var(--color-emphasis-cyan-bg)" : "var(--color-raised)",
            padding: "12px 16px",
            borderRadius: "16px",
            fontSize: "15px",
            marginTop: "16px",
          }}
        >
          {weeklyCount > 0
            ? `Weekly shared momentum: ${weeklyCount} match${weeklyCount > 1 ? "es" : ""} played together this week.`
            : "Weekly shared momentum: Start your first match together this week."}
        </p>
      </header>

      {/* Dominant Continue Card or Start Match Invitation */}
      {dominantMatch ? (
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
              Continue Playing
            </span>
            <span style={{ fontSize: "13px", fontWeight: 600, textTransform: "capitalize" }}>
              {dominantMatch.mode} Mode
            </span>
          </div>

          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: 700,
                fontFamily: "var(--font-heading)",
                margin: "0 0 4px 0",
                textTransform: "capitalize",
                color: family === "standard" ? "#1D2915" : "var(--color-text)",
              }}
            >
              {dominantMatch.gameId.replace("-", " ")}
            </h2>
            <p
              style={{
                fontSize: "14px",
                margin: 0,
                color: family === "standard" ? "rgba(29, 41, 21, 0.8)" : "var(--color-muted-text)",
              }}
            >
              Match #{dominantMatch.matchId.slice(0, 8)} • In Progress
            </p>
          </div>

          <div style={{ marginTop: "var(--space-sm)" }}>
            <Link to={`/matches/${dominantMatch.matchId}`} style={{ textDecoration: "none" }}>
              <Button
                variant={family === "standard" ? "secondary" : "primary"}
                size="md"
                leftIcon={<Play size={16} />}
              >
                Resume Game
              </Button>
            </Link>
          </div>
        </Surface>
      ) : (
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
              Ready For A Match
            </span>
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                background:
                  family === "standard" ? "var(--color-emphasis-yellow-bg)" : "var(--color-raised)",
                borderRadius: "12px",
                padding: "4px 8px",
              }}
            >
              Arcade Open
            </span>
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
              Quick two-player duel. Remote over the wire or together on one phone.
            </p>
          </div>

          <div style={{ marginTop: "var(--space-sm)" }}>
            <Link to="/games/connect-four" style={{ textDecoration: "none" }}>
              <Button
                variant={family === "standard" ? "secondary" : "primary"}
                size="md"
                leftIcon={<Play size={16} />}
              >
                Start Match
              </Button>
            </Link>
          </div>
        </Surface>
      )}

      {/* Multiple Active Matches List if more than 1 */}
      {activeMatches.length > 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
          <h3 style={{ fontSize: "16px", fontWeight: 700 }}>
            Active Matches ({activeMatches.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activeMatches.slice(1).map((m) => (
              <Link key={m.matchId} to={`/matches/${m.matchId}`} style={{ textDecoration: "none" }}>
                <Surface
                  variant="card"
                  padding="md"
                  radius="lg"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <Clock size={16} color="var(--color-focus)" />
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "14px",
                          textTransform: "capitalize",
                          color: "var(--color-text)",
                        }}
                      >
                        {m.gameId.replace("-", " ")}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>
                        {m.mode} • #{m.matchId.slice(0, 8)}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />}>
                    Resume
                  </Button>
                </Surface>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Play Grid (All 8 Games Accessible) */}
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
            { id: "connect-four", name: "Connect Four", badge: "Grid Strategy" },
            { id: "sudoku", name: "Sudoku", badge: "1,000 Puzzles" },
            { id: "ludo", name: "Ludo", badge: "Board Classic" },
            { id: "rock-paper-scissors", name: "RPS", badge: "Secret Duel" },
            { id: "dots-boxes", name: "Dots & Boxes", badge: "Territory" },
            { id: "hand-cricket", name: "Hand Cricket", badge: "Runs & Wickets" },
            { id: "snakes-and-ladders", name: "Snakes & Ladders", badge: "Race Board" },
            { id: "sos", name: "SOS", badge: "Word Grid" },
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
      <LibraryControls />
    </div>
  );
}
