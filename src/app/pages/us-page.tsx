import { useAuth, apiFetch } from "../auth";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { useTheme } from "../../theme/theme-context";
import type { PaletteFamily, ThemeMode, AccentFamily } from "@shared/protocol/types";
import {
  Palette,
  Sun,
  Moon,
  Monitor,
  Heart,
  Shield,
  LogOut,
  Flame,
  History,
  RefreshCw,
  Sparkles,
  Pause,
} from "lucide-react";

interface RecordsData {
  summary: {
    totalPlayed: number;
    winsA: number;
    winsB: number;
    draws: number;
    playDayStreak?: number;
    currentStreak: { holder: "A" | "B" | null; count: number } | null;
  };
  byGame: Record<string, { played: number; winsA: number; winsB: number; draws: number }>;
  soloRecords?: Record<
    "A" | "B",
    Array<{ puzzleId: string; elapsedMs: number; assisted: number; replay?: boolean }>
  >;
  cricketRecords?: {
    highestCompletedInnings: number;
    battingRuns: Record<"A" | "B", number>;
    bowlingWickets: Record<"A" | "B", number>;
  };
  sharedRecap?: Array<{
    matchId: string;
    gameId: string;
    mode: string;
    winnerAccountId: string | null;
    reason: string;
    finishedAt: number;
  }>;
}

interface ProfileData {
  profile: {
    id: "A" | "B";
    username: string;
    displayName: string;
    accentFamily: AccentFamily;
    paletteFamily: PaletteFamily;
    preferenceVersion: number;
  };
  opponent: {
    id: "A" | "B";
    username: string;
    displayName: string;
    accentFamily: AccentFamily;
    paletteFamily: PaletteFamily;
  };
  csrfToken: string;
}

type LoadState = "loading" | "ready" | "error";

