import { apiFetch } from "../app/auth";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackHeader } from "../components/back-header";
import { Surface } from "../components/surface";
import { Button } from "../components/button";
import { Play, Users, Wifi, AlertCircle } from "lucide-react";

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
const LUDO_COLOURS = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
  "cyan",
  "pink",
] as const;
const LUDO_NEAR: Record<string, string> = {
  blue: "cyan",
  cyan: "blue",
  red: "pink",
  pink: "red",
  yellow: "orange",
  orange: "yellow",
};

export function GameDetailScreen() {
  const { gameId = "connect-four" } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [activeMatches, setActiveMatches] = useState<
    Array<{ matchId: string; mode: string; lifecycle: string }>
  >([]);
  const creationRequests = useRef(new Map<string, string>());
  const [selectedMode, setSelectedMode] = useState<"remote" | "together">("remote");
  const [format, setFormat] = useState("best-of-3");
  const [gridSize, setGridSize] = useState<5 | 7 | 9>(5);
  const [ludoColours, setLudoColours] = useState({ A: "blue", B: "green" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const gameTitle = GAME_TITLES[gameId] ?? "Game Details";

  const fetchActiveMatches = useCallback(() => {
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
        const matching = data.matches.filter(
          (m) => m.gameId === gameId && (m.lifecycle === "active" || m.lifecycle === "waiting"),
        );
        setActiveMatches(matching);
      })
      .catch(() => {});
  }, [gameId]);

  useEffect(() => {
    fetchActiveMatches();
  }, [fetchActiveMatches]);

  const activeMatchForMode = activeMatches.find((m) => m.mode === selectedMode);
  const currentExistingMatchId = activeMatchForMode?.matchId;
  const remoteMatch = activeMatches.find((m) => m.mode === "remote");
  const togetherMatch = activeMatches.find((m) => m.mode === "together");

  const handleStartMatch = async () => {
    if (currentExistingMatchId) {
      navigate("/matches/" + currentExistingMatchId);
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const signature = gameId + selectedMode + format + gridSize + ludoColours.A + ludoColours.B;
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
          gameId,
          mode: selectedMode,
          gameOptions:
            gameId === "rock-paper-scissors"
              ? { format }
              : gameId === "dots-boxes" || gameId === "sos"
                ? { gridSize }
                : gameId === "ludo"
                  ? { colours: ludoColours }
                  : {},
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => null)) as {
          code?: string;
          message?: string;
          error?: string;
          existingMatchId?: string;
        } | null;

        // Fulfill API-CONTRACT: SLOT_OCCUPIED -> Resume existing match
        if (errorData?.existingMatchId) {
          creationRequests.current.delete(signature);
          setActiveMatches((prev) => [
            ...prev.filter((m) => m.mode !== selectedMode),
            { matchId: errorData.existingMatchId!, mode: selectedMode, lifecycle: "active" },
          ]);
          navigate("/matches/" + errorData.existingMatchId);
          return;
        }

        fetchActiveMatches();
        throw new Error(
          errorData?.error ??
            errorData?.message ??
            (res.status === 409
              ? "A match is already in progress for this game mode. You can resume or abandon it."
              : `Failed to create match (${res.status})`),
        );
      }

      const data = (await res.json()) as { matchId?: string; view?: { matchId?: string } };
      const matchId = data.matchId || data.view?.matchId;
      if (!matchId) throw new Error("The server did not confirm a saved match. Please retry.");
      creationRequests.current.delete(signature);
      navigate("/matches/" + matchId);
    } catch (err) {
      setErrorMsg(
        (err as Error).message || "Unable to create match. Check your connection and retry.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAbandonSaved = async () => {
    if (!currentExistingMatchId) return;
    setIsAbandoning(true);
    setErrorMsg(null);
    try {
      const viewRes = await apiFetch(`/api/v1/matches/${currentExistingMatchId}`);
      if (!viewRes.ok) throw new Error("Unable to load match status to abandon it.");
      const currentView = (await viewRes.json()) as {
        deliveryVersion: number;
        mode: string;
        lifecycle: string;
        legalActions?: string[];
        controller?: {
          controllingAccountId?: string;
          controllerGeneration: number;
          isController: boolean;
        };
      };

      if (["completed", "resigned", "abandoned", "cancelled"].includes(currentView.lifecycle)) {
        setActiveMatches((prev) => prev.filter((m) => m.matchId !== currentExistingMatchId));
        return;
      }

      let controllerGen = currentView.controller?.controllerGeneration;
      let expectedVersion = currentView.deliveryVersion;
      if (
        currentView.mode === "together" &&
        currentView.controller &&
        !currentView.controller.isController
      ) {
        const ctrlRes = await apiFetch(`/api/v1/matches/${currentExistingMatchId}/controller`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedControllerGeneration: currentView.controller.controllerGeneration,
          }),
        });
        if (ctrlRes.ok) {
          const ctrlData = (await ctrlRes.json()) as {
            controllerGeneration?: number;
            deliveryVersion?: number;
          };
          if (ctrlData.controllerGeneration !== undefined) {
            controllerGen = ctrlData.controllerGeneration;
          }
          if (ctrlData.deliveryVersion !== undefined) {
            expectedVersion = ctrlData.deliveryVersion;
          }
        }
      }

      let action = "match.agree-abandon";
      if (currentView.lifecycle === "waiting") {
        action = "match.cancel";
      } else if (currentView.legalActions && currentView.legalActions.length > 0) {
        if (currentView.legalActions.includes("match.agree-abandon")) {
          action = "match.agree-abandon";
        } else if (currentView.legalActions.includes("match.cancel")) {
          action = "match.cancel";
        } else if (currentView.legalActions.includes("match.request-abandon")) {
          action = "match.request-abandon";
        }
      } else if (currentView.mode !== "together") {
        action = "match.request-abandon";
      }

      const actionRes = await apiFetch(`/api/v1/matches/${currentExistingMatchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolVersion: 1,
          matchId: currentExistingMatchId,
          actionId: crypto.randomUUID(),
          action,
          expectedVersion,
          ...(controllerGen !== undefined ? { controllerGeneration: controllerGen } : {}),
          payload: {},
        }),
      });

      if (!actionRes.ok) {
        const errJson = (await actionRes.json().catch(() => null)) as { message?: string } | null;
        throw new Error(errJson?.message || "Failed to abandon saved match.");
      }

      const reply = (await actionRes.json()) as {
        status: string;
        code?: string;
        message?: string;
      };
      if (reply.status === "rejected") {
        throw new Error(reply.message || `Abandon rejected (${reply.code || "UNKNOWN"})`);
      }

      setActiveMatches((prev) => prev.filter((m) => m.matchId !== currentExistingMatchId));
      creationRequests.current.clear();
    } catch (err) {
      setErrorMsg((err as Error).message || "Failed to abandon match.");
    } finally {
      setIsAbandoning(false);
    }
  };

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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-md)",
            }}
          >
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
              role="button"
              tabIndex={0}
              aria-pressed={selectedMode === "remote"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedMode("remote");
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Wifi size={18} color="var(--color-focus)" />
                <span style={{ fontWeight: 700, fontSize: "15px" }}>Remote</span>
                {remoteMatch && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--color-focus)",
                      border: "1px solid var(--color-focus)",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      marginLeft: "auto",
                      fontWeight: 600,
                    }}
                  >
                    Saved
                  </span>
                )}
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
              role="button"
              tabIndex={0}
              aria-pressed={selectedMode === "together"}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  setSelectedMode("together");
                }
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Users size={18} color="var(--color-accent-fg)" />
                <span style={{ fontWeight: 700, fontSize: "15px" }}>Together</span>
                {togetherMatch && (
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--color-focus)",
                      border: "1px solid var(--color-focus)",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      marginLeft: "auto",
                      fontWeight: 600,
                    }}
                  >
                    Saved
                  </span>
                )}
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-muted-text)", margin: 0 }}>
                Side-by-side on one shared device with private handoffs.
              </p>
            </Surface>
          </div>

          {gameId === "rock-paper-scissors" && (
            <label style={{ display: "block", marginTop: 16 }}>
              Match format{" "}
              <select
                aria-label="Match format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
              >
                {["best-of-3", "best-of-5", "best-of-7"].map((value) => (
                  <option key={value} value={value}>
                    {value.replaceAll("-", " ")}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(gameId === "dots-boxes" || gameId === "sos") && (
            <fieldset style={{ border: 0, padding: 0, marginTop: 16 }}>
              <legend>{gameId === "dots-boxes" ? "Dots per side" : "Cells per side"}</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {([5, 7, 9] as const).map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={gridSize === size ? "primary" : "secondary"}
                    onClick={() => setGridSize(size)}
                    aria-pressed={gridSize === size}
                  >
                    {size} × {size}
                  </Button>
                ))}
              </div>
            </fieldset>
          )}
          {gameId === "ludo" && (
            <fieldset style={{ border: 0, padding: 0, marginTop: 16 }}>
              <legend>Pawn and house colours</legend>
              {(["A", "B"] as const).map((seat) => (
                <label key={seat} style={{ display: "block", marginTop: 8 }}>
                  Player {seat}{" "}
                  <select
                    value={ludoColours[seat]}
                    onChange={(event) =>
                      setLudoColours((current) => ({ ...current, [seat]: event.target.value }))
                    }
                  >
                    {LUDO_COLOURS.map((colour) => (
                      <option
                        key={colour}
                        value={colour}
                        disabled={
                          colour === ludoColours[seat === "A" ? "B" : "A"] ||
                          LUDO_NEAR[colour] === ludoColours[seat === "A" ? "B" : "A"]
                        }
                      >
                        {colour}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </fieldset>
          )}
          {currentExistingMatchId && (
            <div
              style={{
                marginTop: "var(--space-md)",
                padding: "var(--space-md)",
                backgroundColor: "var(--color-surface-elevated)",
                border: "1px solid var(--color-focus)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-sm)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Play size={16} color="var(--color-focus)" />
                <span style={{ fontSize: "14px", fontWeight: 600 }}>
                  A saved {selectedMode} match is in progress
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "var(--color-muted-text)", margin: 0 }}>
                You can resume your game where you left off, or abandon it to start a new match.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-sm)",
                  marginTop: "4px",
                  flexWrap: "wrap",
                }}
              >
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate("/matches/" + currentExistingMatchId)}
                >
                  Resume saved match
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={isAbandoning}
                  onClick={handleAbandonSaved}
                >
                  {isAbandoning ? "Abandoning..." : "Abandon & start fresh"}
                </Button>
              </div>
            </div>
          )}
          {errorMsg && (
            <div
              style={{
                marginTop: "var(--space-md)",
                padding: "var(--space-sm) var(--space-md)",
                backgroundColor: "var(--color-danger-surface)",
                border: "1px solid var(--color-danger)",
                borderRadius: "var(--radius-md)",
                color: "var(--color-danger-text)",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
              role="alert"
            >
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </Surface>

        <div style={{ marginTop: "auto", paddingTop: "var(--space-xl)" }}>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<Play size={20} />}
            onClick={handleStartMatch}
            disabled={isSubmitting || isAbandoning}
            aria-label={currentExistingMatchId ? "Resume Match" : "Start Match"}
          >
            {isSubmitting
              ? "Starting Match..."
              : currentExistingMatchId
                ? "Resume Match"
                : "Start Match"}
          </Button>
        </div>
      </main>
    </div>
  );
}
