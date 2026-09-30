import { Surface } from "../../components/surface";
import { Button } from "../../components/button";
import { useTheme } from "../../theme/theme-context";
import type { PaletteFamily, ThemeMode, AccentFamily } from "@shared/protocol/types";
import { Palette, Sun, Moon, Monitor, Heart, Shield, LogOut } from "lucide-react";

export function UsPage() {
  const { family, mode, playerAccent, setFamily, setMode, setPlayerAccent } = useTheme();

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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
        padding:
          "calc(var(--space-xl) + var(--sat)) var(--space-lg) calc(var(--space-4xl) + var(--sab))",
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
              14
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>Player A Wins</div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--color-muted-text)" }}>
            :
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "28px", fontWeight: 800, fontFamily: "var(--font-mono)" }}>
              12
            </div>
            <div style={{ fontSize: "12px", color: "var(--color-muted-text)" }}>Player B Wins</div>
          </div>
        </div>
      </Surface>

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
                variant={isSelected ? "elevated" : "inset"}
                padding="md"
                radius="lg"
                style={{
                  cursor: "pointer",
                  border: isSelected
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => setFamily(f.id)}
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
                onClick={() => setMode(m.id)}
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
          Your individual game piece identity across all matches.
        </p>

        <div
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-md)" }}
        >
          {accents.map((acc) => {
            const isSelected = playerAccent === acc.id;
            return (
              <Surface
                key={acc.id}
                variant={isSelected ? "elevated" : "inset"}
                padding="sm"
                radius="md"
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  border: isSelected
                    ? "2px solid var(--color-focus)"
                    : "1px solid var(--color-border)",
                }}
                onClick={() => setPlayerAccent(acc.id)}
              >
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: acc.color,
                  }}
                />
                <span style={{ fontSize: "13px", fontWeight: 600 }}>{acc.label}</span>
              </Surface>
            );
          })}
        </div>
      </Surface>

      {/* Logout */}
      <div style={{ marginTop: "var(--space-md)" }}>
        <Button variant="ghost" size="md" leftIcon={<LogOut size={16} />}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
