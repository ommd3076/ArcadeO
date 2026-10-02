import { Link } from "react-router-dom";
import { ArrowRight, CircleDot, Dices, Grid2X2, Hash, Shuffle, Swords, Target } from "lucide-react";

interface GameItem {
  id: string;
  name: string;
  modes: string;
  icon: typeof CircleDot;
}

const GAMES: GameItem[] = [
  { id: "ludo", name: "Ludo", modes: "Remote or together", icon: Dices },
  {
    id: "snakes-and-ladders",
    name: "Snakes & Ladders",
    modes: "Remote or together",
    icon: Shuffle,
  },
  {
    id: "connect-four",
    name: "Connect Four",
    modes: "Remote or together",
    icon: CircleDot,
  },
  {
    id: "dots-boxes",
    name: "Dots & Boxes",
    modes: "Remote or together",
    icon: Grid2X2,
  },
  {
    id: "rock-paper-scissors",
    name: "Rock Paper Scissors",
    modes: "Remote or together",
    icon: Swords,
  },
  { id: "hand-cricket", name: "Hand Cricket", modes: "Remote or together", icon: Target },
  { id: "sos", name: "SOS", modes: "Remote or together", icon: Hash },
  {
    id: "sudoku",
    name: "Sudoku",
    modes: "Practice, live duel or later challenge",
    icon: Grid2X2,
  },
];

export function GamesPage() {
  return (
    <div className="games-page">
      <header className="games-page__header">
        <p className="eyebrow">Choose what to play</p>
        <h1>Games</h1>
        <p>Eight familiar games for a little shared time or solo Sudoku practice.</p>
      </header>

      <section aria-label="All games">
        <div className="games-grid">
          {GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <Link
                key={game.id}
                to={`/games/${game.id}`}
                className="game-catalog-link"
                aria-label={`${game.name}. ${game.modes}. Open game options.`}
              >
                <span className="game-catalog-link__icon">
                  <Icon size={25} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="game-catalog-link__copy">
                  <strong>{game.name}</strong>
                  <span>{game.modes}</span>
                </span>
                <ArrowRight className="game-catalog-link__arrow" size={18} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
