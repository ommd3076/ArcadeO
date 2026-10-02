import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "./icon-button";

export interface BackHeaderProps {
  title: string;
  subtitle?: string;
  fallbackTo?: string;
  onBack?: () => void;
  rightAction?: ReactNode;
  className?: string;
}

export function BackHeader({
  title,
  subtitle,
  fallbackTo = "/games",
  onBack,
  rightAction,
  className = "",
}: BackHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackTo);
    }
  };

  return (
    <header className={`arcade-back-header ${className}`.trim()}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
        <IconButton
          aria-label="Go back"
          icon={<ArrowLeft size={20} />}
          variant="secondary"
          shape="circle"
          onClick={handleBack}
        />

        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: "18px",
              fontWeight: 700,
              fontFamily: "var(--font-heading)",
              color: "var(--color-text)",
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: "12px",
                color: "var(--color-muted-text)",
                margin: "2px 0 0 0",
                whiteSpace: "normal",
                overflowWrap: "anywhere",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {rightAction && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{rightAction}</div>
      )}
    </header>
  );
}
