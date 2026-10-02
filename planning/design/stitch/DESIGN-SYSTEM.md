# Private Arcade — Design System Specification: "Nocturne Duo"

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/DESIGN-SYSTEM.md`  
**Stitch Asset:** `assets/0fb48a45937f4aa7a98ce72c8c4231ee`  
**Base Grid:** 4-Column Fluid Mobile Grid (8px Baseline)  

---

## 1. System Tokens & CSS Variables

```css
:root {
  /* Canvas & Foundations */
  --pa-canvas-base: #0C0C0F;
  --pa-surface-layer-1: #16161B;
  --pa-surface-layer-2: #1F1F26;
  --pa-surface-layer-3: #282833;
  --pa-border-hairline: rgba(255, 255, 255, 0.08);
  --pa-border-muted: rgba(255, 255, 255, 0.14);
  --pa-border-focused: #CFE6A3;

  /* Typography Colors */
  --pa-text-primary: #F4F4F6;
  --pa-text-secondary: #8C8C9A;
  --pa-text-subtle: #5A5A66;

  /* Signature Pastel Decks (High-Contrast Editorial) */
  --pa-deck-mint-surface: #CFE6A3;
  --pa-deck-mint-ink: #1D2915;
  --pa-deck-yellow-surface: #F4DE88;
  --pa-deck-yellow-ink: #2E2305;
  --pa-deck-cyan-surface: #A8DFE4;
  --pa-deck-cyan-ink: #11292B;

  /* Romantic Duo Overrides */
  --pa-romantic-canvas: #120C1C;
  --pa-romantic-surface-1: #1D142A;
  --pa-romantic-surface-2: #281C38;
  --pa-deck-lilac-surface: #C9A7FF;
  --pa-deck-lilac-ink: #241135;
  --pa-deck-berry-surface: #9A305E;
  --pa-deck-berry-ink: #FFFFFF;

  /* Playful Accent Tokens (from playful-accent) */
  --pa-accent-lime: #D4FE00; /* Conversational Speech Bubbles & Banter */
  --pa-accent-lime-ink: #0D0D0D;
  --pa-accent-orange: #FF6B00; /* Scalloped Wager & Milestone Badges */
  --pa-accent-orange-ink: #FFFFFF;

  /* Concentric iOS Squircle Radii */
  --pa-radius-squircle: 32px; /* rounded-[32px] primary screen cards & game stage */
  --pa-radius-card: 28px;     /* rounded-[28px] carousel cards */
  --pa-radius-inner: 20px;    /* rounded-[20px] nested containers */
  --pa-radius-control: 14px;  /* rounded-[14px] sub-controls */
  --pa-radius-pill: 9999px;   /* rounded-full capsules & buttons */

  /* Typography System ("THE EVOLUTION" + Modern Conversational Sans) */
  --pa-font-heading: 'Barlow Condensed', 'Antonio', 'DIN Condensed', sans-serif; /* Main Headings: ALL CAPS */
  --pa-font-body: 'Plus Jakarta Sans', 'Hanken Grotesk', -apple-system, sans-serif; /* 60% Conversational Reading */
  --pa-font-functional: 'Barlow Condensed', 'Antonio', 'DIN Condensed', monospace; /* 30% Controls & Badges: ALL CAPS */

  /* Spacing Rhythm */
  --pa-space-2xs: 4px;
  --pa-space-xs: 8px;
  --pa-space-sm: 12px;
  --pa-space-md: 16px;
  --pa-space-lg: 20px;
  --pa-space-xl: 24px;
  --pa-space-2xl: 32px;
  --pa-space-3xl: 48px;
}

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
  --pa-accent-lime: #C9A7FF; /* Luminous Lilac Speech Bubble */
  --pa-accent-lime-ink: #241135;
  --pa-accent-orange: #F4DE88; /* Champagne Gold Wager Badge */
  --pa-accent-orange-ink: #2E2305;
}

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
  --pa-accent-lime: #FF4081; /* Radiant Raspberry Speech Bubble */
  --pa-accent-lime-ink: #FFFFFF;
  --pa-accent-orange: #F7DE98; /* Warm Champagne Gold Wager */
  --pa-accent-orange-ink: #301A2C;
}
```

---

## 1.2 Vector Iconography Specification (Lucide & Phosphor)

To eliminate generic placeholder icons, Private Arcade standardizes strictly on **Lucide Icons** (`lucide-react`) and **Phosphor Icons**:

- **Grid & Stroke Geometry:** Built on a strict 24×24dp pixel grid with a continuous `2px` stroke weight, rounded stroke-caps (`stroke-linecap="round"`), and rounded joints (`stroke-linejoin="round"`).
- **Zero Placeholder Icons:** All icons must be production-grade vector glyphs from Lucide or Phosphor with crisp optical alignment.
- **Icon Mapping Catalog:**
  | Context | Icon Token | Lucide Component | Aesthetic Purpose |
  | :------ | :--------- | :--------------- | :---------------- |
  | **Masthead** | `sparkles` | `<Sparkles size={20} />` | Brand mark accent next to `PRIVATE ARCADE` |
  | **Peer Status** | `wifi` / `radio` | `<Radio size={14} />` | Live partner ping & Cloudflare DO consensus |
  | **Streak Record** | `flame` / `trophy` | `<Flame size={16} />`, `<Trophy size={16} />` | Milestone highlights & top 2% couple ranking |
  | **Wager Stakes** | `coffee` / `gift` | `<Coffee size={14} />` | Iced matcha / gelato wager agreements |
  | **Board Steps** | `dice-5` | `<Dice5 size={18} />` | 3D tactile dice roll result indicator |
  | **Navigation Dock** | `home`, `gamepad-2`, `heart` | `<Home size={22} />`, `<Gamepad2 size={22} />`, `<Heart size={22} />` | Floating pill dock navigation destinations |
  | **Together Mode** | `lock`, `shield-check` | `<Lock size={28} />`, `<ShieldCheck size={16} />` | Secret handoff privacy vault & anti-peek seal |
  | **Actions** | `arrow-right` | `<ArrowRight size={18} />` | High-contrast pill CTA trailing direction |
  | **Back Pill** | `arrow-left` | `<ArrowLeft size={16} />` | Top chrome back navigation (`← GAMES`) |
  | **Options / Draw** | `handshake`, `sliders-horizontal` | `<Handshake size={16} />`, `<SlidersHorizontal size={16} />` | Outer game shell secondary utility actions |

---

## 2. Reusable Component Catalog

### 2.1 Action Buttons

#### Primary Pastel Pill Button
- **Geometry:** Height: `48px` (mobile thumb zone); Padding: `0 24px`; Radius: `9999px`.
- **Colors:** Background: `var(--pa-deck-mint-surface)`; Text: `var(--pa-deck-mint-ink)`; Font: `Plus Jakarta Sans`, 13px, SemiBold (`label-lg`), tracking `+0.01em`.
- **Interactive Feedback:** On press: `transform: scale(0.98)`; opacity: `0.92`; transition: `transform 80ms ease-out`. Zero outer glow or fuzzy shadow.

#### Secondary Dark Pill Button
- **Geometry:** Height: `44px`; Padding: `0 20px`; Radius: `9999px`.
- **Colors:** Background: `var(--pa-surface-layer-2)`; Border: `1px solid var(--pa-border-muted)`; Text: `var(--pa-text-primary)`.

#### Circular Tactical Button (e.g. Column Drops, Undo, Close)
- **Geometry:** `44px × 44px` square; Radius: `9999px`.
- **Colors:** Background: `var(--pa-surface-layer-2)`; Border: `1px solid var(--pa-border-hairline)`. Centered icon or label.

---

### 2.2 Pastel Accent Decks (Hero, Turn & Challenge Cards)

These tactile cards sit flush on the night canvas to create sharp editorial moments:

```
┌─────────────────────────────────────────────────────────────┐
│ ✦ YOUR TURN IN LUDO                             ⏱ 0:42      │  <- label-micro (0.1em tracking)
│ Roll a 6 to liberate token from yard                        │  <- headline-md (font-medium)
│                                                             │
│                                      (  [ 🎲 ROLL DICE ] )  │  <- solid pill CTA
└─────────────────────────────────────────────────────────────┘
```

1. **Mint Deck (`#CFE6A3`):** Reserved for Daniel's active turns, game launch cards, and primary duel invitations. Paired with Deep Forest Ink (`#1D2915`).
2. **Warm Yellow Deck (`#F4DE88`):** Reserved for Sarah's streaks, shared rituals, pass-phone instructions, and celebratory milestone cards. Paired with Deep Amber Ink (`#2E2305`).
3. **Cyan Deck (`#A8DFE4`):** Reserved for game state synchronization, match scorebook telemetry, and archival duel records. Paired with Deep Teal Ink (`#11292B`).
4. **Lilac Deck (`#C9A7FF`):** Reserved for Romantic Duo hero cards and duel deciders. Paired with Deep Plum Ink (`#241135`).

