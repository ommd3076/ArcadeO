# Private Arcade — Stitch UI Export for Implementation

**Generated:** 2026-10-02  
**Source:** Google Stitch Project `9099986947047806544`  
**Location:** `planning/design/stitch/export/`

> [!IMPORTANT]
> These exported Stitch HTML files are **visual references** — they show the approved design direction, not production React components. Extract colors, spacing, typography, layout composition, and component anatomy from them. Do NOT copy-paste them as-is into the React app.

---

## 1. Export Directory Structure

```
planning/design/stitch/export/
├── html/                              # Self-contained HTML mockups (open in browser)
│   ├── K1-home-standard-light.html    # ★ Definitive Home (Standard Light)
│   ├── K2-home-standard-dark.html     # ★ Definitive Home (Standard Dark)
│   ├── K3-home-romantic-dark.html     # ★ Definitive Home (Romantic Dark)
│   ├── K4-home-romantic-light.html    # ★ Definitive Home (Romantic Light)
│   ├── K5-game-shell-connect-four.html# ★ Outer Game Shell Chrome
│   ├── K6-secret-handoff-veil.html    # ★ Together Mode Privacy Veil
│   ├── K7-desktop-home-bento.html     # ★ Desktop 1280×800 Bento Layout
│   ├── K8-appearance-editorial-dark.html # ★ Appearance & Settings (Editorial)
│   ├── games-catalog.html             # Games directory (8 games)
│   ├── us-screen.html                 # Us / shared records
│   ├── sudoku-setup.html              # Sudoku mode/difficulty setup
│   ├── connect-four-gameplay.html     # Connect Four board gameplay
│   ├── ludo-duel.html                 # Ludo classic board
│   ├── snakes-and-ladders.html        # Snakes & Ladders board
│   ├── rps-handoff.html               # RPS secret handoff
│   ├── rps-reveal.html                # RPS simultaneous reveal
│   └── offline-reconnecting.html      # Offline/reconnection state
├── screenshots/                       # PNG screenshots of definitive K1–K8
│   ├── K1-home-standard-light.png
│   ├── K2-home-standard-dark.png
│   ├── K3-home-romantic-dark.png
│   ├── K4-home-romantic-light.png
│   ├── K5-game-shell-connect-four.png
│   ├── K6-secret-handoff-veil.png
│   ├── K7-desktop-home-bento.png
│   └── K8-appearance-editorial-dark.png
└── CODEX-HANDOFF.md                   # ← This file
```

---

## 2. Design System Quick Reference

### 2.1 CSS Custom Properties (4 Theme Variants)

