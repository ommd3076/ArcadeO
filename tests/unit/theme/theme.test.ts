import { describe, it, expect } from "vitest";
import {
  colorPalette,
  playerAccents,
  typography,
  spacing,
  radii,
  motion,
  resolveThemeColors,
  resolvePlayerAccent,
  getContrastRatio,
  getRelativeLuminance,
  parseHex,
} from "../../../src/theme/tokens";
import type { PaletteFamily, AccentFamily } from "@shared/protocol/types";

describe("Theme System & Semantic Tokens", () => {
  describe("Color Palette Structure", () => {
    const families: PaletteFamily[] = ["standard", "romantic"];
    const modes: ("dark" | "light")[] = ["dark", "light"];

    it("defines all required palette families and modes", () => {
      families.forEach((fam) => {
        expect(colorPalette[fam]).toBeDefined();
        modes.forEach((mode) => {
          const colors = colorPalette[fam][mode];
          expect(colors).toBeDefined();
          expect(colors.canvas).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.surface).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.raised).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.text).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.mutedText).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.primaryFill).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(colors.onPrimary).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
      });
    });

    it("resolves palette tokens via resolveThemeColors", () => {
      const standardDark = resolveThemeColors("standard", "dark");
      expect(standardDark.canvas).toBe("#0C0C0F");
      expect(standardDark.surface).toBe("#1C1C20");

      const standardLight = resolveThemeColors("standard", "light");
      expect(standardLight.canvas).toBe("#F7F7F8");
      expect(standardLight.surface).toBe("#FFFFFF");

      const romanticDark = resolveThemeColors("romantic", "dark");
      expect(romanticDark.canvas).toBe("#120C1C");

      const romanticLight = resolveThemeColors("romantic", "light");
      expect(romanticLight.canvas).toBe("#FFF5F8");
    });
  });

  describe("WCAG AA Contrast Compliance (>= 4.5:1 for body/heading text)", () => {
    it("meets >= 4.5:1 contrast for main text against canvas in all variants", () => {
      const variants: [PaletteFamily, "dark" | "light"][] = [
        ["standard", "dark"],
        ["standard", "light"],
        ["romantic", "dark"],
        ["romantic", "light"],
      ];

      variants.forEach(([fam, mode]) => {
        const colors = colorPalette[fam][mode];
        const ratio = getContrastRatio(colors.text, colors.canvas);
        expect(
          ratio,
          `Text ${colors.text} on canvas ${colors.canvas} in ${fam}-${mode} should be >= 4.5 (was ${ratio.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    });

    it("meets >= 4.5:1 contrast for main text against surface in all variants", () => {
      const variants: [PaletteFamily, "dark" | "light"][] = [
        ["standard", "dark"],
        ["standard", "light"],
        ["romantic", "dark"],
        ["romantic", "light"],
      ];

      variants.forEach(([fam, mode]) => {
        const colors = colorPalette[fam][mode];
        const ratio = getContrastRatio(colors.text, colors.surface);
        expect(
          ratio,
          `Text ${colors.text} on surface ${colors.surface} in ${fam}-${mode} should be >= 4.5 (was ${ratio.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    });

    it("meets >= 4.5:1 contrast for on-primary on primary-fill in all variants", () => {
      const variants: [PaletteFamily, "dark" | "light"][] = [
        ["standard", "dark"],
        ["standard", "light"],
        ["romantic", "dark"],
        ["romantic", "light"],
      ];

      variants.forEach(([fam, mode]) => {
        const colors = colorPalette[fam][mode];
        const ratio = getContrastRatio(colors.onPrimary, colors.primaryFill);
        expect(
          ratio,
          `onPrimary ${colors.onPrimary} on primaryFill ${colors.primaryFill} in ${fam}-${mode} should be >= 4.5 (was ${ratio.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(4.5);
      });
    });

    it("meets >= 4.5:1 contrast for emphasis card text on card backgrounds", () => {
      // Standard Mint
      const mintRatio = getContrastRatio(
        colorPalette.standard.dark.emphasisMintInk,
        colorPalette.standard.dark.emphasisMintBg,
      );
      expect(mintRatio).toBeGreaterThanOrEqual(4.5);

      // Standard Cyan
      const cyanRatio = getContrastRatio(
        colorPalette.standard.dark.emphasisCyanInk,
        colorPalette.standard.dark.emphasisCyanBg,
      );
      expect(cyanRatio).toBeGreaterThanOrEqual(4.5);

      // Standard Yellow
      const yellowRatio = getContrastRatio(
        colorPalette.standard.dark.emphasisYellowInk,
        colorPalette.standard.dark.emphasisYellowBg,
      );
      expect(yellowRatio).toBeGreaterThanOrEqual(4.5);

      // Romantic emphasis cards
      const romDarkMint = getContrastRatio(
        colorPalette.romantic.dark.emphasisMintInk,
        colorPalette.romantic.dark.emphasisMintBg,
      );
      expect(romDarkMint).toBeGreaterThanOrEqual(4.5);

      const romLightMint = getContrastRatio(
        colorPalette.romantic.light.emphasisMintInk,
        colorPalette.romantic.light.emphasisMintBg,
      );
      expect(romLightMint).toBeGreaterThanOrEqual(4.5);
    });

    it("meets >= 3.0:1 contrast for muted text (secondary hierarchy)", () => {
      const variants: [PaletteFamily, "dark" | "light"][] = [
        ["standard", "dark"],
        ["standard", "light"],
        ["romantic", "dark"],
        ["romantic", "light"],
      ];

      variants.forEach(([fam, mode]) => {
        const colors = colorPalette[fam][mode];
        const ratio = getContrastRatio(colors.mutedText, colors.canvas);
        expect(
          ratio,
          `Muted text ${colors.mutedText} on canvas ${colors.canvas} in ${fam}-${mode} should be >= 3.0 (was ${ratio.toFixed(2)})`,
        ).toBeGreaterThanOrEqual(3.0);
      });
    });
  });

  describe("Player Accent Identities", () => {
    const accents: AccentFamily[] = ["teal", "violet", "cyan", "mint", "pink", "yellow"];

    it("provides all 6 player accent families for both dark and light modes", () => {
      accents.forEach((acc) => {
        expect(playerAccents[acc]).toBeDefined();
        expect(playerAccents[acc].dark.foreground).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(playerAccents[acc].light.foreground).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(playerAccents[acc].dark.fill).toBeDefined();
        expect(playerAccents[acc].light.fill).toBeDefined();
      });
    });

    it("ensures dark mode player accents meet >= 3:1 contrast against dark canvases", () => {
      const darkCanvases = [colorPalette.standard.dark.canvas, colorPalette.romantic.dark.canvas];

      accents.forEach((acc) => {
        const token = resolvePlayerAccent(acc, "dark");
        darkCanvases.forEach((canvas) => {
          const ratio = getContrastRatio(token.foreground, canvas);
          expect(
            ratio,
            `Accent ${acc} foreground ${token.foreground} on dark canvas ${canvas} should be >= 3.0 (was ${ratio.toFixed(2)})`,
          ).toBeGreaterThanOrEqual(3.0);
        });
      });
    });

    it("ensures light mode player accents meet >= 3:1 contrast against light canvases", () => {
      const lightCanvases = [
        colorPalette.standard.light.canvas,
        colorPalette.romantic.light.canvas,
      ];

      accents.forEach((acc) => {
        const token = resolvePlayerAccent(acc, "light");
        lightCanvases.forEach((canvas) => {
          const ratio = getContrastRatio(token.foreground, canvas);
          expect(
            ratio,
            `Accent ${acc} foreground ${token.foreground} on light canvas ${canvas} should be >= 3.0 (was ${ratio.toFixed(2)})`,
          ).toBeGreaterThanOrEqual(3.0);
        });
      });
    });
  });

  describe("Typography, Radii, Spacing & Motion Tokens", () => {
    it("specifies the three mandatory font roles per DESIGN.md", () => {
      expect(typography.fonts.display).toContain("Barlow Condensed");
      expect(typography.fonts.heading).toContain("Plus Jakarta Sans");
      expect(typography.fonts.body).toContain("Plus Jakarta Sans");
      expect(typography.fonts.mono).toContain("DM Mono");
    });

    it("enforces nested corner radii hierarchy (outer container > inner card > chip)", () => {
      const xl = parseInt(radii.xl, 10);
      const lg = parseInt(radii.lg, 10);
      const md = parseInt(radii.md, 10);
      const sm = parseInt(radii.sm, 10);
      const xs = parseInt(radii.xs, 10);

      expect(xl).toBeGreaterThan(lg);
      expect(lg).toBeGreaterThan(md);
      expect(md).toBeGreaterThan(sm);
      expect(sm).toBeGreaterThan(xs);
    });

    it("defines an ascending spacing scale", () => {
      const xs = parseInt(spacing.xs, 10);
      const sm = parseInt(spacing.sm, 10);
      const md = parseInt(spacing.md, 10);
      const lg = parseInt(spacing.lg, 10);
      const xl = parseInt(spacing.xl, 10);

      expect(xs).toBeLessThan(sm);
      expect(sm).toBeLessThan(md);
      expect(md).toBeLessThan(lg);
      expect(lg).toBeLessThan(xl);
    });

    it("adheres to UI-CONTRACT press feedback timing (<= 180ms)", () => {
      const duration = parseInt(motion.pressDuration, 10);
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(duration).toBeLessThanOrEqual(180);
    });
  });

  describe("Contrast Utilities", () => {
    it("parses hex colors correctly", () => {
      expect(parseHex("#FFFFFF")).toEqual([255, 255, 255]);
      expect(parseHex("#000000")).toEqual([0, 0, 0]);
      expect(parseHex("#FFF")).toEqual([255, 255, 255]);
    });

    it("computes relative luminance for black and white", () => {
      expect(getRelativeLuminance("#000000")).toBeCloseTo(0, 4);
      expect(getRelativeLuminance("#FFFFFF")).toBeCloseTo(1, 4);
    });

    it("computes contrast ratio of black on white as 21:1", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 1);
    });
  });
});
