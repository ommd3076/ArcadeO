import type { CSSProperties } from "react";
import { WifiOff, RefreshCw, AlertTriangle, ArrowRightLeft, X } from "lucide-react";
import type { ConnectionState, SyncStatus, ControllerStatus } from "../sync/types";

export interface ConnectionStatusProps {
  connectionState: ConnectionState;
  syncStatus?: SyncStatus;
  isOffline?: boolean;
  controllerStatus?: ControllerStatus | null;
  onDismissTakeover?: () => void;
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}

export function ConnectionStatus({
  connectionState,
  syncStatus = "idle",
  isOffline = false,
  controllerStatus,
  onDismissTakeover,
  onRetry,
  className = "",
  style,
}: ConnectionStatusProps) {
  // 1. Controller takeover notification
  if (controllerStatus?.takeoverNotice) {
    return (
      <aside
        role="alert"
        aria-live="assertive"
        className={`arcade-connection-status arcade-connection-status--takeover ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-surface, #1C1C20)",
          border: "1px solid var(--color-interactive-line, #898993)",
          color: "var(--color-text, #F5F5F7)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
          <ArrowRightLeft
            size={18}
            style={{ color: "var(--color-focus, #A8DFE4)", flexShrink: 0 }}
            aria-hidden="true"
          />
          <span>
            {controllerStatus.isController
              ? "Control transferred to this device."
              : "Control transferred to another device — inputs paused."}
          </span>
        </div>
        {onDismissTakeover && (
          <button
            type="button"
            onClick={onDismissTakeover}
            aria-label="Dismiss control transfer notice"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-muted-text, #B9B9C4)",
              borderRadius: "var(--radius-xs, 4px)",
            }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </aside>
    );
  }

  // 2. Offline banner
  if (isOffline) {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={`arcade-connection-status arcade-connection-status--offline ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-danger-surface, rgba(239, 68, 68, 0.15))",
          border: "1px solid var(--color-danger, #EF4444)",
          color: "var(--color-danger-text, #FCA5A5)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <WifiOff size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>Offline — inputs paused</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              borderRadius: "var(--radius-sm, 8px)",
              padding: "2px 8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        )}
      </aside>
    );
  }

  // 3. Disconnected banner
  if (connectionState === "disconnected") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={`arcade-connection-status arcade-connection-status--disconnected ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-danger-surface, rgba(239, 68, 68, 0.15))",
          border: "1px solid var(--color-danger, #EF4444)",
          color: "var(--color-danger-text, #FCA5A5)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          ...style,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span>Disconnected — inputs paused</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "transparent",
              border: "1px solid currentColor",
              color: "inherit",
              borderRadius: "var(--radius-sm, 8px)",
              padding: "2px 8px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Connect
          </button>
        )}
      </aside>
    );
  }

  // 4. Reconnecting banner
  if (connectionState === "reconnecting") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={`arcade-connection-status arcade-connection-status--reconnecting ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-emphasis-yellow-bg, #F4DE88)",
          border: "1px solid var(--color-emphasis-yellow-border, #FDE047)",
          color: "var(--color-emphasis-yellow-ink, #30290D)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          ...style,
        }}
      >
        <RefreshCw
          size={18}
          aria-hidden="true"
          style={{ flexShrink: 0, animation: "spin 1.5s linear infinite" }}
        />
        <span>Reconnecting...</span>
      </aside>
    );
  }

  // 5. Connecting banner
  if (connectionState === "connecting") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={`arcade-connection-status arcade-connection-status--connecting ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-raised, #29292E)",
          border: "1px solid var(--color-border, #2C2C34)",
          color: "var(--color-text, #F5F5F7)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          ...style,
        }}
      >
        <RefreshCw
          size={18}
          aria-hidden="true"
          style={{ flexShrink: 0, animation: "spin 1.5s linear infinite" }}
        />
        <span>Connecting...</span>
      </aside>
    );
  }

  // 6. Syncing / Reconciling banner
  if (syncStatus === "reconciling" || syncStatus === "syncing") {
    return (
      <aside
        role="status"
        aria-live="polite"
        className={`arcade-connection-status arcade-connection-status--syncing ${className}`.trim()}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-sm, 8px)",
          padding: "var(--space-sm, 8px) var(--space-md, 12px)",
          borderRadius: "var(--radius-lg, 16px)",
          backgroundColor: "var(--color-surface, #1C1C20)",
          border: "1px solid var(--color-interactive-line, #898993)",
          color: "var(--color-muted-text, #B9B9C4)",
          fontSize: "14px",
          fontWeight: 500,
          lineHeight: "1.4",
          ...style,
        }}
      >
        <RefreshCw
          size={16}
          aria-hidden="true"
          style={{ flexShrink: 0, animation: "spin 1.2s linear infinite" }}
        />
        <span>Syncing...</span>
      </aside>
    );
  }

  // Connected and fully synced: render nothing
  return null;
}
