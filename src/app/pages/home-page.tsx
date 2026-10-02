import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CircleDot,
  Clock3,
  Dices,
  Grid2X2,
  Hash,
  LoaderCircle,
  RefreshCw,
  Shuffle,
  Swords,
  Target,
} from "lucide-react";
import { apiFetch, useAuth } from "../auth";
import { Button } from "../../components/button";
import { Surface } from "../../components/surface";
import { LibraryControls } from "./library-controls";

interface ActiveMatchSummary {
  matchId: string;
  gameId: string;
  mode: "remote" | "together" | "practice" | "duel" | "challenge";
  turnSeat?: string;
  lifecycle: string;
  startedAt?: number;
}

interface RecordsSummary {
  summary: {
    thisWeek?: { total: number; sentence?: string };
    calcuttaWeek?: { matchesThisWeek: number };
  };
}

const gameNames: Record<string, string> = {
  "connect-four": "Connect Four",
  "rock-paper-scissors": "Rock Paper Scissors",
  ludo: "Ludo",
  "snakes-and-ladders": "Snakes & Ladders",
  "dots-boxes": "Dots & Boxes",
  sos: "SOS",
  "hand-cricket": "Hand Cricket",
  sudoku: "Sudoku",
};

const quickGames = [
  { id: "connect-four", name: "Connect Four", icon: CircleDot },
  { id: "rock-paper-scissors", name: "Rock Paper Scissors", icon: Swords },
  { id: "ludo", name: "Ludo", icon: Dices },
  { id: "snakes-and-ladders", name: "Snakes & Ladders", icon: Shuffle },
  { id: "dots-boxes", name: "Dots & Boxes", icon: Grid2X2 },
  { id: "sos", name: "SOS", icon: Hash },
  { id: "hand-cricket", name: "Hand Cricket", icon: Target },
  { id: "sudoku", name: "Sudoku", icon: Grid2X2 },
] as const;

function formatGameName(gameId: string) {
  return gameNames[gameId] ?? gameId.replaceAll("-", " ");
}

function matchStatus(lifecycle: string) {
  return lifecycle === "waiting" ? "Waiting" : "In progress";
}

function modeName(mode: ActiveMatchSummary["mode"]) {
  return mode === "practice" || mode === "duel" || mode === "challenge"
    ? mode === "duel"
      ? "Live duel"
      : mode === "challenge"
        ? "Later challenge"
        : "Practice"
    : mode === "together"
      ? "Together"
      : "Remote";
}