```css
/* ═══ STANDARD DARK (default :root) ═══ */
:root {
  --pa-canvas-base: #0C0C0F;
  --pa-surface-layer-1: #16161B;
  --pa-surface-layer-2: #1F1F26;
  --pa-surface-layer-3: #282833;
  --pa-border-hairline: rgba(255, 255, 255, 0.08);
  --pa-border-muted: rgba(255, 255, 255, 0.14);
  --pa-text-primary: #F4F4F6;
  --pa-text-secondary: #8C8C9A;
  --pa-text-subtle: #5A5A66;

  /* Editorial Colored Surfaces */
  --pa-deck-mint-surface: #CFE6A3;
  --pa-deck-mint-ink: #1D2915;
  --pa-deck-yellow-surface: #F4DE88;
  --pa-deck-yellow-ink: #2E2305;
  --pa-deck-cyan-surface: #A8DFE4;
  --pa-deck-cyan-ink: #11292B;

  /* Playful Accents */
  --pa-accent-lime: #D4FE00;        /* Speech bubbles & banter */
  --pa-accent-lime-ink: #0D0D0D;
  --pa-accent-orange: #FF6B00;      /* Wager & milestone badges */
  --pa-accent-orange-ink: #FFFFFF;

  /* Squircle Radii */
  --pa-radius-squircle: 32px;
  --pa-radius-card: 28px;
  --pa-radius-inner: 20px;
  --pa-radius-control: 14px;
  --pa-radius-pill: 9999px;

  /* Typography */
  --pa-font-heading: 'Barlow Condensed', 'Antonio', 'DIN Condensed', sans-serif;
  --pa-font-body: 'Plus Jakarta Sans', 'Hanken Grotesk', -apple-system, sans-serif;
  --pa-font-functional: 'Barlow Condensed', 'Antonio', 'DIN Condensed', monospace;

  /* Spacing */
  --pa-space-2xs: 4px;
  --pa-space-xs: 8px;
  --pa-space-sm: 12px;
  --pa-space-md: 16px;
  --pa-space-lg: 20px;
  --pa-space-xl: 24px;
  --pa-space-2xl: 32px;
  --pa-space-3xl: 48px;
}

/* ═══ STANDARD LIGHT ═══ */
[data-theme="standard-light"] {
  --pa-canvas-base: #F7F7F8;
  --pa-surface-layer-1: #FFFFFF;
  --pa-surface-layer-2: #EFEFF2;
  --pa-surface-layer-3: #E4E4E8;
  --pa-border-hairline: rgba(0, 0, 0, 0.06);
  --pa-border-muted: rgba(0, 0, 0, 0.12);
  --pa-text-primary: #0D0D0D;
  --pa-text-secondary: #5A5A66;
  --pa-text-subtle: #8C8C9A;
  --pa-accent-lime: #D4FE00;
  --pa-accent-lime-ink: #0D0D0D;
  --pa-accent-orange: #FF6B00;
  --pa-accent-orange-ink: #FFFFFF;
}

/* ═══ ROMANTIC DARK ═══ */
[data-theme="romantic-dark"] {
  --pa-canvas-base: #120C1C;
  --pa-surface-layer-1: #1D142A;
  --pa-surface-layer-2: #281C38;
  --pa-surface-layer-3: #36264C;
  --pa-border-hairline: rgba(201, 167, 255, 0.14);
  --pa-border-muted: rgba(201, 167, 255, 0.22);
  --pa-text-primary: #FDF8FF;
  --pa-text-secondary: #A396B2;
  --pa-text-subtle: #6D607B;
  --pa-accent-lime: #C9A7FF;        /* Luminous Lilac replaces acid-lime */
  --pa-accent-lime-ink: #241135;
  --pa-accent-orange: #F4DE88;      /* Champagne Gold replaces orange */
  --pa-accent-orange-ink: #2E2305;
}

/* ═══ ROMANTIC LIGHT ═══ */
[data-theme="romantic-light"] {
  --pa-canvas-base: #FFF5F8;
  --pa-surface-layer-1: #FFE5EE;
  --pa-surface-layer-2: #FFFFFF;
  --pa-surface-layer-3: #FCD5E4;
  --pa-border-hairline: rgba(154, 48, 94, 0.12);
  --pa-border-muted: rgba(154, 48, 94, 0.20);
  --pa-text-primary: #301A2C;
  --pa-text-secondary: #7A6273;
  --pa-text-subtle: #A38C9C;
  --pa-accent-lime: #FF4081;        /* Radiant Raspberry replaces acid-lime */
  --pa-accent-lime-ink: #FFFFFF;
  --pa-accent-orange: #F7DE98;      /* Warm Champagne replaces orange */
  --pa-accent-orange-ink: #301A2C;
}
```

