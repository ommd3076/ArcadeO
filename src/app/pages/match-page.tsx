import { useState } from "react";
import { useParams } from "react-router-dom";
import { BackHeader } from "../../components/back-header";
import { TurnStrip } from "../../components/turn-strip";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { IconButton } from "../../components/icon-button";
import { Sheet } from "../../components/sheet";
import { MoreVertical, RotateCcw, AlertTriangle } from "lucide-react";

export function MatchPage() {
  const { matchId = "demo-match" } = useParams<{ matchId: string }>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [turn, setTurn] = useState<"A" | "B">("A");

  const handleToggleTurn = () => {
    setTurn((prev) => (prev === "A" ? "B" : "A"));
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <BackHeader
        title="Active Match"
        subtitle={`ID: ${matchId}`}
        fallbackTo="/games"
        rightAction={
          <IconButton
            aria-label="Match Options"
            icon={<MoreVertical size={20} />}
            variant="ghost"
            onClick={() => setIsMenuOpen(true)}
          />
        }
      />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--space-md) var(--space-lg) calc(var(--space-xl) + var(--sab))",
          maxWidth: "560px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Prominent Turn Strip */}
        <TurnStrip
          activePlayerName={turn === "A" ? "Player A" : "Player B"}
          activeSeat={turn}
          activeAccent={turn === "A" ? "teal" : "violet"}
          isYourTurn={turn === "A"}
          role={turn === "A" ? "Host" : "Challenger"}
          statusText={turn === "A" ? "It's your turn to play" : "Waiting for opponent move..."}
          round={1}
          scoreText="0 - 0"
        />

        {/* Board Surface */}
        <Surface
          variant="card"
          padding="xl"
          radius="xl"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "320px",
            border: "2px dashed var(--color-interactive-line)",
          }}
        >
          <p style={{ color: "var(--color-muted-text)", fontSize: "14px", textAlign: "center" }}>
            [Game Board Canvas Area]
          </p>
          <div style={{ marginTop: "var(--space-lg)", display: "flex", gap: "8px" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleToggleTurn}
              leftIcon={<RotateCcw size={16} />}
            >
              Switch Turn Preview
            </Button>
          </div>
        </Surface>

        {/* Action Controls */}
        <div style={{ display: "flex", gap: "var(--space-md)" }}>
          <Button variant="primary" size="lg" fullWidth>
            Confirm Move
          </Button>
        </div>
      </main>

      {/* Match Options Sheet */}
      <Sheet
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Match Options"
        description="Settings and actions for this game session."
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
          <Button
            variant="danger"
            size="md"
            fullWidth
            leftIcon={<AlertTriangle size={18} />}
            onClick={() => {
              setIsMenuOpen(false);
            }}
          >
            Resign Match
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={() => setIsMenuOpen(false)}>
            Close Menu
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
