import type { PaletteFamily, AccentFamily } from "@shared/protocol/types";

export interface ThemeColors {
  canvas: string;
  surface: string;
  raised: string;
  inset: string;
  border: string;
  interactiveLine: string;
  text: string;
  mutedText: string;
  primaryFill: string;
  onPrimary: string;
  focus: string;
  // Emphasis cards
  emphasisMintBg: string;
  emphasisMintInk: string;
  emphasisMintBorder: string;
  emphasisCyanBg: string;
  emphasisCyanInk: string;
  emphasisCyanBorder: string;
  emphasisYellowBg: string;
  emphasisYellowInk: string;
  emphasisYellowBorder: string;
  // Feedback
  danger: string;
  dangerSurface: string;
  dangerText: string;
  success: string;
  successSurface: string;
  successText: string;
}

export interface PlayerAccentToken {
  foreground: string;
  fill: string;
  border: string;
  onAccent: string;
}

export const standardDarkColors: ThemeColors = {
  canvas: "#0C0C0F",
  surface: "#1C1C20",
  raised: "#29292E",
  inset: "#141418",
  border: "#2C2C34",
  interactiveLine: "#898993",
  text: "#F5F5F7",
  mutedText: "#B9B9C4",
  primaryFill: "#CFE6A3",
  onPrimary: "#1D2915",
  focus: "#A8DFE4",
  emphasisMintBg: "#CFE6A3",
  emphasisMintInk: "#1D2915",
  emphasisMintBorder: "#86EFAC",
  emphasisCyanBg: "#A8DFE4",
  emphasisCyanInk: "#102426",
  emphasisCyanBorder: "#67E8F9",
  emphasisYellowBg: "#F4DE88",
  emphasisYellowInk: "#30290D",
  emphasisYellowBorder: "#FDE047",
  danger: "#EF4444",
  dangerSurface: "rgba(239, 68, 68, 0.15)",
  dangerText: "#FCA5A5",
  success: "#10B981",
  successSurface: "rgba(16, 185, 129, 0.15)",
  successText: "#6EE7B7",
};

export const standardLightColors: ThemeColors = {
  canvas: "#F7F7F8",
  surface: "#FFFFFF",
  raised: "#EEEEF1",
  inset: "#E4E4EB",
  border: "#DADBDF",
  interactiveLine: "#777780",
  text: "#17171C",
  mutedText: "#62626D",
  primaryFill: "#202024",
  onPrimary: "#FFFFFF",
  focus: "#245CC1",
  emphasisMintBg: "#CFE6A3",
  emphasisMintInk: "#1D2915",
  emphasisMintBorder: "#4ADE80",
  emphasisCyanBg: "#A8DFE4",
  emphasisCyanInk: "#102426",
  emphasisCyanBorder: "#22D3EE",
  emphasisYellowBg: "#F4DE88",
  emphasisYellowInk: "#30290D",
  emphasisYellowBorder: "#FACC15",
  danger: "#DC2626",
  dangerSurface: "#FEE2E2",
  dangerText: "#991B1B",
  success: "#059669",
  successSurface: "#D1FAE5",
  successText: "#065F46",
};

export const romanticDarkColors: ThemeColors = {
  canvas: "#120C1C",
  surface: "#21152E",
  raised: "#2D1D3D",
  inset: "#180F25",
  border: "#3B264E",
  interactiveLine: "#8B719F",
  text: "#F6F0FF",
  mutedText: "#BEAFCD",
  primaryFill: "#C9A7FF",
  onPrimary: "#241135",
  focus: "#C9A7FF",
  emphasisMintBg: "#342646",
  emphasisMintInk: "#E9D8FD",
  emphasisMintBorder: "#9F7AEA",
  emphasisCyanBg: "#2D284C",
  emphasisCyanInk: "#D6BCFA",
  emphasisCyanBorder: "#805AD5",
  emphasisYellowBg: "#3C2344",
  emphasisYellowInk: "#FED7E2",
  emphasisYellowBorder: "#D53F8C",
  danger: "#F87171",
  dangerSurface: "rgba(248, 113, 113, 0.15)",
  dangerText: "#FECACA",
  success: "#34D399",
  successSurface: "rgba(52, 211, 153, 0.15)",
  successText: "#A7F3D0",
};

export const romanticLightColors: ThemeColors = {
  canvas: "#FFF5F8",
  surface: "#FFE5EE",
  raised: "#FFFFFF",
  inset: "#FCDCE8",
  border: "#F2C8D8",
  interactiveLine: "#A56C87",
  text: "#301A2C",
  mutedText: "#735466",
  primaryFill: "#9A305E",
  onPrimary: "#FFFFFF",
  focus: "#7040B5",
  emphasisMintBg: "#FFF0F5",
  emphasisMintInk: "#521B41",
  emphasisMintBorder: "#FBB6CE",
  emphasisCyanBg: "#FAF5FF",
  emphasisCyanInk: "#44337A",
  emphasisCyanBorder: "#D6BCFA",
  emphasisYellowBg: "#FFF5F7",
  emphasisYellowInk: "#702459",
  emphasisYellowBorder: "#F687B3",
  danger: "#E11D48",
  dangerSurface: "#FFE4E6",
  dangerText: "#9F1239",
  success: "#059669",
  successSurface: "#ECFDF5",
  successText: "#065F46",
};

