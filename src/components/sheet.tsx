import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./icon-button";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

type SheetPhase = "closed" | "opening" | "open" | "exiting";

export function Sheet({ isOpen, onClose, title, description, children }: SheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sheetId = useId();
  const [phase, setPhase] = useState<SheetPhase>(isOpen ? "open" : "closed");
  onCloseRef.current = onClose;

  useEffect(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = null;
    if (isOpen) {
      setPhase((current) => (current === "closed" ? "opening" : "open"));
      if (phase === "closed") {
        const frame = window.requestAnimationFrame(() => setPhase("open"));
        return () => window.cancelAnimationFrame(frame);
      }
      return;
    }
    if (phase !== "closed") {
      setPhase("exiting");
      exitTimer.current = setTimeout(() => setPhase("closed"), 190);
    }
    return () => {
      if (exitTimer.current) clearTimeout(exitTimer.current);
    };
  }, [isOpen, phase]);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusTo.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
        ) ?? [],
      );
    const initialFocus = focusable()[0];
    initialFocus?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const targets = focusable();
      const first = targets[0];
      const last = targets[targets.length - 1];
      if (!first) {
        event.preventDefault();
        panel.current?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const marker = `arcade-sheet:${sheetId}`;
    const currentState = (window.history.state ?? {}) as Record<string, unknown>;
    window.history.pushState({ ...currentState, __arcadeSheet: marker }, "", window.location.href);
    const handlePopState = () => {
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (state.__arcadeSheet !== marker) onCloseRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("popstate", handlePopState);
      document.body.style.overflow = previousOverflow;
      restoreFocusTo.current?.focus();
      const state = (window.history.state ?? {}) as Record<string, unknown>;
      if (state.__arcadeSheet === marker) window.history.back();
    };
  }, [isOpen, sheetId]);

  if (phase === "closed") return null;

  const isExiting = phase === "exiting";
  return (
    <div
      className="arcade-sheet-backdrop"
      onClick={() => onCloseRef.current()}
      role="presentation"
      aria-hidden={isExiting}
      style={{
        opacity: isExiting ? 0 : 1,
        animation: isExiting ? "none" : undefined,
        transition: "opacity 180ms var(--ease-settle, cubic-bezier(0.16, 1, 0.3, 1))",
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      <div
        ref={panel}
        className="arcade-sheet-content"
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={isExiting}
        inert={isExiting}
        aria-labelledby={`arcade-sheet-title-${sheetId}`}
        aria-describedby={description ? `arcade-sheet-description-${sheetId}` : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          opacity: isExiting ? 0 : 1,
          animation: isExiting ? "none" : undefined,
          transform: isExiting ? "translateY(12px)" : "translateY(0)",
          transition:
            "opacity 180ms var(--ease-settle, cubic-bezier(0.16, 1, 0.3, 1)), transform 180ms var(--ease-settle, cubic-bezier(0.16, 1, 0.3, 1))",
          pointerEvents: isExiting ? "none" : "auto",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: "var(--space-lg)",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <h2
              id={`arcade-sheet-title-${sheetId}`}
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "var(--color-text)",
                margin: 0,
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                id={`arcade-sheet-description-${sheetId}`}
                style={{
                  fontSize: "13px",
                  color: "var(--color-muted-text)",
                  margin: "4px 0 0 0",
                }}
              >
                {description}
              </p>
            )}
          </div>

          <IconButton
            aria-label="Close dialog"
            icon={<X size={20} />}
            variant="ghost"
            onClick={() => onCloseRef.current()}
          />
        </div>

        <div className="arcade-sheet-body">{children}</div>
      </div>
    </div>
  );
}
