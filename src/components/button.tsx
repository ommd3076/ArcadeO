import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  "primary" | "secondary" | "outline" | "ghost" | "mint" | "cyan" | "yellow" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  pill = true,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = "",
  style,
  children,
  type = "button",
  ...restProps
}: ButtonProps) {
  const shapeClass = pill ? "arcade-btn--pill" : "arcade-btn--rounded";
  const sizeClass = `arcade-btn--${size}`;
  const variantClass = `arcade-btn--${variant}`;
  const widthStyle = fullWidth ? { width: "100%" } : {};

  const combinedClass = `arcade-btn ${shapeClass} ${sizeClass} ${variantClass} ${className}`.trim();

  return (
    <button
      type={type}
      className={combinedClass}
      style={{ ...widthStyle, ...style }}
      {...restProps}
    >
      {leftIcon && <span className="arcade-btn-icon-left">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="arcade-btn-icon-right">{rightIcon}</span>}
    </button>
  );
}