export const colorPalette: Record<PaletteFamily, { dark: ThemeColors; light: ThemeColors }> = {
  standard: {
    dark: standardDarkColors,
    light: standardLightColors,
  },
  romantic: {
    dark: romanticDarkColors,
    light: romanticLightColors,
  },
};

export const playerAccents: Record<
  AccentFamily,
  { dark: PlayerAccentToken; light: PlayerAccentToken }
> = {
  teal: {
    dark: {
      foreground: "#68D6C2",
      fill: "rgba(104, 214, 194, 0.18)",
      border: "#68D6C2",
      onAccent: "#0A2B25",
    },
    light: {
      foreground: "#087568",
      fill: "rgba(8, 117, 104, 0.14)",
      border: "#087568",
      onAccent: "#FFFFFF",
    },
  },
  violet: {
    dark: {
      foreground: "#C5A2FF",
      fill: "rgba(197, 162, 255, 0.18)",
      border: "#C5A2FF",
      onAccent: "#221238",
    },
    light: {
      foreground: "#7040B5",
      fill: "rgba(112, 64, 181, 0.14)",
      border: "#7040B5",
      onAccent: "#FFFFFF",
    },
  },
  cyan: {
    dark: {
      foreground: "#67E8F9",
      fill: "rgba(103, 232, 249, 0.18)",
      border: "#67E8F9",
      onAccent: "#0E323A",
    },
    light: {
      foreground: "#0E7490",
      fill: "rgba(14, 116, 144, 0.14)",
      border: "#0E7490",
      onAccent: "#FFFFFF",
    },
  },
  mint: {
    dark: {
      foreground: "#86EFAC",
      fill: "rgba(134, 239, 172, 0.18)",
      border: "#86EFAC",
      onAccent: "#0D331A",
    },
    light: {
      foreground: "#15803D",
      fill: "rgba(21, 128, 61, 0.14)",
      border: "#15803D",
      onAccent: "#FFFFFF",
    },
  },
  pink: {
    dark: {
      foreground: "#F472B6",
      fill: "rgba(244, 114, 182, 0.18)",
      border: "#F472B6",
      onAccent: "#3B0E23",
    },
    light: {
      foreground: "#BE185D",
      fill: "rgba(190, 24, 93, 0.14)",
      border: "#BE185D",
      onAccent: "#FFFFFF",
    },
  },
  yellow: {
    dark: {
      foreground: "#FDE047",
      fill: "rgba(253, 224, 71, 0.18)",
      border: "#FDE047",
      onAccent: "#3B2C05",
    },
    light: {
      foreground: "#A16207",
      fill: "rgba(161, 98, 7, 0.14)",
      border: "#A16207",
      onAccent: "#FFFFFF",
    },
  },
};

export const typography = {
  fonts: {
    heading: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'DM Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  sizes: {
    title: { size: "36px", lineHeight: "1.15", weight: "700" },
    heading: { size: "24px", lineHeight: "1.25", weight: "600" },
    subhead: { size: "18px", lineHeight: "1.3", weight: "600" },
    body: { size: "16px", lineHeight: "1.5", weight: "400" },
    secondary: { size: "14px", lineHeight: "1.4", weight: "400" },
    label: { size: "12px", lineHeight: "1.3", weight: "500" },
  },
};

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  "3xl": "32px",
  "4xl": "48px",
};

// Nested radii hierarchy inspired by tracker & tennis references:
// Outer container has larger radius, nested child elements have smaller radius.
export const radii = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px", // Inset panels, sub-cards
  xl: "24px", // Main cards, elevated surface containers
  full: "9999px", // Pills, round badges, circular icon buttons
};

export const shadows = {
  card: "0 4px 16px rgba(0, 0, 0, 0.12)",
  elevated: "0 8px 24px rgba(0, 0, 0, 0.18)",
  sheet: "0 -8px 32px rgba(0, 0, 0, 0.24)",
};

export const motion = {
  pressDuration: "150ms",
  pressEasing: "cubic-bezier(.2, .8, .2, 1)",
  settleDuration: "300ms",
  settleEasing: "cubic-bezier(.16, 1, .3, 1)",
};

export function resolveThemeColors(
  family: PaletteFamily,
  resolvedMode: "light" | "dark",
): ThemeColors {
  const familyPalette = colorPalette[family] ?? colorPalette.standard;
  return familyPalette[resolvedMode] ?? familyPalette.dark;
}

export function resolvePlayerAccent(
  accent: AccentFamily,
  resolvedMode: "light" | "dark",
): PlayerAccentToken {
  const accentDef = playerAccents[accent] ?? playerAccents.teal;
  return accentDef[resolvedMode] ?? accentDef.dark;
}

// WCAG Contrast utilities for runtime/test validation
export function parseHex(hex: string): [number, number, number] {
  let c = hex.replace("#", "").trim();
  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const sRGB = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}
