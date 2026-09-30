import type { Seat, AccentFamily } from "@shared/protocol/types";
import { resolvePlayerAccent } from "../theme/tokens";
import { useTheme } from "../theme/theme-context";

export interface TurnStripProps {
  activePlayerName: string;
  activeSeat: Seat;
  activeAccent?: AccentFamily;
  isYourTurn: boolean;
  role?: string;
  statusText?: string;
  round?: number | string;
  scoreText?: string;
  className?: string;
}

export function TurnStrip({
  activePlayerName,
  activeSeat,
  activeAccent,
  isYourTurn,
  role,
  statusText,
  round,
  scoreText,
  className = "",
}: TurnStripProps) {
  const { resolvedMode, playerAccent: defaultAccent } = useTheme();
  const accent = activeAccent ?? defaultAccent;
  const accentToken = resolvePlayerAccent(accent, resolvedMode);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`arcade-turn-strip ${isYourTurn ? "arcade-turn-strip--your-turn" : ""} ${className}`.trim()}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Seat / Player Avatar Pill */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "var(--radius-full)",
            backgroundColor: accentToken.fill,
            color: accentToken.foreground,
            border: `2px solid ${accentToken.border}`,
            fontWeight: 700,
            fontSize: "13px",
            fontFamily: "var(--font-heading)",
          }}
        >
          {activeSeat}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--color-text)" }}>
              {activePlayerName}
            </span>
            {role && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-raised)",
                  color: "var(--color-muted-text)",
                  border: "1px solid var(--color-border)",
                }}
              >
                {role}
              </span>
            )}
          </div>

          <span
            style={{
              fontSize: "12px",
              color: isYourTurn ? accentToken.foreground : "var(--color-muted-text)",
              fontWeight: isYourTurn ? 600 : 400,
            }}
          >
            {statusText ?? (isYourTurn ? "It's your turn!" : "Waiting for opponent...")}
          </span>
        </div>
      </div>

      {(round !== undefined || scoreText) && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          {round !== undefined && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-muted-text)",
                padding: "2px 8px",
                borderRadius: "var(--radius-sm)",
                backgroundColor: "var(--color-raised)",
              }}
            >
              R{round}
            </span>
          )}
          {scoreText && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: 600,
                color: "var(--color-text)",
              }}
            >
              {scoreText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
