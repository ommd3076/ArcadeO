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
    return (
      JSON.parse(sessionStorage.getItem("pa_sudoku_selection") || "null") || {
        bucket: "easy",
        number: 1,
        page: 0,
      }
    );
  } catch {
    return { bucket: "easy", number: 1, page: 0 };
  }
}
export function SudokuListScreen() {
  const navigate = useNavigate();
  const [existingMatchId, setExistingMatchId] = useState<string | null>(null);
  const creationRequests = useRef(new Map<string, string>());

  const [selectedBucket, setSelectedBucket] = useState<SudokuBucket>(() => savedSelection().bucket);
  const [selectedMode, setSelectedMode] = useState<SudokuMode>("practice");
  const [selectedNumber, setSelectedNumber] = useState<number>(() => savedSelection().number);
  const [page, setPage] = useState<number>(() => savedSelection().page); // 0..4 (50 puzzles per page)
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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
    apiFetch("/api/v1/records/summary")
      .then((r) => {
        if (!r.ok) throw new Error("Unable to load completion records");
        return r.json();
      })
      .then((data) =>
        setCompletedIds((data as { ownCompletedPuzzleIds?: string[] }).ownCompletedPuzzleIds ?? []),
      )
      .catch(() => setError("Completion records unavailable. Refresh to retry."));
  }, []);
  // Incoming challenges
  const [openChallenges, setOpenChallenges] = useState<OpenChallenge[]>([]);

  useEffect(() => {
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
          : null,
      )
      .then((data) => {
        if (!data?.matches) return;
        const matching = data.matches.find(
          (m) =>
            m.gameId === "sudoku" &&
            m.mode === selectedMode &&
            (m.lifecycle === "active" || m.lifecycle === "waiting"),
        );
        setExistingMatchId(matching?.matchId ?? null);
      })
      .catch(() => {});
  }, [selectedMode]);

  useEffect(() => {
    // Fetch open challenges if in challenge mode
    if (selectedMode === "challenge") {
      apiFetch("/api/v1/challenges")
        .then((res) => (res.ok ? res.json() : null))
        .then((data: unknown) => {
          const resObj = data as { challenges?: OpenChallenge[] } | null;
          if (resObj?.challenges) {
            setOpenChallenges(resObj.challenges);
          }
        })
        .catch(() => {});
    }
  }, [selectedMode]);

  // Derived puzzleId, e.g. "easy-001"
  const puzzleId = `${selectedBucket}-${selectedNumber.toString().padStart(3, "0")}`;

  const handleStartMatch = async () => {
    setError(null);
    setIsStarting(true);
    try {
      const signature = puzzleId + selectedMode;
      let creationId = creationRequests.current.get(signature);
      if (!creationId) {
        creationId = crypto.randomUUID();
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
      <BackHeader title="Sudoku Vault" fallbackTo="/games" />

      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-md)",
          padding: "var(--space-md) var(--space-lg) calc(var(--space-xl) + var(--sab))",
          maxWidth: "520px",
          margin: "0 auto",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {error && <p role="alert">{error}</p>}
        {existingMatchId && (
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
              A saved {selectedMode} attempt is in progress
            </span>
            <div style={{ display: "flex", gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate("/matches/" + existingMatchId)}
              >
                Resume saved attempt
              </Button>
              {selectedMode === "practice" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
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
                          actionId: crypto.randomUUID(),
                          action: "match.request-abandon",
                          expectedVersion: v.deliveryVersion,
                          payload: {},
                        }),
                      });
                      if (actRes.ok) {
                        const reply = (await actRes.json()) as { status: string };
                        if (reply.status === "accepted") {
                          setExistingMatchId(null);
                          creationRequests.current.clear();
                        }
                      }
                    } catch (e) {
                      setError((e as Error).message || "Failed to abandon attempt");
                    }
                  }}
                >
                  Abandon & start fresh
                </Button>
              )}
            </div>
          </div>
        )}
        {/* 1. Mode Selector */}
        <Surface variant="card" padding="sm" radius="lg">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "6px",
            }}
          >
            <Button
              variant={selectedMode === "practice" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedMode("practice")}
              data-testid="mode-practice"
              leftIcon={<Zap size={14} />}
            >
              Practice
            </Button>
            <Button
              variant={selectedMode === "duel" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedMode("duel")}
              data-testid="mode-duel"
              leftIcon={<Swords size={14} />}
            >
              Duel
            </Button>
            <Button
              variant={selectedMode === "challenge" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedMode("challenge")}
              data-testid="mode-challenge"
              leftIcon={<Award size={14} />}
            >
              Challenge
            </Button>
          </div>
        </Surface>

        {/* 2. Open Challenges Notification (if any) */}
        {selectedMode === "challenge" && openChallenges.length > 0 && (
          <Surface
            variant="card"
            padding="md"
            radius="lg"
            style={{ border: "2px solid var(--color-primary, #38bdf8)" }}
          >
            <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "8px" }}>
              Incoming Challenges:
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
                  <div style={{ fontSize: "11px", color: "var(--color-muted-text)" }}>
                    From Player {c.senderAccountId} • Time: {Math.floor(c.senderElapsedMs / 1000)}s
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
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "8px",
          }}
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
              style={{ textTransform: "capitalize", fontWeight: 700 }}
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
            <span style={{ fontSize: "14px", fontWeight: 700 }}>
              Select Puzzle ({page * 50 + 1}–{(page + 1) * 50} of 250):
            </span>

            {/* Pagination Tabs */}
            <div style={{ display: "flex", gap: "4px" }}>
              {[0, 1, 2, 3, 4].map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setPage(p);
                    setSelectedNumber(p * 50 + 1);
                  }}
                  data-testid={`page-${p + 1}`}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: page === p ? "var(--color-primary, #38bdf8)" : "transparent",
                    color: page === p ? "#000" : "var(--color-muted-text)",
                    fontSize: "11px",
                    fontWeight: 700,
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
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: "6px",
              maxHeight: "260px",
              overflowY: "auto",
              padding: "2px",
            }}
          >
            {Array.from({ length: 50 }).map((_, i) => {
              const num = page * 50 + i + 1;
              const isSelected = selectedNumber === num;

              return (
                <button
                  key={num}
                  onClick={() => setSelectedNumber(num)}
                  data-testid={`puzzle-num-${num}`}
                  style={{
                    minHeight: "44px",
                    padding: "8px 0",
                    borderRadius: "8px",
                    border: isSelected
                      ? "2px solid var(--color-primary, #38bdf8)"
                      : "1px solid var(--color-border, #334155)",
                    backgroundColor: isSelected
                      ? "rgba(56, 189, 248, 0.2)"
                      : "var(--color-raised, #1e293b)",
                    color: isSelected ? "var(--color-primary, #38bdf8)" : "var(--color-text)",
                    fontSize: "13px",
                    fontWeight: isSelected ? 800 : 600,
                    cursor: "pointer",
                    transition: "all 150ms ease",
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
          }}
        >
          <div>
            <div style={{ fontSize: "16px", fontWeight: 800 }}>
              {selectedBucket.toUpperCase()} #{selectedNumber}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>
              {selectedMode === "practice"
                ? "Untimed or timed solo play with pause & assist"
                : selectedMode === "duel"
                  ? "Synchronized head-to-head race"
                  : "Asynchronous timed challenge"}
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            disabled={isStarting}
            onClick={handleStartMatch}
            data-testid="start-sudoku-button"
            leftIcon={<Play size={18} />}
          >
            {isStarting ? "Starting..." : "Start Puzzle"}
          </Button>
        </Surface>
      </main>
    </div>
  );
}
