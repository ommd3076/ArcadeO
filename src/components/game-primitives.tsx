import type { CSSProperties, ReactNode } from "react";
import type { Seat } from "@shared/protocol/types";
import { Button } from "./button";
import { Surface } from "./surface";
import { BackHeader, type BackHeaderProps } from "./back-header";
export { Sheet } from "./sheet";

function colourLabelInk(colour: string) {
  const channels = colour.replace("#", "").match(/.{2}/g);
  if (!channels || channels.length !== 3) return "var(--color-text)";
  const linear = channels.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#000" : "#fff";
}

export function GameHeader(props: BackHeaderProps) {
  return <BackHeader {...props} />;
}

export function PlayerScoreStrip({
  names,
  scores,
  activeSeat,
  completed = false,
  testIdPrefix,
}: {
  names: Record<Seat, string>;
  scores: Record<Seat, number>;
  activeSeat: Seat;
  completed?: boolean;
  testIdPrefix?: string;
}) {
  return (
    <Surface
      variant="card"
      padding="sm"
      radius="lg"
      style={{
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
      }}
    >
      {(["A", "B"] as const).map((seat) => (
        <div
          key={seat}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            minWidth: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              flex: "none",
              borderRadius: "50%",
              background: `var(--player-${seat.toLowerCase()}-accent)`,
            }}
          />
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: activeSeat === seat && !completed ? 600 : 400,
            }}
          >
            {names[seat]}
          </span>
          <strong
            data-testid={testIdPrefix ? `${testIdPrefix}-score-${seat}` : undefined}
            style={{ fontWeight: 600 }}
          >
            {scores[seat]}
          </strong>
        </div>
      ))}
      <span
        role="status"
        aria-live="polite"
        style={{ width: "100%", fontSize: 12, color: "var(--color-muted-text)" }}
      >
        {completed ? "Finished" : `${names[activeSeat]}'s turn`}
      </span>
    </Surface>
  );
}

export function BoardViewport({
  children,
  zoom,
  label,
  style,
}: {
  children: ReactNode;
  zoom?: boolean;
  label: string;
  style?: CSSProperties;
}) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={zoom ? 0 : undefined}
      style={{ width: "100%", overflow: "auto", touchAction: "pan-x pan-y", ...style }}
    >
      {children}
    </div>
  );
}

export function FocusModeToggle({
  focused,
  onChange,
}: {
  focused: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Button variant="ghost" size="sm" aria-pressed={focused} onClick={() => onChange(!focused)}>
      {focused ? "Exit focus" : "Focus"}
    </Button>
  );
}

export function ActionDock({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 8,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {children}
    </div>
  );
}

export function DiceControl({
  value,
  disabled,
  onRoll,
}: {
  value?: number | null;
  disabled?: boolean;
  onRoll: () => void;
}) {
  return (
    <Button
      onClick={onRoll}
      disabled={disabled}
      aria-label={value ? `Dice shows ${value}. Roll dice` : "Roll dice"}
    >
      {value && value >= 1 && value <= 6
        ? `${["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][value]} ${value}`
        : "Roll dice"}
    </Button>
  );
}

export function PawnSelector({
  legalIds,
  onSelect,
  disabled = false,
}: {
  legalIds: number[];
  onSelect: (id: number) => void;
  disabled?: boolean;
}) {
  return (
    <ActionDock>
      {legalIds.map((id) => (
        <Button
          key={id}
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onSelect(id)}
        >
          Pawn {id + 1}
        </Button>
      ))}
    </ActionDock>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} style={{ display: "flex", gap: 6 }}>
      {options.map((option) => (
        <Button
          key={option}
          size="sm"
          variant={value === option ? "primary" : "secondary"}
          aria-pressed={value === option}
          onClick={() => onChange(option)}
        >
          {option}
        </Button>
      ))}
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  return (
    <span
      role="status"
      data-tone={tone}
      style={{
        display: "inline-flex",
        borderRadius: 999,
        padding: "4px 10px",
        background: "var(--color-raised)",
        color: "var(--color-text)",
        fontSize: 12,
      }}
    >
      {children}
    </span>
  );
}

export function ColourPicker<T extends string>({
  value,
  colours,
  onChange,
  label,
  disabled = false,
  disabledIds = [],
}: {
  value: T;
  colours: readonly { id: T; color: string; name: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  disabledIds?: readonly T[];
}) {
  return (
    <fieldset style={{ border: 0, padding: 0 }}>
      <legend>{label}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {colours.map(({ id, color, name }) => (
          <button
            key={id}
            type="button"
            aria-label={name}
            aria-pressed={value === id}
            disabled={disabled || disabledIds.includes(id)}
            onClick={() => onChange(id)}
            style={{
              minWidth: 72,
              minHeight: 44,
              borderRadius: 12,
              background: color,
              opacity: disabled || disabledIds.includes(id) ? 0.45 : 1,
              color: colourLabelInk(color),
              border:
                value === id ? "3px solid var(--color-text)" : "1px solid var(--color-border)",
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function InlineNotice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warning" | "error";
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-tone={tone}
      style={{ margin: 0, color: "var(--color-muted-text)" }}
    >
      {children}
    </p>
  );
}

export function ResultPanel({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Surface variant="card" padding="md" radius="xl">
      <h2 style={{ marginTop: 0, fontWeight: 500 }}>{title}</h2>
      {children}
      {action}
    </Surface>
  );
}
