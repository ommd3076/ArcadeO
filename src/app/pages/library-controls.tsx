import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../auth";
import { Button } from "../../components/button";
import { Surface } from "../../components/surface";

const games = [
  ["connect-four", "Connect Four"],
  ["rock-paper-scissors", "Rock Paper Scissors"],
  ["ludo", "Ludo"],
  ["snakes-and-ladders", "Snakes & Ladders"],
  ["dots-boxes", "Dots & Boxes"],
  ["sos", "SOS"],
  ["hand-cricket", "Hand Cricket"],
  ["sudoku", "Sudoku"],
] as const;

type SavedList = { gameIds: string[]; version: number };
type Library = { favourites: SavedList; playNext: SavedList };

export function LibraryControls() {
  const [library, setLibrary] = useState<Library | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [queueChoice, setQueueChoice] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  const refresh = useCallback(async () => {
    const response = await apiFetch("/api/v1/library");
    if (!response.ok) throw new Error(`Unable to load saved game lists (${response.status})`);
    setLibrary((await response.json()) as Library);
    setLoadError(null);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refresh()
      .catch((error: Error) => {
        if (active) setLoadError(error.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh, reload]);

  async function save(kind: "favourites" | "playNext", gameIds: string[]) {
    if (!library || saving) return;
    const endpoint = kind === "favourites" ? "favourites" : "play-next";
    setSaving(true);
    try {
      const response = await apiFetch(`/api/v1/library/${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameIds, expectedVersion: library[kind].version }),
      });
      if (response.status === 409) {
        await refresh();
        setNotice("The game list changed on another device. Review it, then retry.");
        return;
      }
      if (!response.ok) throw new Error("Unable to save game list");
      await refresh();
      setNotice(kind === "favourites" ? "Favourites saved" : "Play next saved for both players");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const favourites = library?.favourites.gameIds ?? [];
  const queue = library?.playNext.gameIds ?? [];

  return (
    <Surface variant="card" padding="lg" radius="xl">
      <h2 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 4px" }}>Your games</h2>
      <p style={{ color: "var(--color-muted-text)", margin: "0 0 14px" }}>
        Your favourites and the shared play-next list for both accounts.
      </p>
      {loading && (
        <p role="status" style={{ color: "var(--color-muted-text)" }}>
          Loading saved game lists…
        </p>
      )}
      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <span>{loadError}</span>
          <Button
            size="sm"
            variant="secondary"
            style={{ minHeight: 44 }}
            onClick={() => setReload((value) => value + 1)}
          >
            Retry
          </Button>
        </div>
      )}
      {notice && (
        <p role="status" aria-live="polite">
          {notice}
        </p>
      )}
      {favourites.length > 0 && (
        <nav aria-label="Pinned games" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {favourites.map((id) => (
            <Link
              key={id}
              to={`/games/${id}`}
              className="arcade-btn arcade-btn--pill arcade-btn--sm arcade-btn--secondary"
              style={{ minHeight: 44 }}
            >
              {games.find(([game]) => game === id)?.[1] ?? id}
            </Link>
          ))}
        </nav>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 270px), 1fr))",
          gap: 16,
        }}
      >
        <section aria-label="Your favourites">
          <h3 style={{ fontSize: 16, fontWeight: 500 }}>Your favourites</h3>
          {library && favourites.length === 0 && (
            <p style={{ color: "var(--color-muted-text)" }}>No favourites saved yet.</p>
          )}
          <details>
            <summary
              style={{ minHeight: 44, display: "flex", alignItems: "center", cursor: "pointer" }}
            >
              Manage favourites
            </summary>
            {games.map(([id, title]) => (
              <div
                key={id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "6px 0",
                }}
              >
                <Link to={`/games/${id}`}>{title}</Link>
                <Button
                  size="sm"
                  variant={favourites.includes(id) ? "mint" : "secondary"}
                  aria-pressed={favourites.includes(id)}
                  disabled={!library || saving || loading}
                  style={{ minHeight: 44 }}
                  onClick={() =>
                    void save(
                      "favourites",
                      favourites.includes(id)
                        ? favourites.filter((item) => item !== id)
                        : [...favourites, id],
                    )
                  }
                >
                  {favourites.includes(id) ? "Pinned" : "Pin"}
                </Button>
              </div>
            ))}
          </details>
        </section>
        <section aria-label="Shared play next">
          <h3 style={{ fontSize: 16, fontWeight: 500 }}>Play next · shared</h3>
          {library && !loading && queue.length === 0 && (
            <p style={{ color: "var(--color-muted-text)" }}>Choose a game to start the list.</p>
          )}
          {queue.map((id, index) => (
            <div
              key={id}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0" }}
            >
              <span style={{ flex: 1 }}>
                {index + 1}. {games.find(([game]) => game === id)?.[1] ?? id}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Move ${id} up`}
                disabled={!library || saving || loading || index === 0}
                style={{ minHeight: 44 }}
                onClick={() => {
                  const next = [...queue];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  void save("playNext", next);
                }}
              >
                Move up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${id}`}
                disabled={!library || saving || loading}
                style={{ minHeight: 44 }}
                onClick={() =>
                  void save(
                    "playNext",
                    queue.filter((item) => item !== id),
                  )
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 10,
            }}
          >
            <label htmlFor="play-next-game">Add a game</label>
            <select
              id="play-next-game"
              value={queueChoice}
              disabled={!library || saving || loading || queue.length >= games.length}
              onChange={(event) => setQueueChoice(event.target.value)}
            >
              <option value="">Choose a game</option>
              {games
                .filter(([id]) => !queue.includes(id))
                .map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!library || saving || loading || !queueChoice}
              style={{ minHeight: 44 }}
              onClick={() => {
                if (!queueChoice || queue.includes(queueChoice)) return;
                void save("playNext", [...queue, queueChoice]);
                setQueueChoice("");
              }}
            >
              Add
            </Button>
          </div>
        </section>
      </div>
    </Surface>
  );
}
