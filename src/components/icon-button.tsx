import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type IconButtonSize = "sm" | "md" | "lg";
export type IconButtonShape = "circle" | "rounded";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  "aria-label": string; // Enforce accessible label
  icon: ReactNode;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  shape?: IconButtonShape;
}

export function IconButton({
  "aria-label": ariaLabel,
  icon,
  variant = "secondary",
  size = "md",
  shape = "circle",
  className = "",
  style,
  type = "button",
  ...restProps
}: IconButtonProps) {
  const shapeClass = shape === "circle" ? "arcade-icon-btn--circle" : "arcade-icon-btn--rounded";
  const variantClass = `arcade-icon-btn--${variant}`;
  const sizeClass = `arcade-icon-btn--${size}`;

  const combinedClass =
    `arcade-icon-btn ${shapeClass} ${variantClass} ${sizeClass} ${className}`.trim();

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={combinedClass}
      style={style}
      {...restProps}
    >
      {icon}
    </button>
  );
}