### 2.2 Tailwind Config Extensions

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: { base: 'var(--pa-canvas-base)' },
        surface: {
          layer1: 'var(--pa-surface-layer-1)',
          layer2: 'var(--pa-surface-layer-2)',
          layer3: 'var(--pa-surface-layer-3)',
        },
        deck: {
          mint: 'var(--pa-deck-mint-surface)',
          'mint-ink': 'var(--pa-deck-mint-ink)',
          yellow: 'var(--pa-deck-yellow-surface)',
          'yellow-ink': 'var(--pa-deck-yellow-ink)',
          cyan: 'var(--pa-deck-cyan-surface)',
          'cyan-ink': 'var(--pa-deck-cyan-ink)',
          lilac: 'var(--pa-deck-lilac-surface)',
          'lilac-ink': 'var(--pa-deck-lilac-ink)',
          berry: 'var(--pa-deck-berry-surface)',
          'berry-ink': 'var(--pa-deck-berry-ink)',
        },
        accent: {
          lime: 'var(--pa-accent-lime)',
          'lime-ink': 'var(--pa-accent-lime-ink)',
          orange: 'var(--pa-accent-orange)',
          'orange-ink': 'var(--pa-accent-orange-ink)',
        },
      },
      borderRadius: {
        squircle: '32px',
        card: '28px',
        inner: '20px',
        control: '14px',
        full: '9999px',
      },
      fontFamily: {
        heading: ['"Barlow Condensed"', '"Antonio"', '"DIN Condensed"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', '"Hanken Grotesk"', '-apple-system', 'sans-serif'],
        functional: ['"Barlow Condensed"', '"Antonio"', '"DIN Condensed"', 'monospace'],
      },
    },
  },
};
```

### 2.3 Typography System (60-30-10 Rule)

| Role | Weight | Font Stack | Case | Tracking | Usage |
|:-----|:-------|:-----------|:-----|:---------|:------|
| **Main Headings** | Bold 700 | `--pa-font-heading` | ALL CAPS | +0.02em | `PRIVATE ARCADE`, `LUDO DUEL`, `CONNECT FOUR`, `EYES CLOSED` |
| **60% Reading** | Regular 400 / Medium 500 | `--pa-font-body` | Sentence case | Normal | Partner dialogues, instructions, body copy |
| **30% Controls** | Bold 700 | `--pa-font-functional` | ALL CAPS | +0.06em to +0.1em | `[ JUMP IN · RESUME → ]`, `[ SARAH 🟢 24MS ]`, dock tabs |
| **Stats/Timers** | Light 300 | `--pa-font-body` | Normal | -0.04em | `14 DAYS`, `⏱ 0:24`, scores. Use `font-variant-numeric: tabular-nums` |

> [!CAUTION]
> **ZERO cursive, brush, or handwriting fonts anywhere in the system. Strictly prohibited.**

### 2.4 Icon System

Use **Lucide Icons** (`lucide-react`) exclusively. All icons: 24×24dp, 2px stroke, rounded caps/joins.

| Context | Lucide Component | Size |
|:--------|:-----------------|:-----|
| Brand masthead | `<Sparkles />` | 20px |
| Peer latency | `<Radio />` | 14px |
| Streaks | `<Flame />` | 16px |
| Achievements | `<Trophy />` | 16px |
| Wagers | `<Coffee />` | 14px |
| Dice result | `<Dice5 />` | 18px |
| Nav: Home | `<Home />` | 22px |
| Nav: Games | `<Gamepad2 />` | 22px |
| Nav: Us | `<Heart />` | 22px |
| Together lock | `<Lock />` | 28px |
| Shield seal | `<ShieldCheck />` | 16px |
| CTA arrow | `<ArrowRight />` | 18px |
| Back pill | `<ArrowLeft />` | 16px |
| Draw offer | `<Handshake />` | 16px |
| Haptics | `<Zap />` | 16px |
| Audio | `<Volume2 />` | 16px |

---

## 3. Component Architecture (React/Tailwind)

Build these reusable components matching the exported HTML mockups:

### 3.1 `GameShell.tsx` — Outer Game Chrome
- **Reference HTML:** `K5-game-shell-connect-four.html`
- **Purpose:** Wraps any active game with top bar + bottom thumb zone
- **Top Bar (56px):** Back pill `[ ← GAMES ]` | Condensed all-caps game title | Partner presence pill
- **Stage Container:** `rounded-[32px]` porcelain/slate card housing the board
- **Thumb Zone:** 52px primary pill CTA + secondary utility pills
- **Rule:** Completely suppresses bottom navigation dock

### 3.2 `CardCarousel.tsx` — Home Screen Hero Deck
- **Reference HTML:** `K1-home-standard-light.html`, `K2-home-standard-dark.html`
- **Container:** `overflow-x: auto; scroll-snap-type: x mandatory; padding: 0 20px;`
- **Card:** `width: min(calc(100vw - 64px), 340px); border-radius: 32px; padding: 24px-28px;`
- **Stacking:** Adjacent cards peek at `scale: 0.94, opacity: 0.65`

### 3.3 `PlayfulSpeechBubble.tsx` — Banter Bubble
- **Fill:** `var(--pa-accent-lime)` with dark ink
- **Geometry:** `rounded-2xl` with 45° directional pointer tail
- **Shadow:** `0 2px 0 #000000` (comic offset)
- **Rule:** ONLY for partner banter, NEVER for headings or buttons

### 3.4 `WagerBadge.tsx` — Scalloped Starburst Pill
- **Fill:** `var(--pa-accent-orange)`
- **Ink:** White
- **Typography:** `--pa-font-functional`, 11px, bold, ALL CAPS, +0.08em tracking

