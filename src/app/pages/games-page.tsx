import { Link } from "react-router-dom";
import { Surface } from "../../components/surface";
import { Gamepad2, Grid, Hash, CircleDot, Dices, Shuffle, Swords, Target } from "lucide-react";

interface GameItem {
  id: string;
  name: string;
  category: string;
  modes: string;
  icon: typeof Gamepad2;
}

const GAMES: GameItem[] = [
  {
    id: "connect-four",
    name: "Connect Four",
    category: "Grid Strategy",
    modes: "Remote & Together",
    icon: CircleDot,
  },
  {
    id: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    category: "Secret Duel",
    modes: "Remote & Together",
    icon: Swords,
  },
  { id: "ludo", name: "Ludo", category: "Board Classic", modes: "Remote & Together", icon: Dices },
  {
    id: "snakes-and-ladders",
    name: "Snakes & Ladders",
    category: "Race Board",
    modes: "Remote & Together",
    icon: Shuffle,
  },
  {
    id: "dots-boxes",
    name: "Dots & Boxes",
    category: "Spatial Territory",
    modes: "Remote & Together",
    icon: Grid,
  },
  { id: "sos", name: "SOS", category: "Word Grid", modes: "Remote & Together", icon: Hash },
  {
    id: "hand-cricket",
    name: "Hand Cricket",
    category: "Secret Runs",
    modes: "Remote & Together",
    icon: Target,
  },
  {
    id: "sudoku",
    name: "Sudoku",
    category: "Logic Numbers",
    modes: "Practice, Duel & Challenge",
    icon: Grid,
  },
];

export function GamesPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
        padding: "calc(var(--space-xl) + var(--sat)) var(--space-lg) calc(96px + var(--sab))",
        maxWidth: "960px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <header>
        <h1
          style={{
            fontSize: "32px",
            lineHeight: 1.15,
            fontWeight: 800,
            fontFamily: "var(--font-heading)",
          }}
        >
          Games
        </h1>
        <p style={{ color: "var(--color-muted-text)", fontSize: "15px", marginTop: "6px" }}>
          Eight shared games designed for intentional two-person play.
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 155px), 1fr))",
          gap: "var(--space-lg)",
        }}
      >
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <Link key={game.id} to={`/games/${game.id}`} style={{ textDecoration: "none" }}>
              <Surface
                variant="card"
                padding="lg"
                radius="xl"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-md)",
                  height: "100%",
                  minHeight: "172px",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "var(--radius-lg)",
                      backgroundColor: "var(--color-raised)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--color-text)",
                    }}
                  >
                    <Icon size={22} />
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      backgroundColor: "var(--color-raised)",
                      color: "var(--color-muted-text)",
                      border: "1px solid var(--color-border)",
                    }}
                  >
                    {game.category}
                  </span>
                </div>

                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 4px 0" }}>
                    {game.name}
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--color-muted-text)", margin: 0 }}>
                    {game.modes}
                  </p>
                </div>
              </Surface>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