---

### 2.3 Floating Bottom Navigation Pill Dock

- **Placement:** Fixed island anchored `24px` above the bottom screen safe area, horizontally centered (`left: 50%`, `transform: translateX(-50%)`).
- **Dimensions:** Height: `60px`; Width: `min(calc(100vw - 48px), 320px)`.
- **Material:** Background: `rgba(22, 22, 27, 0.85)`; `backdrop-filter: blur(20px)`; Border: `1px solid var(--pa-border-muted)`. Ambient shadow: `0 12px 32px rgba(0, 0, 0, 0.6)`.
- **Navigation Items:** Exactly three items:
  1. `Home` (`cottage` icon + label)
  2. `Games` (`sports_esports` icon + label)
  3. `Us` (`favorite` icon + label)
- **Active State:** Encased in a solid white micro-pill (`#F4F4F6`) with dark charcoal icon/text (`#0C0C0F`). Inactive items are tinted in `var(--pa-text-secondary)`.
- **STRICT VISIBILITY RULE:** Dock is **100% hidden** during active gameplay and game setup screens.

---

### 2.4 Stat Callouts & Chronograph Trackers

- **Geometry:** Border-radius: `20px`; Padding: `16px`; Background: `var(--pa-surface-layer-1)`; Border: `1px solid var(--pa-border-hairline)`.
- **Layout:** Dual-column split (Daniel vs. Sarah) divided by a 1px vertical hairline divider (`rgba(255,255,255,0.06)`).
- **Typography:**
  - Micro-Category: `label-micro` (9px, bold, uppercase, tracking `+0.1em`) positioned at top.
  - Value: `stat-counter` (`Plus Jakarta Sans`, 38px, Light `300`, tracking `-0.04em`, `tabular-nums`).
  - Subtitle: `body-md` (14px, muted).

