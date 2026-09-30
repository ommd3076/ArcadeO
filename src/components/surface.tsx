import type { ElementType, ComponentPropsWithoutRef, ReactNode } from "react";

export type SurfaceVariant =
  | "card"
  | "elevated"
  | "inset"
  | "canvas"
  | "emphasis-mint"
  | "emphasis-cyan"
  | "emphasis-yellow"
  | "default";

export type SurfacePadding = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type SurfaceRadius = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "full";

export interface SurfaceProps<T extends ElementType = "div"> {
  as?: T;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  radius?: SurfaceRadius;
  className?: string;
  children?: ReactNode;
}

const paddingMap: Record<SurfacePadding, string> = {
  none: "0",
  xs: "var(--space-xs)",
  sm: "var(--space-sm)",
  md: "var(--space-md)",
  lg: "var(--space-lg)",
  xl: "var(--space-xl)",
  "2xl": "var(--space-2xl)",
};

const radiusMap: Record<SurfaceRadius, string> = {
  none: "0",
  xs: "var(--radius-xs)",
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
  xl: "var(--radius-xl)",
  full: "var(--radius-full)",
};

export function Surface<T extends ElementType = "div">({
  as,
  variant = "card",
  padding = "lg",
  radius = "xl",
  className = "",
  style,
  children,
  ...restProps
}: SurfaceProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof SurfaceProps<T>>) {
  const Component = as ?? "div";

  const variantClass = variant !== "default" ? `arcade-surface--${variant}` : "";
  const combinedClassName = `arcade-surface ${variantClass} ${className}`.trim();

  const inlineStyle = {
    padding: paddingMap[padding],
    borderRadius: radiusMap[radius],
    ...style,
  };

  return (
    <Component className={combinedClassName} style={inlineStyle} {...restProps}>
      {children}
    </Component>
  );
}
