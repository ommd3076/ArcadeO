import { apiFetch } from "../app/auth";
/**
 * Private Arcade V1 — Sudoku Catalog & Mode Launcher Screen
 *
 * Provides:
 * - 1,000 launch puzzle catalog browsing (250 Easy, 250 Medium, 250 Hard, 250 Expert)
 * - Mode selection: Solo Practice, Live Duel, Asynchronous Challenge
 * - Direct puzzle number selection (1..250 per difficulty)
 * - Discovery and acceptance of open asynchronous challenges
 * - Match creation and routing to MatchScreen
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { BackHeader } from "../components/back-header";
import { Surface } from "../components/surface";
import { Button } from "../components/button";
import { Zap, Swords, Award, Play } from "lucide-react";
import { generateUuid } from "../../shared/utils/uuid";

type SudokuBucket = "easy" | "medium" | "hard" | "expert";
type SudokuMode = "practice" | "duel" | "challenge";

interface OpenChallenge {
  challengeId: string;
  puzzleId: string;
  senderAccountId: string;
  senderElapsedMs: number;
  createdAt: number;
}

function savedSelection(): { bucket: SudokuBucket; number: number; page: number } {
  try {
    const saved = JSON.parse(sessionStorage.getItem("pa_sudoku_selection") || "null") as Partial<{
      bucket: SudokuBucket;
      number: number;
    }> | null;
    const bucket = ["easy", "medium", "hard", "expert"].includes(saved?.bucket ?? "")
      ? (saved?.bucket as SudokuBucket)
      : "easy";
    const storedNumber = saved?.number;
    const number = Number.isInteger(storedNumber)
      ? Math.min(250, Math.max(1, storedNumber as number))
      : 1;
    return { bucket, number, page: Math.floor((number - 1) / 50) };
  } catch {
    return { bucket: "easy", number: 1, page: 0 };
  }
}
export function SudokuListScreen() {
  const navigate = useNavigate();
  const [existingMatchId, setExistingMatchId] = useState<string | null>(null);
  const [existingLifecycle, setExistingLifecycle] = useState<string | null>(null);
  const creationRequests = useRef(new Map<string, string>());

  const [selectedBucket, setSelectedBucket] = useState<SudokuBucket>(() => savedSelection().bucket);
  const [selectedMode, setSelectedMode] = useState<SudokuMode>("practice");
  const [selectedNumber, setSelectedNumber] = useState<number>(() => savedSelection().number);
  const [page, setPage] = useState<number>(() => savedSelection().page); // 0..4 (50 puzzles per page)
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [completionState, setCompletionState] = useState<"loading" | "ready" | "error">("loading");
  const [matchState, setMatchState] = useState<"loading" | "ready" | "error">("loading");
  const [challengeState, setChallengeState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [matchRetry, setMatchRetry] = useState(0);
  const [challengeRetry, setChallengeRetry] = useState(0);
  const [completionRetry, setCompletionRetry] = useState(0);

  const [completedIds, setCompletedIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "pa_sudoku_selection",
        JSON.stringify({ bucket: selectedBucket, number: selectedNumber, page }),
      );
    } catch {}
  }, [selectedBucket, selectedNumber, page]);
  useEffect(() => {
    setCompletionState("loading");
    apiFetch("/api/v1/records/summary")
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load completion records");
        return r.json();
      })
      .then((data) =>
        setCompletedIds((data as { ownCompletedPuzzleIds?: string[] }).ownCompletedPuzzleIds ?? []),
      )
      .then(() => setCompletionState("ready"))
      .catch(() => setCompletionState("error"));
    apiFetch("/api/v1/profile")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const profile = data as { opponent?: { displayName?: string } } | null;
        setPartnerName(profile?.opponent?.displayName ?? null);
      })
      .catch(() => setPartnerName(null));
  }, [completionRetry]);
  // Incoming challenges
  const [openChallenges, setOpenChallenges] = useState<OpenChallenge[]>([]);

  useEffect(() => {
    setMatchState("loading");
    apiFetch("/api/v1/matches")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{
              matches?: Array<{
                matchId: string;
                gameId: string;
                mode: string;
                lifecycle: string;
              }>;
            }>)
          : Promise.reject(new Error("Unable to check saved Sudoku attempts")),
      )
      .then((data) => {
        if (!data?.matches) {
          setExistingMatchId(null);
          setExistingLifecycle(null);
          setMatchState("ready");
          return;
        }
        const matching = data.matches.find(
          (m) =>
            m.gameId === "sudoku" &&
            m.mode === selectedMode &&
            (m.lifecycle === "active" || m.lifecycle === "waiting" || m.lifecycle === "saved"),
        );
        setExistingMatchId(matching?.matchId ?? null);
        setExistingLifecycle(matching?.lifecycle ?? null);
        setMatchState("ready");
      })
      .catch(() => setMatchState("error"));
  }, [selectedMode, matchRetry]);

  useEffect(() => {
    // Fetch open challenges if in challenge mode
    if (selectedMode === "challenge") {
      setChallengeState("loading");
      apiFetch("/api/v1/challenges")
        .then((res) => {
          if (!res.ok) throw new Error("Unable to load incoming challenges");
          return res.json();
        })
        .then((data: unknown) => {
          const resObj = data as { challenges?: OpenChallenge[] } | null;
          setOpenChallenges(resObj?.challenges ?? []);
          setChallengeState("ready");
        })
        .catch(() => setChallengeState("error"));
    } else {
      setChallengeState("idle");
    }
  }, [selectedMode, challengeRetry]);

  // Derived puzzleId, e.g. "easy-001"
  const puzzleId = `${selectedBucket}-${selectedNumber.toString().padStart(3, "0")}`;

  const handleStartMatch = async () => {
    setError(null);
    if (existingMatchId) {
      navigate(`/matches/${existingMatchId}`);
      return;
    }
    setIsStarting(true);
    try {
      const signature = puzzleId + selectedMode;
      let creationId = creationRequests.current.get(signature);
      if (!creationId) {
        creationId = generateUuid();
        creationRequests.current.set(signature, creationId);
      }

      const res = await apiFetch("/api/v1/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creationId,
          gameId: "sudoku",
          mode: selectedMode,
          gameOptions: {
            puzzleId,
          },
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          existingMatchId?: string;
          error?: string;
        } | null;
        if (data?.existingMatchId) {
          setExistingMatchId(data.existingMatchId);
          navigate(`/matches/${data.existingMatchId}`);
          return;
        }
        throw new Error(
          data?.error || "A saved attempt may already occupy this mode. Resume it or retry.",
        );
      }

      const matchData = (await res.json()) as { matchId: string };
      creationRequests.current.delete(signature);
      navigate(`/matches/${matchData.matchId}`);
    } catch (err) {
      setError((err as Error).message);
      setIsStarting(false);
    }
  };

  const handleAcceptChallenge = async (challengeId: string) => {
    navigate(`/matches/${challengeId}`);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-canvas)",
        color: "var(--color-text)",
      }}
    >
      <BackHeader title="Sudoku" fallbackTo="/games" />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--space-md) var(--space-lg) calc(var(--space-xl) + var(--sab))",
          maxWidth: "820px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {error && <p role="alert">{error}</p>}
        {completionState === "loading" && (
          <p role="status" style={{ color: "var(--color-muted-text)" }}>
            Loading your completed-puzzle markers…
          </p>
        )}
        {completionState === "error" && (
          <div
            role="status"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 10,
              color: "var(--color-muted-text)",
            }}
          >
            <span>
              Completion markers are unavailable right now. You can still choose and start a puzzle.
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCompletionRetry((value) => value + 1)}
            >
              Retry markers
            </Button>
          </div>
        )}
        {matchState === "loading" && (
          <p role="status" style={{ color: "var(--color-muted-text)" }}>
            Checking for a saved attempt…
          </p>
        )}
        {matchState === "error" && (
          <div
            role="alert"
            style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
          >
            <span>Saved-attempt status is unavailable. Retry before starting or resuming.</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMatchRetry((value) => value + 1)}
            >
              Retry check
            </Button>
          </div>
        )}
        {matchState === "ready" && existingMatchId && (
          <div
            style={{
              padding: "var(--space-md)",
              backgroundColor: "var(--color-surface-elevated)",
              border: "1px solid var(--color-focus)",
              borderRadius: "var(--radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
            }}
          >
            <span style={{ fontSize: "14px", fontWeight: 600 }}>
              {existingLifecycle === "saved"
                ? `Paused ${selectedMode} attempt`
                : `${selectedMode} attempt ready to continue`}
            </span>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate("/matches/" + existingMatchId)}
              >
                {existingLifecycle === "saved" ? "Resume saved attempt" : "Continue attempt"}
              </Button>
              {selectedMode === "practice" && (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isAbandoning}
                  onClick={async () => {
                    if (
                      !window.confirm(
                        "Abandon this practice attempt without a score? This cannot be undone.",
                      )
                    )
                      return;
                    setIsAbandoning(true);
                    setError(null);
                    try {
                      const vRes = await apiFetch(`/api/v1/matches/${existingMatchId}`);
                      if (!vRes.ok) throw new Error("Unable to check match status.");
                      const v = (await vRes.json()) as { deliveryVersion: number };
                      const actRes = await apiFetch(`/api/v1/matches/${existingMatchId}/actions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          protocolVersion: 1,
                          matchId: existingMatchId,
                          actionId: generateUuid(),
                          action: "match.request-abandon",
                          expectedVersion: v.deliveryVersion,
                          payload: {},
                        }),
                      });
                      const reply = (await actRes.json().catch(() => ({}))) as {
                        status?: string;
                        message?: string;
                      };
                      if (!actRes.ok || reply.status !== "accepted")
                        throw new Error(reply.message || "Abandon request was not accepted.");
                      setExistingMatchId(null);
                      creationRequests.current.clear();
                    } catch (e) {
                      setError((e as Error).message || "Failed to abandon attempt");
                    } finally {
                      setIsAbandoning(false);
                    }
                  }}
                >
                  {isAbandoning ? "Abandoning…" : "Abandon & start fresh"}
                </Button>
              )}
            </div>
          </div>
        )}
        {/* 1. Mode Selector */}
        <Surface variant="card" padding="md" radius="xl">
          <h2 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 5px" }}>Choose your Sudoku</h2>
          <p style={{ fontSize: 14, color: "var(--color-muted-text)", margin: "0 0 16px" }}>
            Pick a mode, difficulty and numbered puzzle. Your practice results stay personal.
          </p>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 15, fontWeight: 650, marginBottom: 10 }}>Play mode</legend>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 100px), 1fr))",
                gap: "8px",
              }}
            >
              <Button
                variant={selectedMode === "practice" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedMode("practice")}
                data-testid="mode-practice"
                aria-pressed={selectedMode === "practice"}
                style={{ minHeight: 44 }}
                leftIcon={<Zap size={14} />}
              >
                Practice
              </Button>
              <Button
                variant={selectedMode === "duel" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedMode("duel")}
                data-testid="mode-duel"
                aria-pressed={selectedMode === "duel"}
                style={{ minHeight: 44 }}
                leftIcon={<Swords size={14} />}
              >
                Duel
              </Button>
              <Button
                variant={selectedMode === "challenge" ? "primary" : "ghost"}
                size="sm"
                onClick={() => setSelectedMode("challenge")}
                data-testid="mode-challenge"
                aria-pressed={selectedMode === "challenge"}
                style={{ minHeight: 44 }}
                leftIcon={<Award size={14} />}
              >
                Challenge
              </Button>
            </div>
          </fieldset>
        </Surface>

        {/* 2. Open Challenges Notification (if any) */}
        {selectedMode === "challenge" && challengeState === "loading" && (
          <p role="status" style={{ color: "var(--color-muted-text)" }}>
            Checking for incoming challenges…
          </p>
        )}
        {selectedMode === "challenge" && challengeState === "error" && (
          <div
            role="alert"
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              padding: 14,
              borderRadius: "var(--radius-lg)",
              background: "var(--color-danger-surface)",
              color: "var(--color-danger-text)",
            }}
          >
            <span>Incoming challenges could not be loaded.</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setChallengeRetry((value) => value + 1)}
            >
              Retry
            </Button>
          </div>
        )}
        {selectedMode === "challenge" &&
          challengeState === "ready" &&
          openChallenges.length === 0 && (
            <p style={{ color: "var(--color-muted-text)", margin: 0 }}>
              No incoming Sudoku challenges right now.
            </p>
          )}
        {selectedMode === "challenge" &&
          challengeState === "ready" &&
          openChallenges.length > 0 && (
            <Surface
              variant="card"
              padding="md"
              radius="lg"
              style={{ border: "1px solid var(--color-focus)" }}
            >
              <div style={{ fontSize: "18px", fontWeight: 650, marginBottom: "8px" }}>
                Incoming challenges
              </div>
              {openChallenges.map((c) => (
                <div
                  key={c.challengeId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--color-border)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>{c.puzzleId}</div>
                    <div style={{ fontSize: "14px", color: "var(--color-muted-text)" }}>
                      From {partnerName ?? "your opponent"}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAcceptChallenge(c.challengeId)}
                  >
                    Open invitation
                  </Button>
                </div>
              ))}
            </Surface>
          )}

        {/* 3. Difficulty Selector */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 70px), 1fr))",
            gap: "8px",
          }}
          role="group"
          aria-label="Sudoku difficulty"
        >
          {(["easy", "medium", "hard", "expert"] as SudokuBucket[]).map((bucket) => (
            <Button
              key={bucket}
              variant={selectedBucket === bucket ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setSelectedBucket(bucket);
                setSelectedNumber(page * 50 + 1);
              }}
              data-testid={`bucket-${bucket}`}
              aria-pressed={selectedBucket === bucket}
              style={{ minHeight: 44, textTransform: "capitalize", fontWeight: 700 }}
            >
              {bucket}
            </Button>
          ))}
        </div>

        {/* 4. Puzzle Number Selector (Grid of 50 per page) */}
        <Surface variant="card" padding="md" radius="xl">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <span style={{ fontSize: "15px", fontWeight: 650 }}>
              Select Puzzle ({page * 50 + 1}–{(page + 1) * 50} of 250):
            </span>

            {/* Pagination Tabs */}
            <div
              style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}
              role="group"
              aria-label="Puzzle page"
            >
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPage(p);
                    setSelectedNumber(p * 50 + 1);
                  }}
                  data-testid={`page-${p + 1}`}
                  aria-label={`Puzzles ${p * 50 + 1} to ${(p + 1) * 50}`}
                  aria-current={page === p ? "page" : undefined}
                  style={{
                    minWidth: "44px",
                    minHeight: "44px",
                    padding: "8px",
                    borderRadius: "var(--radius-full)",
                    border:
                      page === p ? "2px solid var(--color-focus)" : "1px solid var(--color-border)",
                    backgroundColor:
                      page === p ? "var(--color-emphasis-mint-bg)" : "var(--color-raised)",
                    color: page === p ? "var(--color-emphasis-mint-ink)" : "var(--color-text)",
                    fontSize: "14px",
                    fontWeight: 650,
                    cursor: "pointer",
                  }}
                >
                  {p + 1}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
              gap: "6px",
              maxHeight: "260px",
              overflowY: "auto",
              padding: "2px",
            }}
            role="group"
            aria-label={`Puzzle numbers ${page * 50 + 1} through ${(page + 1) * 50}`}
          >
            {Array.from({ length: 50 }).map((_, i) => {
              const num = page * 50 + i + 1;
              const isSelected = selectedNumber === num;

              return (
                <button
                  key={num}
                  onClick={() => setSelectedNumber(num)}
                  data-testid={`puzzle-num-${num}`}
                  aria-pressed={isSelected}
                  aria-label={`Puzzle ${num}${completedIds.includes(`${selectedBucket}-${String(num).padStart(3, "0")}`) ? ", completed before" : ""}`}
                  style={{
                    minHeight: "44px",
                    padding: "8px 0",
                    borderRadius: "8px",
                    border: isSelected
                      ? "2px solid var(--color-focus)"
                      : "1px solid var(--color-border)",
                    backgroundColor: isSelected
                      ? "var(--color-emphasis-mint-bg)"
                      : "var(--color-raised)",
                    color: isSelected ? "var(--color-emphasis-mint-ink)" : "var(--color-text)",
                    fontSize: "13px",
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    transition:
                      "background-color 120ms ease, border-color 120ms ease, color 120ms ease",
                  }}
                >
                  #{num}
                  {completedIds.includes(`${selectedBucket}-${String(num).padStart(3, "0")}`)
                    ? " ✓"
                    : ""}
                </button>
              );
            })}
          </div>
        </Surface>

        {/* 5. Start Match Action */}
        <Surface
          variant="card"
          padding="md"
          radius="xl"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800 }}>
              {selectedBucket.toUpperCase()} #{selectedNumber}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>
              {selectedMode === "practice"
                ? "Solo practice with pause, notes and entry check"
                : selectedMode === "duel"
                  ? "Synchronized head-to-head race"
                  : "Asynchronous timed challenge"}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            disabled={isStarting || isAbandoning || matchState !== "ready"}
            onClick={handleStartMatch}
            data-testid="start-sudoku-button"
            leftIcon={<Play size={18} />}
          >
            {isStarting ? "Starting…" : existingMatchId ? "Resume saved attempt" : "Start puzzle"}
          </Button>
        </Surface>
      </div>
    </div>
  );
}