---

### 2.5 Board Housing & Turn Banners

- **Board Housing:** Enclosed inside a `rounded-[32px]` porcelain/slate container (`#141419` on dark, `#FFFFFF` on light), with internal padding of `20px` to `24px`.
- **Turn Banner:** Positioned directly above the game board. Formatted as an active pill card with:
  - Left: Player avatar chip + Turn status (`"Daniel's Turn · 42 to win"`).
  - Right: Chronograph countdown pill (`"⏱ 0:28"`).
  - Background dynamically shifts to the active player's theme color (Mint for Daniel, Yellow for Sarah).

---

### 2.6 Outer Game Shell Chrome (Outer Body Only)

This encapsulates the visual shell *around* any active game. No inner game rules, piece grids, or board mechanics are styled here:

```
┌─────────────────────────────────────────────────────────────┐
│ (← Games)        Connect Four ✦          (Sarah 🟢 24ms)   │ <- Top Bar
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✦ Turn 14 · Connect 4 Discs              ⏱ 0:24        │ │ <- Stage Header
│ │                                                         │ │
│ │                  [ UNTOUCHED GAME BOARD ]               │ │ <- Porcelain Stage
│ │                                                         │ │
│ │ Daniel: 2 wins · Sarah: 1 win                           │ │ <- Score Sub-Strip
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │               [ DROP DISC IN COL 4 → ]                  │ │ <- 52px Black Pill
│ └─────────────────────────────────────────────────────────┘ │
│      ( [ Offer Draw ] )               ( [ Game Options ] )  │ <- Utility Pills
└─────────────────────────────────────────────────────────────┘
```

