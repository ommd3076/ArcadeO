import { useAuth, apiFetch } from "../auth";
import { useState, useEffect } from "react";
import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { useTheme } from "../../theme/theme-context";
import type { PaletteFamily, ThemeMode, AccentFamily } from "@shared/protocol/types";
import { Palette, Sun, Moon, Monitor, Heart, Shield, LogOut, Flame, History } from "lucide-react";

interface RecordsData {
  summary: {
    totalPlayed: number;
    winsA: number;
    winsB: number;
    draws: number;
    playDayStreak?: number;
    currentStreak: { holder: string | null; count: number };
    calcuttaWeek: {
      weekStartMs: number;
      matchesThisWeek: number;
      winsAThisWeek: number;
      winsBThisWeek: number;
    };
  };
  byGame: Record<string, { played: number; winsA: number; winsB: number; draws: number }>;
  soloRecords?: Record<
    "A" | "B",
    Array<{ puzzleId: string; elapsedMs: number; assisted: number; replay?: boolean }>
  >;
  recentMatches?: Array<{
    matchId: string;
    gameId: string;
    winner: string | null;
    winnerAccountId?: string | null;
    details?: { scored?: boolean; senderAttempt?: boolean };
    finishedAt: number;
  }>;
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

export function UsPage() {
  const { logout, session, refresh } = useAuth();
  const { family, mode, playerAccent, setFamily, setMode, setPlayerAccent } = useTheme();
  const [records, setRecords] = useState<RecordsData | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        const [recRes, profRes, recentRes] = await Promise.all([
          apiFetch("/api/v1/records/summary").then((r) =>
            r.ok ? (r.json() as Promise<RecordsData>) : null,
          ),
          apiFetch("/api/v1/profile").then((r) =>
            r.ok ? (r.json() as Promise<ProfileData>) : null,
          ),
          apiFetch("/api/v1/records/recent").then((r) =>
            r.ok
              ? (r.json() as Promise<{
                  recentMatches?: RecordsData["recentMatches"];
                  sharedRecap?: RecordsData["sharedRecap"];
                }>)
              : { recentMatches: [], sharedRecap: [] },
          ),
        ]);

        if (isMounted) {
          if (recRes) {
            setRecords({
              ...recRes,
              recentMatches: recentRes?.recentMatches || [],
              sharedRecap: recentRes?.sharedRecap || [],
            });
          }
          if (profRes) {
            setProfile(profRes);
            setNameDraft(profRes.profile.displayName);
            if (profRes.profile?.paletteFamily) {
              setFamily(profRes.profile.paletteFamily);
            }
            if (profRes.profile?.accentFamily) {
              setPlayerAccent(profRes.profile.accentFamily);
            }
          }
        }
      } catch (err) {
        console.warn("Records/Profile fetch fallback:", err);
      }
    }

    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleUpdatePreferences = async (
    newFamily?: PaletteFamily,
    newAccent?: AccentFamily,
    newName?: string,
  ) => {
    const updatedFamily = newFamily ?? family;
    const updatedAccent = newAccent ?? playerAccent;

    if (!profile) {
      setSaveStatus("Account preferences are loading. Retry shortly.");
      return;
    }
    if (newFamily) setFamily(newFamily);
    if (newAccent) setPlayerAccent(newAccent);

    if (!profile) return;

    try {
      setSaveStatus("Saving preferences...");
      const res = await apiFetch("/api/v1/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paletteFamily: updatedFamily,
          accentFamily: updatedAccent,
          ...(newName !== undefined ? { displayName: newName } : {}),
          expectedPreferenceVersion: profile.profile.preferenceVersion,
        }),
      });

      if (res.ok) {
        const body = (await res.json()) as
          ProfileData["profile"] | { profile: ProfileData["profile"] };
        const data = { profile: "profile" in body ? body.profile : body };
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profile: {
                  ...prev.profile,
                  paletteFamily: data.profile.paletteFamily,
                  accentFamily: data.profile.accentFamily,
                  displayName: data.profile.displayName,
                  preferenceVersion: data.profile.preferenceVersion,
                },
              }
            : null,
        );
        setSaveStatus("Saved to your account");
        await refresh();
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        const err = ((await res.json().catch(() => ({}))) as { error?: string }) || {};
        setSaveStatus(`Failed to save: ${err.error || res.statusText}`);
      }
    } catch (e: any) {
      setSaveStatus(`Account save failed. Retry: ${e.message}`);
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      setSaveStatus((err as Error).message);
    }
  };

  const setDeviceMode = (nextMode: ThemeMode) => {
    setMode(nextMode);
    if (session) localStorage.setItem("pa_theme_mode_" + session.profile.id, nextMode);
  };
  const families: { id: PaletteFamily; label: string; desc: string }[] = [
    {
      id: "standard",
      label: "Standard",
      desc: "Black/white framing with mint, cyan and warm yellow accents.",
    },
    {
      id: "romantic",
      label: "Romantic",
      desc: "Moody purple dark (#1e112a) and elegant pink light (#fdf2f8).",
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

  const opponentAccent = profile?.opponent?.accentFamily;
  const accountName = (id: string | null | undefined) =>
    profile && id === profile.profile.id
      ? profile.profile.displayName
      : profile?.opponent && id === profile.opponent.id
        ? profile.opponent.displayName
        : `Player ${id}`;
  const winsA = records?.summary?.winsA ?? 0;
  const winsB = records?.summary?.winsB ?? 0;
  const streakHolder = records?.summary?.currentStreak?.holder;
  const streakCount = records?.summary?.currentStreak?.count ?? 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
        padding: "calc(var(--space-xl) + var(--sat)) var(--space-lg) calc(96px + var(--sab))",
        maxWidth: "720px",
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
          Us & Appearance
        </h1>
        <p style={{ color: "var(--color-muted-text)", fontSize: "15px", marginTop: "6px" }}>
          Shared records, preferences and individual themes.
        </p>
      </header>

      <Surface variant="card" padding="lg" radius="xl">
        <h2 style={{ fontSize: 18, fontWeight: 500, margin: "0 0 12px" }}>Your name</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ flex: "1 1 180px" }}>
            <span style={{ display: "block", fontSize: 13, marginBottom: 6 }}>
              Shown to both players
            </span>
            <input
              aria-label="Your display name"
              disabled={!profile}
              maxLength={32}
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => void handleUpdatePreferences(undefined, undefined, nameDraft)}
            disabled={
              !profile || !nameDraft.trim() || nameDraft.trim() === profile.profile.displayName
            }
          >
            Save name
          </Button>
        </div>
      </Surface>

      {/* Head to Head Records Card */}
      <Surface variant="card" padding="xl" radius="xl">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Heart size={20} color="var(--color-accent-fg)" />
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Head-to-Head</h2>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "var(--space-md) 0",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {winsA}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>
              {accountName("A")} wins
            </div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-muted-text)" }}>
            :
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              {winsB}
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>
              {accountName("B")} wins
            </div>
          </div>
        </div>

        {streakCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-focus)",
            }}
          >
            <Flame size={16} />
            <span>
              Active Streak: Player {streakHolder} ({streakCount} win{streakCount > 1 ? "s" : ""})
            </span>
          </div>
        )}
      </Surface>

      {!!records?.summary.playDayStreak && (
        <p>
          {records.summary.playDayStreak} shared play day
          {records.summary.playDayStreak === 1 ? "" : "s"} in a row
        </p>
      )}
      {records && Object.keys(records.byGame).length > 0 && (
        <Surface variant="card" padding="lg" radius="xl">
          <h2>By game</h2>
          {Object.entries(records.byGame).map(([game, record]) => (
            <p key={game} style={{ marginTop: 12 }}>
              {game.replaceAll("-", " ")} · {record.played} played · {record.winsA} A /{" "}
              {record.winsB} B / {record.draws} draws
            </p>
          ))}
        </Surface>
      )}
      <Surface variant="card" padding="lg" radius="xl">
        <h2>Sudoku practice</h2>
        <p style={{ color: "var(--color-muted-text)" }}>Separate from shared match results.</p>
        {(["A", "B"] as const).map((account) => (
          <div key={account} style={{ marginTop: 12 }}>
            <h3>Player {account}</h3>
            {records?.soloRecords?.[account]?.length ? (
              records.soloRecords[account].slice(0, 3).map((record, i) => (
                <p key={record.puzzleId + i}>
                  {record.puzzleId} · {Math.floor(record.elapsedMs / 1000)}s ·{" "}
                  {record.assisted ? "Assisted" : "Unassisted"}
                  {record.replay ? " · Replay" : ""}
                </p>
              ))
            ) : (
              <p>No completed practice puzzles yet.</p>
            )}
          </div>
        ))}
      </Surface>
      {/* Saved shared session recap */}
      {records?.sharedRecap && records.sharedRecap.length > 0 && (
        <Surface variant="card" padding="lg" radius="xl">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
            <History size={18} color="var(--color-focus)" />
            <h2 style={{ fontSize: "16px", fontWeight: 500, margin: 0 }}>Recent shared sessions</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {records.sharedRecap.map((rm) => (
              <div
                key={rm.matchId}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                  backgroundColor: "var(--color-raised)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "13px",
                }}
              >
                <span style={{ fontWeight: 600, textTransform: "capitalize" }}>
                  {rm.gameId.replace("-", " ")}
                </span>
                <span style={{ color: "var(--color-muted-text)" }}>
                  {rm.winnerAccountId ? `Won by ${accountName(rm.winnerAccountId)}` : "Draw"} ·{" "}
                  {new Date(rm.finishedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {/* Theme Family Picker */}
      <Surface variant="card" padding="xl" radius="xl">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Palette size={20} color="var(--color-focus)" />
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Palette Family</h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--color-muted-text)", marginBottom: "16px" }}>
          Standard is colorful regular framing; Romantic is personal moody purple/pink.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
          {families.map((f) => {
            const isSelected = family === f.id;
            return (
              <Surface
                key={f.id}
                disabled={!profile || saveStatus === "Saving preferences..."}
                as="button"
                type="button"
                aria-pressed={isSelected}
                variant={isSelected ? "elevated" : "inset"}
                padding="md"
                radius="lg"
                style={{
                  cursor: "pointer",
                  border: isSelected
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => handleUpdatePreferences(f.id, undefined)}
              >
                <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>
                  {f.label}
                </div>
                <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>{f.desc}</div>
              </Surface>
            );
          })}
        </div>
      </Surface>

      {/* Color Mode Picker */}
      <Surface variant="card" padding="xl" radius="xl">
        <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 12px 0" }}>
          Color Mode (Dark Default)
        </h2>
        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)" }}
        >
          {modes.map((m) => {
            const Icon = m.icon;
            const isSelected = mode === m.id;
            return (
              <Surface
                key={m.id}
                as="button"
                type="button"
                aria-pressed={isSelected}
                variant={isSelected ? "elevated" : "inset"}
                padding="md"
                radius="lg"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                  border: isSelected
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => setDeviceMode(m.id)}
              >
                <Icon
                  size={20}
                  color={isSelected ? "var(--color-focus)" : "var(--color-muted-text)"}
                />
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{m.label}</span>
              </Surface>
            );
          })}
        </div>
      </Surface>

      {/* Player Accent Identity */}
      <Surface variant="card" padding="xl" radius="xl">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <Shield size={20} color="var(--color-accent-fg)" />
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Player Accent</h2>
        </div>
        <p style={{ fontSize: "13px", color: "var(--color-muted-text)", marginBottom: "16px" }}>
          Your individual game piece identity. Player A and B must maintain distinct colors.
        </p>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)" }}
        >
          {accents.map((acc) => {
            const isSelected = playerAccent === acc.id;
            const isOpponentChoice = opponentAccent === acc.id;

            return (
              <Surface
                key={acc.id}
                disabled={!profile || isOpponentChoice || saveStatus === "Saving preferences..."}
                as="button"
                type="button"
                aria-pressed={isSelected}
                variant={isSelected ? "elevated" : "inset"}
                padding="sm"
                radius="md"
                style={{
                  cursor: isOpponentChoice ? "not-allowed" : "pointer",
                  opacity: isOpponentChoice ? 0.4 : 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: isSelected
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => {
                  if (!isOpponentChoice) {
                    handleUpdatePreferences(undefined, acc.id);
                  }
                }}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: acc.color,
                  }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600 }}>
                  {acc.label}
                  {isOpponentChoice && " (Taken)"}
                </span>
              </Surface>
            );
          })}
        </div>
      </Surface>

      {/* Save feedback indicator */}
      {saveStatus && (
        <div
          role="status"
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "var(--color-focus)",
            fontWeight: 600,
          }}
        >
          {saveStatus}
        </div>
      )}

      {/* Logout */}
      <div style={{ marginTop: "var(--space-md)" }}>
        <Button variant="ghost" size="md" leftIcon={<LogOut size={16} />} onClick={handleLogout}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