interface SavedMatch {
  matchId: string;
  gameId: string;
  mode: string;
  lifecycle: string;
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

const duration = (elapsedMs: number) => {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${totalMinutes}:${String(seconds).padStart(2, "0")}`;
};

export function UsPage() {
  const { logout, session, refresh } = useAuth();
  const { family, mode, playerAccent, setFamily, setMode, setPlayerAccent } = useTheme();
  const [records, setRecords] = useState<RecordsData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [recordsState, setRecordsState] = useState<LoadState>("loading");
  const [profileState, setProfileState] = useState<LoadState>("loading");
  const [recentState, setRecentState] = useState<LoadState>("loading");
  const [savedMatches, setSavedMatches] = useState<SavedMatch[]>([]);
  const [savedMatchesState, setSavedMatchesState] = useState<LoadState>("loading");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setRecordsState("loading");
    setProfileState("loading");
    setRecentState("loading");
    setSavedMatchesState("loading");

    const fetchJson = async <T,>(path: string): Promise<T> => {
      const response = await apiFetch(path);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      return (await response.json()) as T;
    };

    void Promise.allSettled([
      fetchJson<RecordsData>("/api/v1/records/summary"),
      fetchJson<ProfileData>("/api/v1/profile"),
      fetchJson<{ sharedRecap?: NonNullable<RecordsData["sharedRecap"]> }>(
        "/api/v1/records/recent",
      ),
      fetchJson<{ matches?: SavedMatch[] }>("/api/v1/matches"),
    ]).then(([recordsResult, profileResult, recentResult, matchesResult]) => {
      if (!isMounted) return;

      if (recordsResult.status === "fulfilled") {
        setRecords(recordsResult.value);
        setRecordsState("ready");
      } else {
        setRecords(null);
        setRecordsState("error");
      }

      if (profileResult.status === "fulfilled") {
        setProfile(profileResult.value);
        setNameDraft(profileResult.value.profile.displayName);
        setFamily(profileResult.value.profile.paletteFamily);
        setPlayerAccent(profileResult.value.profile.accentFamily);
        setProfileState("ready");
      } else {
        setProfile(null);
        setProfileState("error");
      }

      if (recentResult.status === "fulfilled") {
        setRecords((current) =>
          current ? { ...current, sharedRecap: recentResult.value.sharedRecap ?? [] } : current,
        );
        setRecentState("ready");
      } else {
        setRecentState("error");
      }

      if (matchesResult.status === "fulfilled") {
        setSavedMatches(
          (matchesResult.value.matches ?? []).filter((match) => match.lifecycle === "saved"),
        );
        setSavedMatchesState("ready");
      } else {
        setSavedMatches([]);
        setSavedMatchesState("error");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [reload, setFamily, setPlayerAccent]);

  const handleUpdatePreferences = async (
    newFamily?: PaletteFamily,
    newAccent?: AccentFamily,
    newName?: string,
  ) => {
    if (!profile || savingPreferences) return;
    const updatedFamily = newFamily ?? family;
    const updatedAccent = newAccent ?? playerAccent;
    setSavingPreferences(true);
    setSaveStatus("Saving account preferences…");
    let serverAccepted = false;

    try {
      const response = await apiFetch("/api/v1/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paletteFamily: updatedFamily,
          accentFamily: updatedAccent,
          ...(newName !== undefined ? { displayName: newName.trim() } : {}),
          expectedPreferenceVersion: profile.profile.preferenceVersion,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
        if (response.status === 409 || body.code === "STALE_STATE") {
          setSaveStatus(
            "Preferences changed on another device. Reload your account settings and retry.",
          );
        } else {
          setSaveStatus(`Could not save preferences: ${body.error || response.statusText}`);
        }
        return;
      }

      const body = (await response.json()) as
        ProfileData["profile"] | { profile: ProfileData["profile"] };
      const updatedProfile = "profile" in body ? body.profile : body;
      serverAccepted = true;
      setProfile((current) =>
        current
          ? {
              ...current,
              profile: {
                ...current.profile,
                ...updatedProfile,
              },
            }
          : current,
      );
      let localThemeStored = true;
      try {
        if (newFamily) setFamily(updatedFamily);
        if (newAccent) setPlayerAccent(updatedAccent);
      } catch {
        localThemeStored = false;
      }
      if (newName !== undefined) setNameDraft(updatedProfile.displayName);
      setSaveStatus(
        localThemeStored
          ? "Account preferences saved."
          : "Account preferences saved, but this browser could not store the local theme preview.",
      );
      await refresh();
    } catch (error) {
      setSaveStatus(
        serverAccepted
          ? "Account preferences were accepted, but the local appearance could not be fully applied. Reload this page to refresh it."
          : `Could not save preferences. Check your connection and retry. ${(error as Error).message}`,
      );
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      setSaveStatus((error as Error).message);
    }
  };

  const setDeviceMode = (nextMode: ThemeMode) => {
    try {
      setMode(nextMode);
      if (session) {
        localStorage.setItem(`pa_theme_mode_${session.profile.id}`, nextMode);
        setSaveStatus("Display mode saved on this device.");
      }
    } catch {
      setSaveStatus("Display mode changed for this session but could not be saved on this device.");
    }
  };

  const families: { id: PaletteFamily; label: string; description: string }[] = [
    {
      id: "standard",
      label: "Standard",
      description: "Charcoal or porcelain with mint, cyan and warm yellow accents.",
    },
    {
      id: "romantic",
      label: "Romantic",
      description: "Purple in dark mode and soft pink in light mode.",
    },
  ];
  const modes: { id: ThemeMode; label: string; icon: typeof Moon }[] = [
    { id: "dark", label: "Dark", icon: Moon },
    { id: "light", label: "Light", icon: Sun },
    { id: "system", label: "System", icon: Monitor },
  ];
  const accents: { id: AccentFamily; label: string; color: string }[] = [
    { id: "teal", label: "Teal", color: "#68D6C2" },
    { id: "violet", label: "Violet", color: "#C5A2FF" },
    { id: "cyan", label: "Cyan", color: "#67E8F9" },
    { id: "mint", label: "Mint", color: "#86EFAC" },
    { id: "pink", label: "Pink", color: "#F472B6" },
    { id: "yellow", label: "Yellow", color: "#FDE047" },
  ];
  const opponentAccent = profile?.opponent.accentFamily;
  const accountName = (id: string | null | undefined) => {
    if (!id) return "Unknown player";
    if (!profile) {
      if (session?.profile.id === id) return session.profile.displayName;
      return id === "A" || id === "B" ? "Other player" : "Unknown player";
    }
    if (id === profile.profile.id) return profile.profile.displayName;
    if (id === profile.opponent.id) return profile.opponent.displayName;
    return "Unknown player";
  };
  const streak = records?.summary.currentStreak;
  const profileBusy = profileState !== "ready" || savingPreferences;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
        padding:
          "calc(var(--space-2xl) + var(--sat)) max(16px, var(--space-lg)) calc(96px + var(--sab))",
        maxWidth: "1080px",
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <header style={{ maxWidth: "720px" }}>
        <p
          style={{
            color: "var(--color-focus)",
            fontSize: "13px",
            fontWeight: 700,
            margin: "0 0 8px",
          }}
        >
          YOUR ARCADE
        </p>
        <h1
          style={{
            fontSize: "clamp(32px, 6vw, 42px)",
            lineHeight: 1.08,
            fontWeight: 700,
            fontFamily: "var(--font-heading)",
            margin: 0,
          }}
        >
          Us &amp; appearance
        </h1>
        <p
          style={{
            color: "var(--color-muted-text)",
            fontSize: "16px",
            lineHeight: 1.5,
            margin: "10px 0 0",
          }}
        >
          {profile
            ? `Shared records for ${profile.profile.displayName} and ${profile.opponent.displayName}, with your personal display settings.`
            : "Shared records and your personal display settings."}
        </p>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: "var(--space-xl)",
          alignItems: "start",
        }}
      >
        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", minWidth: 0 }}
        >
          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Pause size={19} color="var(--color-focus)" aria-hidden="true" />
              <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Saved matches</h2>
            </div>
            <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "0 0 14px" }}>
              Matches you paused stay here until you resume or explicitly end them.
            </p>
            {savedMatchesState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading saved matches…
              </p>
            )}
            {savedMatchesState === "error" && (
              <div
                role="alert"
                style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}
              >
                <span>Saved matches could not be loaded.</span>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={() => setReload((value) => value + 1)}
                >
                  Retry
                </Button>
              </div>
            )}
            {savedMatchesState === "ready" && savedMatches.length === 0 && (
              <p style={{ color: "var(--color-muted-text)", margin: 0 }}>No paused matches.</p>
            )}
            {savedMatchesState === "ready" && savedMatches.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                {savedMatches.map((match) => {
                  const title = gameNames[match.gameId] ?? match.gameId.replaceAll("-", " ");
                  const modeName =
                    match.mode === "together"
                      ? "Together"
                      : match.mode === "remote"
                        ? "Remote"
                        : match.mode;
                  return (
                    <article key={match.matchId} className="saved-match-row">
                      <div className="saved-match-row__copy">
                        <h3>{title}</h3>
                        <p>{modeName} · Paused</p>
                      </div>
                      <Link
                        to={`/matches/${encodeURIComponent(match.matchId)}`}
                        className="arcade-btn arcade-btn--rounded arcade-btn--md arcade-btn--secondary"
                        aria-label={`Resume paused ${title} match`}
                      >
                        Resume
                      </Link>
                    </article>
                  );
                })}
              </div>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Heart size={20} color="var(--color-accent-fg)" aria-hidden="true" />
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Shared records</h2>
                <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "4px 0 0" }}>
                  Scored head-to-head games
                </p>
              </div>
            </div>
            {recordsState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading shared records…
              </p>
            )}
            {recordsState === "error" && (
              <div role="alert" style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0 }}>Shared records could not be loaded.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={() => setReload((value) => value + 1)}
                >
                  Retry loading records
                </Button>
              </div>
            )}
            {recordsState === "ready" && records && (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 10,
                  }}
                >
                  {[
                    [accountName("A"), records.summary.winsA],
                    ["Draws", records.summary.draws],
                    [accountName("B"), records.summary.winsB],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      style={{
                        minWidth: 0,
                        padding: "14px 10px",
                        borderRadius: "var(--radius-lg)",
                        background: "var(--color-raised)",
                        textAlign: "center",
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          fontSize: "clamp(22px, 5vw, 30px)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {value}
                      </strong>
                      <span
                        style={{
                          display: "block",
                          fontSize: 13,
                          lineHeight: 1.35,
                          color: "var(--color-muted-text)",
                          overflowWrap: "anywhere",
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "14px 0 0", color: "var(--color-muted-text)", fontSize: 14 }}>
                  {records.summary.totalPlayed === 0
                    ? "No scored shared games yet."
                    : `${records.summary.totalPlayed} scored shared game${records.summary.totalPlayed === 1 ? "" : "s"} recorded.`}
                </p>
                {streak && streak.count > 0 && streak.holder && (
                  <p
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "12px 0 0",
                      fontSize: 14,
                    }}
                  >
                    <Flame size={17} color="var(--color-focus)" aria-hidden="true" />
                    <span>
                      {accountName(streak.holder)} has the current {streak.count}-win streak.
                    </span>
                  </p>
                )}
                {records.summary.playDayStreak ? (
                  <p style={{ color: "var(--color-muted-text)", margin: "8px 0 0", fontSize: 14 }}>
                    {records.summary.playDayStreak} shared play day
                    {records.summary.playDayStreak === 1 ? "" : "s"} in a row
                  </p>
                ) : null}
              </>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <h2 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 4px" }}>By game</h2>
            <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "0 0 16px" }}>
              Wins, draws and completed shared matches.
            </p>
            {recordsState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading game records…
              </p>
            )}
            {recordsState === "error" && (
              <p role="alert">Game records are unavailable until the records request succeeds.</p>
            )}
            {recordsState === "ready" && records && Object.keys(records.byGame).length === 0 && (
              <p style={{ color: "var(--color-muted-text)", marginBottom: 0 }}>
                Game-by-game records will appear after your first scored shared match.
              </p>
            )}
            {recordsState === "ready" && records && Object.entries(records.byGame).length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
                  gap: 10,
                }}
              >
                {Object.entries(records.byGame).map(([game, entry]) => (
                  <div
                    key={game}
                    style={{
                      padding: "14px 16px",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--color-raised)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 650 }}>
                      {gameNames[game] ?? game.replaceAll("-", " ")}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: "var(--color-muted-text)",
                      }}
                    >
                      {entry.played} played · {entry.winsA} {accountName("A")} · {entry.winsB}{" "}
                      {accountName("B")} · {entry.draws} draws
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <History size={19} color="var(--color-focus)" aria-hidden="true" />
              <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Recent shared sessions</h2>
            </div>
            <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "4px 0 16px" }}>
              Results recorded for both accounts.
            </p>
            {recentState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading recent sessions…
              </p>
            )}
            {recentState === "error" && (
              <div role="alert" style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0 }}>Recent shared sessions could not be loaded.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={() => setReload((value) => value + 1)}
                >
                  Retry loading sessions
                </Button>
              </div>
            )}
            {recentState === "ready" && records?.sharedRecap?.length === 0 && (
              <p style={{ color: "var(--color-muted-text)", marginBottom: 0 }}>
                No shared session results yet.
              </p>
            )}
            {recentState === "ready" && records?.sharedRecap && records.sharedRecap.length > 0 && (
              <div style={{ display: "grid", gap: 8 }}>
                {records.sharedRecap.map((result) => {
                  const outcome = result.winnerAccountId
                    ? `Won by ${accountName(result.winnerAccountId)}`
                    : result.reason === "rules_draw"
                      ? "Draw"
                      : "Result unavailable";
                  return (
                    <article
                      key={result.matchId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 8,
                        padding: "12px 14px",
                        borderRadius: "var(--radius-lg)",
                        background: "var(--color-raised)",
                      }}
                    >
                      <div>
                        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 650 }}>
                          {gameNames[result.gameId] ?? result.gameId.replaceAll("-", " ")}
                        </h3>
                        <p
                          style={{
                            color: "var(--color-muted-text)",
                            fontSize: 13,
                            margin: "4px 0 0",
                          }}
                        >
                          {result.mode === "together"
                            ? "Together"
                            : result.mode === "remote"
                              ? "Remote"
                              : result.mode === "challenge"
                                ? "Sudoku challenge"
                                : result.mode}{" "}
                          · {outcome}
                        </p>
                      </div>
                      <time
                        dateTime={new Date(result.finishedAt).toISOString()}
                        style={{ color: "var(--color-muted-text)", fontSize: 13 }}
                      >
                        {new Date(result.finishedAt).toLocaleDateString()}
                      </time>
                    </article>
                  );
                })}
              </div>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <Sparkles size={19} color="var(--color-focus)" aria-hidden="true" />
              <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Hand Cricket</h2>
            </div>
            <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "4px 0 16px" }}>
              Completed shared match records.
            </p>
            {recordsState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading Cricket records…
              </p>
            )}
            {recordsState === "error" && (
              <p role="alert">
                Cricket records are unavailable until the records request succeeds.
              </p>
            )}
            {recordsState === "ready" && records?.cricketRecords && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    padding: 14,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--color-raised)",
                  }}
                >
                  <span
                    style={{ display: "block", fontSize: 13, color: "var(--color-muted-text)" }}
                  >
                    Highest completed innings
                  </span>
                  <strong style={{ fontSize: 24, fontVariantNumeric: "tabular-nums" }}>
                    {records.cricketRecords.highestCompletedInnings}
                  </strong>
                </div>
                {(["A", "B"] as const).map((seat) => (
                  <div
                    key={seat}
                    style={{
                      padding: 14,
                      borderRadius: "var(--radius-lg)",
                      background: "var(--color-raised)",
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{accountName(seat)}</h3>
                    <p style={{ margin: 0, fontSize: 14, color: "var(--color-muted-text)" }}>
                      {records.cricketRecords?.battingRuns[seat]} batting runs ·{" "}
                      {records.cricketRecords?.bowlingWickets[seat]} bowling wickets
                    </p>
                  </div>
                ))}
              </div>
            )}
            {recordsState === "ready" && !records?.cricketRecords && (
              <p style={{ color: "var(--color-muted-text)", marginBottom: 0 }}>
                Cricket records are not included in this response.
              </p>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <h2 style={{ fontSize: 21, fontWeight: 650, margin: "0 0 4px" }}>Sudoku practice</h2>
            <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "0 0 16px" }}>
              Solo practice attempts stay separate from shared match results.
            </p>
            {recordsState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading practice records…
              </p>
            )}
            {recordsState === "error" && (
              <p role="alert">
                Sudoku practice records are unavailable until the records request succeeds.
              </p>
            )}
            {recordsState === "ready" && records?.soloRecords && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
                  gap: 18,
                }}
              >
                {(["A", "B"] as const).map((seat) => {
                  const attempts = records.soloRecords?.[seat] ?? [];
                  return (
                    <section key={seat} aria-label={`${accountName(seat)} Sudoku practice`}>
                      <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>{accountName(seat)}</h3>
                      {attempts.length === 0 ? (
                        <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: 0 }}>
                          No completed practice puzzles yet.
                        </p>
                      ) : (
                        <ol style={{ paddingInlineStart: 22, margin: 0, display: "grid", gap: 8 }}>
                          {attempts.slice(0, 3).map((attempt, index) => (
                            <li
                              key={`${attempt.puzzleId}-${index}`}
                              style={{ fontSize: 14, lineHeight: 1.45 }}
                            >
                              <strong>{attempt.puzzleId}</strong> · {duration(attempt.elapsedMs)} ·{" "}
                              {attempt.assisted ? "Assisted" : "Unassisted"}
                              {attempt.replay ? " · Replay" : ""}
                            </li>
                          ))}
                        </ol>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
            {recordsState === "ready" && !records?.soloRecords && (
              <p style={{ color: "var(--color-muted-text)", marginBottom: 0 }}>
                Practice records are not included in this response.
              </p>
            )}
          </Surface>
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-xl)", minWidth: 0 }}
        >
          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Shield size={20} color="var(--color-accent-fg)" aria-hidden="true" />
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Your account</h2>
                <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "4px 0 0" }}>
                  Only the two arcade accounts can sign in.
                </p>
              </div>
            </div>
            {profileState === "loading" && (
              <p role="status" style={{ color: "var(--color-muted-text)" }}>
                Loading your account…
              </p>
            )}
            {profileState === "error" && (
              <div role="alert" style={{ display: "grid", gap: 12 }}>
                <p style={{ margin: 0 }}>Account preferences could not be loaded.</p>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<RefreshCw size={16} />}
                  onClick={() => setReload((value) => value + 1)}
                >
                  Retry loading account
                </Button>
              </div>
            )}
            {profileState === "ready" && profile && (
              <>
                <p style={{ color: "var(--color-muted-text)", fontSize: 14, margin: "0 0 14px" }}>
                  Signed in as{" "}
                  <strong style={{ color: "var(--color-text)" }}>
                    {profile.profile.displayName}
                  </strong>{" "}
                  · {profile.profile.username}
                </p>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleUpdatePreferences(undefined, undefined, nameDraft);
                  }}
                  style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "end" }}
                >
                  <label
                    htmlFor="display-name"
                    style={{
                      flex: "1 1 180px",
                      display: "grid",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    Display name
                    <input
                      id="display-name"
                      name="displayName"
                      autoComplete="nickname"
                      maxLength={32}
                      value={nameDraft}
                      disabled={profileBusy}
                      onChange={(event) => setNameDraft(event.target.value)}
                      style={{
                        boxSizing: "border-box",
                        width: "100%",
                        minHeight: 48,
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border)",
                        background: "var(--color-inset)",
                        color: "var(--color-text)",
                        font: "inherit",
                      }}
                    />
                  </label>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={
                      profileBusy ||
                      !nameDraft.trim() ||
                      nameDraft.trim() === profile.profile.displayName
                    }
                  >
                    Save name
                  </Button>
                </form>
              </>
            )}
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Palette size={20} color="var(--color-focus)" aria-hidden="true" />
              <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Appearance</h2>
            </div>
            <p
              style={{
                color: "var(--color-muted-text)",
                fontSize: 14,
                lineHeight: 1.5,
                margin: "0 0 20px",
              }}
            >
              Your theme follows this account. Display mode is saved on this device.
            </p>
            {profileState === "error" && (
              <p style={{ color: "var(--color-muted-text)", fontSize: 14 }}>
                Account theme choices are disabled until your profile loads.
              </p>
            )}
            <fieldset disabled={profileBusy} style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={{ fontSize: 16, fontWeight: 650, marginBottom: 10 }}>
                Theme family
              </legend>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 190px), 1fr))",
                  gap: 10,
                }}
              >
                {families.map((choice) => (
                  <Button
                    key={choice.id}
                    variant={family === choice.id ? "mint" : "secondary"}
                    aria-pressed={family === choice.id}
                    onClick={() => void handleUpdatePreferences(choice.id)}
                    style={{ minHeight: 50, justifyContent: "flex-start", textAlign: "start" }}
                  >
                    {choice.label}
                  </Button>
                ))}
              </div>
              <p
                style={{
                  color: "var(--color-muted-text)",
                  fontSize: 13,
                  lineHeight: 1.5,
                  margin: "10px 0 20px",
                }}
              >
                {families.find((choice) => choice.id === family)?.description}
              </p>
            </fieldset>
            <fieldset disabled={profileBusy} style={{ border: 0, padding: 0, margin: "20px 0 0" }}>
              <legend style={{ fontSize: 16, fontWeight: 650, marginBottom: 10 }}>
                Display mode
              </legend>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(115px, 1fr))",
                  gap: 8,
                }}
              >
                {modes.map((choice) => {
                  const Icon = choice.icon;
                  return (
                    <Button
                      key={choice.id}
                      fullWidth
                      variant={mode === choice.id ? "primary" : "secondary"}
                      aria-pressed={mode === choice.id}
                      leftIcon={<Icon size={17} />}
                      onClick={() => setDeviceMode(choice.id)}
                      style={{
                        minHeight: 48,
                        paddingInline: 4,
                        gap: 2,
                        flexDirection: "column",
                      }}
                    >
                      {choice.label}
                    </Button>
                  );
                })}
              </div>
            </fieldset>
          </Surface>

          <Surface variant="card" padding="xl" radius="xl">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Shield size={20} color="var(--color-accent-fg)" aria-hidden="true" />
              <h2 style={{ fontSize: 21, fontWeight: 650, margin: 0 }}>Piece identity</h2>
            </div>
            <p
              style={{
                color: "var(--color-muted-text)",
                fontSize: 14,
                lineHeight: 1.5,
                margin: "0 0 16px",
              }}
            >
              This accent identifies your pieces in new games. It does not change the board colors
              or opponent’s saved matches.
            </p>
            {profileState === "error" && (
              <p style={{ color: "var(--color-muted-text)", fontSize: 14 }}>
                Piece identity is unavailable until your profile loads.
              </p>
            )}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 125px), 1fr))",
                gap: 8,
              }}
            >
              {accents.map((accent) => {
                const selected = playerAccent === accent.id;
                const taken = opponentAccent === accent.id;
                return (
                  <Button
                    key={accent.id}
                    variant={selected ? "mint" : "secondary"}
                    aria-pressed={selected}
                    disabled={profileBusy || taken}
                    aria-label={`${accent.label}${selected ? ", selected" : ""}${taken && profile ? `, used by ${profile.opponent.displayName}` : ""}`}
                    leftIcon={
                      <span
                        aria-hidden="true"
                        style={{
                          display: "inline-block",
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: accent.color,
                          border: "1px solid currentColor",
                        }}
                      />
                    }
                    onClick={() => void handleUpdatePreferences(undefined, accent.id)}
                    style={{ minHeight: 46, justifyContent: "flex-start" }}
                  >
                    {accent.label}
                    {taken && profile ? " · In use" : ""}
                  </Button>
                );
              })}
            </div>
          </Surface>

          {saveStatus && (
            <div
              role="status"
              aria-live="polite"
              style={{
                margin: 0,
                padding: "12px 16px",
                borderRadius: "var(--radius-lg)",
                background: "var(--color-raised)",
                color: "var(--color-text)",
                fontSize: 14,
              }}
            >
              {saveStatus}
              {saveStatus.includes("another device") && (
                <span style={{ display: "block", marginTop: 10 }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReload((value) => value + 1)}
                  >
                    Reload account settings
                  </Button>
                </span>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="md"
            leftIcon={<LogOut size={17} />}
            onClick={() => void handleLogout()}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