- **Top Bar:** Fixed height `56px`. Contains back pill (`[ ← GAMES ]`, height: `36px`, hairline border), center condensed grotesque title in all-caps (`CONNECT FOUR`), and right presence capsule with partner status dot and network ping (`[ SARAH 🟢 24MS ]`).
- **Outer Stage Container:** Outer margin: `16px`; Radius: `rounded-[32px]`; Background: porcelain white or slate dark; hairline border ring (`rgba(255,255,255,0.08)`).
- **Bottom Thumb Zone:** Dominant 52px full-width solid pill button for the single primary game action (e.g. `[ DROP DISC IN COL 4 → ]`, `[ ROLL DICE 🎲 ]`). Below it, two secondary translucent pill capsules for game options and draw offers (`[ OFFER DRAW ]`, `[ OPTIONS ]`).
- **Bottom Dock Suppression:** Global bottom navigation dock (`[ HOME ] [ GAMES ] [ US ]`) is **strictly suppressed / hidden** across all game views.

---

### 2.7 Full-Bleed Horizontal Card Carousel

- **Container:** Horizontally scrollable container with `-webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; padding: 0 20px;`.
- **Card Geometry:** Width: `min(calc(100vw - 64px), 340px)`; Radius: `rounded-[32px]`; Padding: `24px` to `28px`.
- **Visual Stacking:** Subtle peeking edges of adjacent cards on left and right (`scale: 0.94`, `opacity: 0.65`) providing natural tactile affordance without cluttering the screen.
- **Card Anatomy:**
  - Micro-header with game category eyebrow + active citrus-orange wager pill (*"ICED MATCHA WAGER"*).
  - Main hero title in "THE EVOLUTION" condensed grotesque all-caps (`LUDO DUEL`).
  - Acid-lime speech bubble with directional tail (*"Sarah: Rolled a 6! Heading for your home lane! 🎲"*).
  - Dominant solid pill action button (`[ JUMP IN · RESUME → ]`).

---

### 2.8 Desktop Landscape (1280×800) Bento Grid Shell

- **Floating Glassmorphic Top Bar:** Centered pill bar (`height: 56px`, `backdrop-filter: blur(20px)`) containing brand mark in condensed grotesque all-caps (`PRIVATE ARCADE`), segmented navigation pills (`[ HOME ] [ GAMES ] [ US ]`), and partner presence capsule.
- **Two-Column Bento Grid Layout:**
  - **Left Hero Column (7 cols):** Full-bleed hero carousel showcasing active duels, large game thumbnail art, and direct resume triggers.
  - **Right Pillar Column (5 cols):** Vertical stack containing:
    1. Shared Momentum & Streak card featuring giant ultra-light numeral (`14 DAYS`) and dual Daniel vs Sarah progress meters.
    2. Quick Launch Vault with squircle game shortcuts and instant invite buttons.
- **Breathing Room:** Minimum outer page padding `48px`; column gutter `24px`. No element stretches to an unreadable width.

---

### 2.9 Playful Conversational Speech Bubble (`playful-accent` motif)

- **Purpose:** Carries live partner move alerts, conversational commentary, and friendly banter without cluttering gameplay.
- **Geometry:** Rounded squircle enclosure (`rounded-2xl` / `16px`), padding `12px 16px`, with a 45-degree directional pointer tail.
- **Styling:** Fill: `var(--pa-accent-lime)` (`#D4FE00`); Ink: `var(--pa-accent-lime-ink)` (`#0D0D0D`); 1.5px solid border (`#000000`); tactile comic-style offset shadow (`0 2px 0 #000000`).
- **Typography:** Sentence case in `var(--pa-font-body)` (*Plus Jakarta Sans* / *Hanken Grotesk*), accompanied by tiny emoji or avatar icon.
- **Strict Boundary:** Never used for headings, primary buttons, or navigation tabs.

---

### 2.10 Tactile Scalloped Wager & Milestone Badge (`playful-accent` motif)

- **Purpose:** Highlights high-stakes rituals, wager bets (*`ICED MATCHA WAGER`*), and duo records (*`TOP 2% COUPLE`*).
- **Geometry:** Serrated / scalloped starburst or capsule geometry with tooth count 12–16, or capsule pill with distinct playful accent.
- **Styling:** Fill: `var(--pa-accent-orange)` (`#FF6B00`); Ink: `#FFFFFF`; subtle drop shadow `0 2px 8px rgba(255, 107, 0, 0.3)`.
- **Typography:** Tracked uppercase (`var(--pa-font-functional)`, 11px, bold, `+0.08em` tracking).
