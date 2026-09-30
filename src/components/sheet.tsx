import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./icon-button";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Sheet({ isOpen, onClose, title, description, children }: SheetProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Lock body scroll while sheet is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="arcade-sheet-backdrop" onClick={onClose} role="presentation">
      <div
        className="arcade-sheet-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="arcade-sheet-title"
        onClick={(e) => e.stopPropagation()}
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
              id="arcade-sheet-title"
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
                style={{
                  fontSize: "13px",
                  color: "var(--color-muted-text)",
                  marginTop: "4px",
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
            onClick={onClose}
          />
        </div>

        <div className="arcade-sheet-body">{children}</div>
      </div>
    </div>
  );
}