### 3.5 `PrivacyVeil.tsx` — Together Mode Handoff
- **Reference HTML:** `K6-secret-handoff-veil.html`
- **Full-screen opaque cover with 3D padlock, speech bubble, role unlock pill**
- **Rule:** 100% suppression of bottom dock

### 3.6 `FloatingDock.tsx` — Bottom Navigation
- **Height:** 60px, centered, floating 24px above safe area
- **Material:** `rgba(22,22,27,0.85)` + `backdrop-filter: blur(20px)`
- **Items:** Home, Games, Us (Lucide icons)
- **Active state:** White micro-pill with dark icon
- **Rule:** HIDDEN during all gameplay and setup screens

### 3.7 `DesktopBentoShell.tsx` — Landscape Layout
- **Reference HTML:** `K7-desktop-home-bento.html`
- **Floating glassmorphic top bar with brand + nav pills**
- **7-col left hero + 5-col right streak/vault stack**
- **Min outer padding 48px, column gutter 24px**

### 3.8 `AppearanceSettings.tsx` — Theme Customization
- **Reference HTML:** `K8-appearance-editorial-dark.html`
- **Editorial card composition with deliberately varied card surfaces:**
  - Card 1: Porcelain white (mode selector)
  - Card 2: Luminous mint `#CFE6A3` (theme families)
  - Card 3: Butter yellow `#F4DE88` (player pieces)
  - Card 4: Elevated charcoal `#1F1F27` (sensory toggles)

---

## 4. Screen-to-Route Mapping

| Screen | Route | Reference HTML | Key Components |
|:-------|:------|:---------------|:---------------|
| Login | `/login` | — | Simple auth form, no dock |
| Home | `/` | `K1`–`K4` (per theme) | `CardCarousel`, `FloatingDock`, streak card |
| Games | `/games` | `games-catalog.html` | 8-game grid, `FloatingDock` |
| Us | `/us` | `us-screen.html` | Shared records, `FloatingDock` |
| Appearance | `/settings` | `K8` | `AppearanceSettings`, `FloatingDock` |
| Game Setup | `/games/:id/setup` | `sudoku-setup.html` | Mode/difficulty selector, NO dock |
| Gameplay | `/games/:id/match/:mid` | `K5`, board HTMLs | `GameShell`, board component, NO dock |
| Secret Handoff | (overlay during Together) | `K6` | `PrivacyVeil`, NO dock |
| Offline State | (overlay) | `offline-reconnecting.html` | Reconnection banner |

---

## 5. Font Installation

Add to `index.html` or CSS imports:

```html
<!-- Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

Install icons:
```bash
npm install lucide-react
```

---

## 6. Key Design Rules for Implementation

1. **iOS Squircle Geometry:** All containers use `rounded-[32px]` continuous curvature. Nested elements step down: `28px → 20px → 14px → 9999px`.
2. **Dock Visibility:** Bottom navigation dock is VISIBLE on Home, Games, Us, Settings. HIDDEN on all gameplay, setup, and handoff screens.
3. **Mobile First:** Design for 390×844 (iPhone 14/15). Support 320px (SE) → 430px (Pro Max). Desktop adapts at ≥1024px with bento layout.
4. **Player Colors ≠ Theme:** Player piece colors (Emerald, Cyan, Coral, Amber) are independent from the app theme (Standard/Romantic × Light/Dark).
5. **Board-First Gameplay:** Game boards fill the porcelain stage. Controls sit below in the thumb zone. No repeated player banners.
6. **Playful Accents:** Speech bubbles and wager badges are decorative accents for conversational energy — they adapt per theme variant (acid-lime in Standard, lilac in Romantic Dark, raspberry in Romantic Light).

---

## 7. Detailed Design Documentation

For deeper specifications, see:

- `planning/design/stitch/VISUAL-DIRECTION.md` — Typography hierarchy, shell architecture, theme palette matrix
- `planning/design/stitch/DESIGN-SYSTEM.md` — Complete CSS tokens, component catalog, icon mapping
- `planning/design/stitch/IMPLEMENTATION-HANDOFF.md` — Engineering brief, Tailwind config, golden rules
- `planning/design/stitch/SCREEN-LIBRARY.md` — Regional breakdowns for every screen
- `planning/design/stitch/MOTION-SPECIFICATIONS.md` — Animation timing & reduced-motion guidelines
- `planning/design/stitch/BOARD-SPECIFICATIONS.md` — Board vector geometry & thumb deck specs
