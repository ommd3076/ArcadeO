import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { BackHeader } from "../../components/back-header";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { Play, Users, Wifi } from "lucide-react";

const GAME_TITLES: Record<string, string> = {
  "connect-four": "Connect Four",
  "rock-paper-scissors": "Rock Paper Scissors",
  ludo: "Ludo",
  "snakes-and-ladders": "Snakes & Ladders",
  "dots-boxes": "Dots & Boxes",
  sos: "SOS",
  "hand-cricket": "Hand Cricket",
  sudoku: "Sudoku",
};

export function GameDetailPage() {
  const { gameId = "connect-four" } = useParams<{ gameId: string }>();
  const [selectedMode, setSelectedMode] = useState<"remote" | "together">("remote");

  const gameTitle = GAME_TITLES[gameId] ?? "Game Details";

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <BackHeader title={gameTitle} fallbackTo="/games" />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-xl)",
          padding: "var(--space-xl) var(--space-lg) calc(var(--space-4xl) + var(--sab))",
          maxWidth: "640px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <Surface variant="card" padding="xl" radius="xl">
          <h2 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 8px 0" }}>
            Choose Play Mode
          </h2>
          <p
            style={{
              fontSize: "14px",
              color: "var(--color-muted-text)",
              margin: "0 0 var(--space-lg) 0",
            }}
          >
            Select whether you are playing across devices or passing one phone back and forth.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
            <Surface
              variant={selectedMode === "remote" ? "elevated" : "inset"}
              padding="md"
              radius="lg"
              style={{
                cursor: "pointer",
                border:
                  selectedMode === "remote"
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
              onClick={() => setSelectedMode("remote")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wifi size={18} color="var(--color-focus)" />
                <span style={{ fontWeight: 700, fontSize: "15px" }}>Remote</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-muted-text)", margin: 0 }}>
                Play live across your two separate phones or laptops.
              </p>
            </Surface>

            <Surface
              variant={selectedMode === "together" ? "elevated" : "inset"}
              padding="md"
              radius="lg"
              style={{
                cursor: "pointer",
                border:
                  selectedMode === "together"
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
              onClick={() => setSelectedMode("together")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={18} color="var(--color-accent-fg)" />
                <span style={{ fontWeight: 700, fontSize: "15px" }}>Together</span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-muted-text)", margin: 0 }}>
                Side-by-side on one shared device with private handoffs.
              </p>
            </Surface>
          </div>
        </Surface>

        <div style={{ marginTop: "auto", paddingTop: "var(--space-xl)" }}>
          <Link to={`/matches/${gameId}-${selectedMode}`} style={{ textDecoration: "none" }}>
            <Button variant="primary" size="lg" fullWidth leftIcon={<Play size={20} />}>
              Start Match
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