export function HomePage() {
  const { session } = useAuth();
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [matchesError, setMatchesError] = useState(false);
  const [recordsError, setRecordsError] = useState(false);
  const [activeMatches, setActiveMatches] = useState<ActiveMatchSummary[]>([]);
  const [recordsSummary, setRecordsSummary] = useState<RecordsSummary | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadDashboard = useCallback(async () => {
    setLoadState("loading");
    const [matchesResult, recordsResult] = await Promise.allSettled([
      apiFetch("/api/v1/matches").then((response) => {
        if (!response.ok) throw new Error("Unable to load saved matches");
        return response.json() as Promise<{ matches?: ActiveMatchSummary[] }>;
      }),
      apiFetch("/api/v1/records/summary").then((response) => {
        if (!response.ok) throw new Error("Unable to load shared records");
        return response.json() as Promise<RecordsSummary>;
      }),
    ]);

    setMatchesError(matchesResult.status === "rejected");
    setRecordsError(recordsResult.status === "rejected");
    if (matchesResult.status === "fulfilled") {
      setActiveMatches(
        (matchesResult.value.matches ?? []).filter(
          (match) => match.lifecycle === "active" || match.lifecycle === "waiting",
        ),
      );
    }
    if (recordsResult.status === "fulfilled") setRecordsSummary(recordsResult.value);
    setLoadState("ready");
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard, reloadKey]);

  const dominantMatch = activeMatches[0] ?? null;
  const weeklyCount =
    recordsSummary?.summary?.thisWeek?.total ??
    recordsSummary?.summary?.calcuttaWeek?.matchesThisWeek;
  const weeklySummary = recordsError
    ? "This week’s shared activity is unavailable."
    : weeklyCount === undefined
      ? "Loading this week’s shared activity…"
      : weeklyCount === 0
        ? "No matches played yet this week."
        : `${weeklyCount} match${weeklyCount === 1 ? "" : "es"} played this week.`;

  return (
    <div className="home-page">
      <header className="home-page__header">
        <p className="eyebrow">Private Arcade</p>
        <h1>
          {session?.profile.displayName ? `Hello, ${session.profile.displayName}` : "Welcome"}
        </h1>
        <p className="home-page__intro">A little time for a game together.</p>
      </header>

      <div className="home-page__layout">
        <div className="home-page__primary">
          <section aria-labelledby="continue-heading">
            {loadState === "loading" ? (
              <Surface className="home-continue home-continue--loading" variant="card" padding="xl">
                <LoaderCircle size={20} aria-hidden="true" />
                <p role="status">Loading your saved matches…</p>
              </Surface>
            ) : matchesError ? (
              <Surface className="home-continue" variant="card" padding="xl">
                <p className="home-continue__eyebrow">Saved matches</p>
                <h2 id="continue-heading" role="alert">
                  Your matches couldn’t load
                </h2>
                <p>Try again to check for a game you can resume.</p>
                <Button
                  variant="secondary"
                  leftIcon={<RefreshCw size={17} aria-hidden="true" />}
                  onClick={() => setReloadKey((value) => value + 1)}
                >
                  Retry
                </Button>
              </Surface>
            ) : dominantMatch ? (
              <Surface
                className="home-continue home-continue--mint"
                variant="emphasis-mint"
                padding="xl"
              >
                <div className="home-continue__topline">
                  <p className="home-continue__eyebrow">Continue</p>
                  <span className="home-status">{matchStatus(dominantMatch.lifecycle)}</span>
                </div>
                <h2 id="continue-heading">{formatGameName(dominantMatch.gameId)}</h2>
                <p className="home-continue__context">
                  {modeName(dominantMatch.mode)}
                  {dominantMatch.turnSeat
                    ? ` · ${dominantMatch.turnSeat === session?.profile.id ? "Your turn" : "Other player’s turn"}`
                    : ""}
                </p>
                <Link
                  className="home-continue__action arcade-btn arcade-btn--pill arcade-btn--md arcade-btn--secondary"
                  to={`/matches/${dominantMatch.matchId}`}
                  aria-label={`Resume ${formatGameName(dominantMatch.gameId)}`}
                >
                  <span>Resume game</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </Surface>
            ) : (
              <Surface
                className="home-continue home-continue--mint"
                variant="emphasis-mint"
                padding="xl"
              >
                <p className="home-continue__eyebrow">Ready when you are</p>
                <h2 id="continue-heading">Pick a game to play</h2>
                <p>Choose a favorite for a shared match or a Sudoku practice session.</p>
                <Link
                  className="home-continue__action arcade-btn arcade-btn--pill arcade-btn--md arcade-btn--secondary"
                  to="/games"
                >
                  <span>Choose a game</span>
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
              </Surface>
            )}
          </section>

          <section className="home-quick-games" aria-labelledby="quick-games-heading">
            <div className="home-section-heading">
              <div>
                <h2 id="quick-games-heading">Play a game</h2>
                <p>All eight games, ready to choose.</p>
              </div>
              <Link to="/games" className="text-link">
                Browse all <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div className="home-quick-games__grid">
              {quickGames.map(({ id, name, icon: Icon }) => (
                <Link key={id} className="home-game-link" to={`/games/${id}`}>
                  <span className="home-game-link__icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span>{name}</span>
                  <ArrowRight className="home-game-link__arrow" size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="home-page__secondary" aria-label="Shared activity and saved games">
          <Surface className="home-weekly" variant="emphasis-cyan" padding="lg">
            <p className="home-continue__eyebrow">This week</p>
            <p aria-live="polite">{weeklySummary}</p>
          </Surface>

          {activeMatches.length > 1 && !matchesError && (
            <section className="home-active-matches" aria-labelledby="active-matches-heading">
              <div className="home-section-heading home-section-heading--compact">
                <h2 id="active-matches-heading">Active matches</h2>
                <span className="home-count">{activeMatches.length}</span>
              </div>
              <div className="home-active-matches__list">
                {activeMatches.slice(1).map((match) => (
                  <Link
                    className="home-active-match"
                    key={match.matchId}
                    to={`/matches/${match.matchId}`}
                    aria-label={`Resume ${formatGameName(match.gameId)}, ${matchStatus(match.lifecycle)}`}
                  >
                    <span className="home-active-match__icon">
                      <Clock3 size={18} aria-hidden="true" />
                    </span>
                    <span className="home-active-match__copy">
                      <strong>{formatGameName(match.gameId)}</strong>
                      <span>
                        {modeName(match.mode)} · {matchStatus(match.lifecycle)}
                      </span>
                    </span>
                    <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <LibraryControls />
        </aside>
      </div>
    </div>
  );
}
