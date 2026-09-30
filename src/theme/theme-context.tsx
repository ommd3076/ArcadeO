import { createContext, useContext, useEffect, useState, useMemo, type ReactNode } from "react";
import type { PaletteFamily, ThemeMode, AccentFamily } from "@shared/protocol/types";
import {
  resolveThemeColors,
  resolvePlayerAccent,
  type ThemeColors,
  type PlayerAccentToken,
} from "./tokens";

export interface ThemeContextValue {
  family: PaletteFamily;
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  playerAccent: AccentFamily;
  colors: ThemeColors;
  accentToken: PlayerAccentToken;
  setFamily: (family: PaletteFamily) => void;
  setMode: (mode: ThemeMode) => void;
  setPlayerAccent: (accent: AccentFamily) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY_FAMILY = "pa_theme_family";
const STORAGE_KEY_MODE = "pa_theme_mode";
const STORAGE_KEY_ACCENT = "pa_player_accent";

interface ThemeProviderProps {
  children: ReactNode;
  initialFamily?: PaletteFamily;
  initialMode?: ThemeMode;
  initialAccent?: AccentFamily;
}

function getSystemMode(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({
  children,
  initialFamily,
  initialMode,
  initialAccent,
}: ThemeProviderProps) {
  // Appearance defaults: Dark default for both A and B, Standard family default (or initialFamily prop)
  const [family, setFamilyState] = useState<PaletteFamily>(() => {
    if (initialFamily) return initialFamily;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_FAMILY);
      if (stored === "standard" || stored === "romantic") return stored;
    }
    return "standard";
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (initialMode) return initialMode;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_MODE);
      if (stored === "light" || stored === "dark" || stored === "system") return stored;
    }
    return "dark"; // Dark is default per PRD/DESIGN
  });

  const [playerAccent, setPlayerAccentState] = useState<AccentFamily>(() => {
    if (initialAccent) return initialAccent;
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY_ACCENT);
      if (
        stored === "teal" ||
        stored === "violet" ||
        stored === "cyan" ||
        stored === "mint" ||
        stored === "pink" ||
        stored === "yellow"
      ) {
        return stored;
      }
    }
    return "teal";
  });

  const [systemMode, setSystemMode] = useState<"light" | "dark">(getSystemMode);

  // Listen for OS color scheme changes if mode is 'system'
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemMode(e.matches ? "dark" : "light");
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  const resolvedMode: "light" | "dark" = mode === "system" ? systemMode : mode;

  const setFamily = (nextFamily: PaletteFamily) => {
    setFamilyState(nextFamily);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_FAMILY, nextFamily);
    }
  };

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_MODE, nextMode);
    }
  };

  const setPlayerAccent = (nextAccent: AccentFamily) => {
    setPlayerAccentState(nextAccent);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_ACCENT, nextAccent);
    }
  };

  const toggleMode = () => {
    const nextMode = resolvedMode === "dark" ? "light" : "dark";
    setMode(nextMode);
  };

  // Sync dataset attributes onto documentElement for CSS styling
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.setAttribute("data-theme-family", family);
    root.setAttribute("data-theme-mode", resolvedMode);
    root.setAttribute("data-accent", playerAccent);
  }, [family, resolvedMode, playerAccent]);

  const colors = useMemo(() => resolveThemeColors(family, resolvedMode), [family, resolvedMode]);
  const accentToken = useMemo(
    () => resolvePlayerAccent(playerAccent, resolvedMode),
    [playerAccent, resolvedMode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      family,
      mode,
      resolvedMode,
      playerAccent,
      colors,
      accentToken,
      setFamily,
      setMode,
      setPlayerAccent,
      toggleMode,
    }),
    [family, mode, resolvedMode, playerAccent, colors, accentToken],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
