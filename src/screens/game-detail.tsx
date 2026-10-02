import { apiFetch } from "../app/auth";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { BackHeader } from "../components/back-header";
import { Surface } from "../components/surface";
import { Button } from "../components/button";
import { useTheme } from "../theme/theme-context";
import { Play, Users, Wifi, AlertCircle, RefreshCw, Check } from "lucide-react";
import { generateUuid } from "../../shared/utils/uuid";
import { LUDO_COLOUR_PALETTE, type LudoColourId } from "../../shared/games/ludo/types";
import type { Seat } from "../../shared/protocol/types";

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
const LUDO_SIMILAR: Partial<Record<LudoColourId, LudoColourId>> = {
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
  const { resolvedMode } = useTheme();
  const [seatNames, setSeatNames] = useState<Record<"A" | "B", string>>({
    A: "Player A",
    B: "Player B",
  });
  const [profileState, setProfileState] = useState<"loading" | "ready" | "error">("loading");
  const [profileRetry, setProfileRetry] = useState(0);
  const [activeMatches, setActiveMatches] = useState<
    Array<{ matchId: string; mode: string; lifecycle: string }>
  >([]);
  const [matchesState, setMatchesState] = useState<"loading" | "ready" | "error">("loading");
  const creationRequests = useRef(new Map<string, string>());
  const [selectedMode, setSelectedMode] = useState<"remote" | "together">("remote");
  const [format, setFormat] = useState("best-of-3");
  const [gridSize, setGridSize] = useState<5 | 7 | 9>(5);
  const [selectedColourSeat, setSelectedColourSeat] = useState<Seat>("A");
  const [ludoColours, setLudoColours] = useState<Record<Seat, LudoColourId>>({
    A: "blue",
    B: "green",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const gameTitle = GAME_TITLES[gameId] ?? "Game Details";

  const fetchActiveMatches = useCallback(() => {
    setMatchesState("loading");
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
          : Promise.reject(new Error(`Unable to load saved games (${r.status})`)),
      )
      .then((data) => {
        if (!data?.matches) {
          setActiveMatches([]);
          setMatchesState("ready");
          return;
        }
        const matching = data.matches.filter(
          (m) =>
            m.gameId === gameId &&
            (m.lifecycle === "active" || m.lifecycle === "waiting" || m.lifecycle === "saved"),
        );
        setActiveMatches(matching);
      })
      .then(() => setMatchesState("ready"))
      .catch(() => setMatchesState("error"));
  }, [gameId]);

  useEffect(() => {
    fetchActiveMatches();
  }, [fetchActiveMatches]);

  useEffect(() => {
    let active = true;
    setProfileState("loading");
    apiFetch("/api/v1/profile")
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load player names (${response.status})`);
        return response.json();
      })
      .then((data: unknown) => {
        const profile = data as {
          profile?: { id?: "A" | "B"; displayName?: string };
          opponent?: { id?: "A" | "B"; displayName?: string };
        } | null;
        if (!active) return;
        if (!profile?.profile || !profile.opponent)
          throw new Error("Player names are unavailable.");
        const names: Record<"A" | "B", string> = { A: "Player A", B: "Player B" };
        if (profile.profile.id && profile.profile.displayName)
          names[profile.profile.id] = profile.profile.displayName;
        if (profile.opponent.id && profile.opponent.displayName)
          names[profile.opponent.id] = profile.opponent.displayName;
        setSeatNames(names);
        setProfileState("ready");
      })
      .catch(() => {
        if (active) setProfileState("error");
      });
    return () => {
      active = false;
    };
  }, [profileRetry]);

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
        creationId = generateUuid();
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
    if (!window.confirm("End this match without a score? This cannot be undone.")) return;
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

      const action = currentView.legalActions?.includes("match.agree-abandon")
        ? "match.agree-abandon"
        : currentView.legalActions?.includes("match.cancel")
          ? "match.cancel"
          : currentView.legalActions?.includes("match.request-abandon")
            ? "match.request-abandon"
            : null;
      if (!action) {
        throw new Error(
          "This match has no unscored-abandon action here. Resume it to review the available choices.",
        );
      }

      const actionRes = await apiFetch(`/api/v1/matches/${currentExistingMatchId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolVersion: 1,
          matchId: currentExistingMatchId,
          actionId: generateUuid(),
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
        view?: { lifecycle?: string };
      };
      if (reply.status === "rejected") {
        throw new Error(reply.message || `Abandon rejected (${reply.code || "UNKNOWN"})`);
      }

      if (reply.view?.lifecycle === "active" && action === "match.request-abandon") {
        setErrorMsg(
          "Unscored abandonment was requested. The other player must agree before this match closes.",
        );
      } else {
        setActiveMatches((prev) => prev.filter((m) => m.matchId !== currentExistingMatchId));
        creationRequests.current.clear();
      }
    } catch (err) {
      setErrorMsg((err as Error).message || "Failed to abandon match.");
    } finally {
      setIsAbandoning(false);
    }
  };

  if (!Object.prototype.hasOwnProperty.call(GAME_TITLES, gameId)) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
        <BackHeader title="Game not found" fallbackTo="/games" />
        <main
          style={{ flex: 1, width: "min(100%, 640px)", margin: "0 auto", padding: "24px 16px" }}
        >
          <Surface variant="card" padding="xl" radius="xl">
            <h2>This game is unavailable</h2>
            <p style={{ color: "var(--color-muted-text)" }}>
              Choose one of the eight games in your arcade to continue.
            </p>
            <Button variant="primary" onClick={() => navigate("/games", { replace: true })}>
              Back to Games
            </Button>
          </Surface>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <BackHeader title={gameTitle} fallbackTo="/games" />

      <div
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
        {profileState === "loading" && (
          <p role="status" style={{ color: "var(--color-muted-text)" }}>
            Loading player names…
          </p>
        )}
        {profileState === "error" && (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>Player names could not load. Retry before inviting someone.</span>
            <Button size="sm" variant="secondary" onClick={() => setProfileRetry((v) => v + 1)}>
              Retry names
            </Button>
          </div>
        )}
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
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: "var(--space-md)",
            }}
          >
            <Surface
              as="button"
              type="button"
              variant={selectedMode === "remote" ? "elevated" : "inset"}
              padding="md"
              radius="lg"
              style={{
                cursor: "pointer",
                color: "var(--color-text)",
                textAlign: "start",
                font: "inherit",
                border:
                  selectedMode === "remote"
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
              onClick={() => setSelectedMode("remote")}
              aria-pressed={selectedMode === "remote"}
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
              as="button"
              type="button"
              variant={selectedMode === "together" ? "elevated" : "inset"}
              padding="md"
              radius="lg"
              style={{
                cursor: "pointer",
                color: "var(--color-text)",
                textAlign: "start",
                font: "inherit",
                border:
                  selectedMode === "together"
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
              onClick={() => setSelectedMode("together")}
              aria-pressed={selectedMode === "together"}
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
                className="arcade-select"
                aria-label="Match format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                style={{ colorScheme: resolvedMode }}
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
              <legend>Choose each player’s pawn colour</legend>
              <div
                role="group"
                aria-label="Player whose pawn colour to choose"
                className="ludo-owner-control"
              >
                {(["A", "B"] as const).map((seat) => (
                  <Button
                    key={seat}
                    variant={selectedColourSeat === seat ? "primary" : "secondary"}
                    aria-pressed={selectedColourSeat === seat}
                    onClick={() => setSelectedColourSeat(seat)}
                    style={{ minHeight: 44, flex: "1 1 140px" }}
                  >
                    {seatNames[seat]}
                  </Button>
                ))}
              </div>
              <div
                className="ludo-setup-swatches"
                role="group"
                aria-label={`${seatNames[selectedColourSeat]} pawn colour`}
              >
                {(Object.entries(LUDO_COLOUR_PALETTE) as [LudoColourId, string][]).map(
                  ([id, color]) => {
                    const otherSeat: Seat = selectedColourSeat === "A" ? "B" : "A";
                    const otherColour = ludoColours[otherSeat];
                    const unavailable = id === otherColour || LUDO_SIMILAR[id] === otherColour;
                    const selected = ludoColours[selectedColourSeat] === id;
                    const label = id[0].toUpperCase() + id.slice(1);
                    const explanation = unavailable
                      ? id === otherColour
                        ? `Already used by ${seatNames[otherSeat]}.`
                        : `Too similar to ${seatNames[otherSeat]}’s ${otherColour} pawns.`
                      : "";
                    return (
                      <button
                        key={id}
                        type="button"
                        className="ludo-setup-swatch"
                        aria-label={`${seatNames[selectedColourSeat]}: ${label}${selected ? ", selected" : ""}${explanation ? `, unavailable. ${explanation}` : ""}`}
                        aria-pressed={selected}
                        title={explanation || label}
                        disabled={unavailable || profileState !== "ready"}
                        onClick={() =>
                          setLudoColours((current) => ({ ...current, [selectedColourSeat]: id }))
                        }
                      >
                        <span
                          aria-hidden="true"
                          className="ludo-setup-swatch__sample"
                          style={{ backgroundColor: color }}
                        />
                        <span>{label}</span>
                        {selected && <Check size={16} aria-hidden="true" />}
                      </button>
                    );
                  },
                )}
              </div>
              <p style={{ margin: "8px 0 0", color: "var(--color-muted-text)", fontSize: 13 }}>
                Colors used by or easily confused with{" "}
                {seatNames[selectedColourSeat === "A" ? "B" : "A"]} are unavailable.
              </p>
            </fieldset>
          )}
          {matchesState === "loading" && (
            <p role="status" style={{ marginTop: 16, color: "var(--color-muted-text)" }}>
              Checking for a saved {selectedMode} match…
            </p>
          )}
          {matchesState === "error" && (
            <div
              role="alert"
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 12,
                marginTop: 16,
              }}
            >
              <span>Saved match status is unavailable. Retry before starting a new match.</span>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<RefreshCw size={16} />}
                onClick={fetchActiveMatches}
              >
                Retry
              </Button>
            </div>
          )}
          {matchesState === "ready" && !currentExistingMatchId && (
            <p
              style={{
                margin: "var(--space-md) 0 0",
                color: "var(--color-muted-text)",
                fontSize: 14,
              }}
            >
              No saved {selectedMode} match. Your next game will use this setup.
            </p>
          )}
          {matchesState === "ready" && currentExistingMatchId && (
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
                  {activeMatchForMode?.lifecycle === "saved"
                    ? `Paused ${selectedMode} match`
                    : `A ${selectedMode} match is ready to resume`}
                </span>
              </div>
              <p style={{ fontSize: "14px", color: "var(--color-muted-text)", margin: 0 }}>
                Resume the accepted match state below. To abandon it without a score, confirm the
                separate abandonment action.
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
                  variant="secondary"
                  size="sm"
                  style={{ minHeight: 44 }}
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
            disabled={
              isSubmitting ||
              isAbandoning ||
              matchesState !== "ready" ||
              (gameId === "ludo" && profileState !== "ready")
            }
            aria-label={currentExistingMatchId ? "Resume Match" : "Start Match"}
          >
            {isSubmitting
              ? "Starting Match..."
              : currentExistingMatchId
                ? "Resume Match"
                : "Start Match"}
          </Button>
        </div>
      </div>
    </div>
  );
}
