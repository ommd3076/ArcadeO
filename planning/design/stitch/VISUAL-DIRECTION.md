# Private Arcade — Visual Direction & 60-30-10 Typography System

**Document Status:** Approved Design Artifact (Post-Grill Refinement)  
**Location:** `planning/design/stitch/VISUAL-DIRECTION.md`  
**Design Project:** `projects/9099986947047806544` (*Private Arcade Duo*)  
**Design System Asset:** `assets/190075a88545430089f319180acfec77` / `assets/0fb48a45937f4aa7a98ce72c8c4231ee`  

---

## 1. Creative North Star: "Intimate Tactile iOS Squircles"

Following our in-depth design interview (`/grill-me`), the visual identity for Private Arcade shifts decisively away from dense, cluttered dashboard mockups and into an **airy, tactile, iOS squircle sanctuary**:

1. **Massive Breathing Room & Zero Clutter:** Replaces dense tables, micro-telemetry cards, and walls of badges with generous vertical rhythm, expansive padding (`24px`–`32px` inside cards), and clear visual focus on at most 2–3 bold components per screen.
2. **iOS Continuous Squircle Curvature (`rounded-[32px]`):** Strict enforcement of Apple-style continuous curvature. Containers use `32px` corner radii, nested components step down to `20px` or `16px`, and interactive controls utilize fully circular capsules (`rounded-full`, `9999px`).
3. **Outer Body Focus:** Chrome and navigation are designed purely around the game experience. When a game is active, the game board sits inside an uncluttered porcelain stage, bottom tabs disappear entirely, and a single dominant tactile action pill anchors the thumb reach zone.

---

## 2. The Typographic Hierarchy & "THE EVOLUTION" Condensed Type

Following our review, Private Arcade enforces a bold, high-contrast, and clean typographic system that completely removes decorative brush scripts in favor of architectural, high-impact condensed grotesque letterforms paired with warm conversational reading:

```
┌────────────────────────────────────────────────────────────────────────┐
│               PRIVATE ARCADE TYPOGRAPHIC SYSTEM                        │
├───────────────────┬───────────────────┬────────────────────────────────┤
│ MAIN HEADINGS     │ 60% DOMINANT      │ 30% FUNCTIONAL / CONTROLS      │
│ "THE EVOLUTION"   │ Body / Reading    │ "THE EVOLUTION" ALL CAPS       │
│ Condensed Grotesk │ (Warm Modern Sans)│ Buttons / Pills / Badges / HUD │
├───────────────────┼───────────────────┼────────────────────────────────┤
│ • Barlow Condensed│ • Plus Jakarta S. │ • Barlow Condensed / Antonio   │
│ • Antonio / DIN   │ • Hanken Grotesk  │ • ALL CAPS (`uppercase`)       │
│ • ALL CAPS        │ • Sentence case   │ • Wide tracking (+0.08em)      │
│ • `PRIVATE ARCADE`│ • "Sarah just     │ • `[ JUMP IN · RESUME → ]`     │
│ • `LUDO DUEL`     │    rolled a 5..." │ • `[ CLASSIC DUEL · LIVE ]`    │
│ • `CONNECT FOUR`  │ • Clean, intimate │ • `[ SARAH 🟢 24MS ]`          │
│ • `EYES CLOSED`   │    conversational │ • `[ DROP DISC IN COL 4 → ]`   │
│ • High impact     │    dialogue       │ • `[ HOME ] [ GAMES ] [ US ]`  │
└───────────────────┴───────────────────┴────────────────────────────────┘
```

### 2.1 Main Headings: "THE EVOLUTION" Condensed Grotesque (All Caps)
- **Role:** High-impact, architectural display titles anchoring the top bar, active card headers, and mode screens. Directly derived from the user-supplied *"THE EVOLUTION"* typography reference.
- **Font Candidates:** *Barlow Condensed Bold*, *Antonio Bold*, *DIN 1451 Engschrift*, *Bebas Neue*.
- **Style Rules:** Strictly **ALL CAPS (`uppercase`)**, bold weight (`700`), tight vertical line-height (`leading-none`), and subtle positive tracking (`+0.02em`).
- **Strict Prohibition:** **ZERO cursive, handwriting, or brush script fonts** anywhere in the system.

### 2.2 60% Dominant Reading Font (Warm Modern Sans)
- **Role:** Delivers clean, conversational geometry and effortless readability for partner greetings, move notifications, and game instructions.
- **Font Candidates:** *Plus Jakarta Sans*, *Inter*, *Hanken Grotesk*.
- **Style Rules:** Regular (`400`) and Medium (`500`) weights with natural letterforms and friendly sentence-case phrasing (e.g. *"Sarah just rolled a 5 and entered your home stretch"*).

### 2.3 30% Functional Controls & Data ("THE EVOLUTION" All Caps)
- **Role:** Technical structure for buttons, compact segmented pills, status chips, timers, and telemetry badges.
- **Font Candidates:** *Barlow Condensed*, *Antonio*, *DIN Condensed*.
- **Style Rules:** Strictly **ALL CAPS (`text-transform: uppercase`)** with expanded letter spacing (`tracking-wider`, `+0.06em` to `+0.1em`). Numerical readouts use tabular figures (`tabular-nums`).

---

## 3. Playful Accent Integration (from `playful-accent.png`)

To infuse tactile arcade energy and playful warmth without compromising typographical clarity, the design system integrates key visual motifs from the `playful-accent.png` reference:

1. **Acid-Lime (`#D4FE00`) Conversational Speech Bubbles:**
   - Rounded squircle chat bubbles featuring a custom 45-degree directional speech tail.
   - Carries partner move notifications, live reactions, and banter (e.g. *"Sarah: Watch out for Column 4! 😏"*).
   - High-contrast black ink typography with a subtle solid comic-style offset shadow (`0 2px 0 #000000`).
2. **Citrus-Orange (`#FF6B00`) Scalloped Starburst Badges:**
   - Tactile serrated pill stickers used for high-stakes rituals, wager bets (*`ICED MATCHA WAGER`*), and milestone achievements (*`TOP 2% COUPLE`*).
3. **Tactile 3D Micro-Pieces & Trophies:**
   - Realistic dimensional game elements: 3D five-dot dice cubes with rounded bevels, glowing emerald and golden player tokens with top specular rims, and mini gold trophy cups.
4. **Strict Architectural Boundary:**
   - **Playful accents are applied strictly to conversational bubbles, wager stakes, and micro-interactions—NEVER to main headings or functional navigation labels.** Headings and labels remain disciplined, crisp, and high-contrast.

## 3. Outer Shell Architecture & Card Rhythm

### 3.1 Home Screen: Full-Bleed Horizontal Card Carousel
- **Hero Carousel:** A horizontal deck of oversized `rounded-[32px]` squircle cards showcasing active duels and invitations.
- **Layered Spatial Depth:** Cards subtly peek at the left and right edges (e.g. *Sudoku Duel* peeking behind *Ludo Duel*), replicating the tactile card stack from the tennis court reference without introducing vertical clutter.
- **Dominant Call-to-Action:** Each card contains a high-contrast, full-width solid pill button (`Jump In · Resume →`), providing an immediate, unambiguous touch target.

### 3.2 Duo Momentum Card
- Sits below the carousel with clean 20px spacing.
- Pairs conversational couple encouragement on the left with a giant, ultra-light chronograph numeral (`14 DAYS`) on the right.

### 3.3 Minimal Floating Island Navigation Dock
- Centered floating capsule (`rounded-full`) anchored above the iOS home indicator bar with acrylic backdrop blur (`backdrop-filter: blur(20px)`).
- Contains exactly three minimal icon destinations: `Home` (active solid pill badge), `Games`, and `Us`.
- **STRICT SHELL RULE:** The dock is **100% hidden** during active gameplay and game setup screens.

---

## 4. Outer Game Shell Chrome (When Game is Active)

In accordance with user direction (*"dont design the inner games just the out body and everything around it"*), the in-game experience is defined by minimalist outer chrome:

```
┌─────────────────────────────────────────────────────────────┐
│  ( ← GAMES )             CONNECT FOUR            (Sarah 🟢) │ <- Top Bar
│                     MATCH 3 OF 5 · DUO AXIS                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  ● YOUR TURN · DANIEL                      ⏱ 0:24   │   │ <- Stage Header
│   │                                                     │   │
│   │                                                     │   │
│   │              [ CLEAN GAME STAGE ]                   │   │ <- rounded-[32px]
│   │                                                     │   │
│   │  DANIEL 2          [ MATCH POINT ]         1 SARAH  │   │ <- Score Sub-strip
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│       (       [ ⚡ DROP DISC IN COL 4 → ]       )           │ <- Primary Action Pill
│              ( 🤝 OFFER DRAW )   ( ⋯ OPTIONS )               │ <- Secondary Pills
└─────────────────────────────────────────────────────────────┘
```

1. **Top Bar:** Tactile frosted `[ ← GAMES ]` pill on the left, condensed grotesque heading `CONNECT FOUR` in the center, and partner presence chip on the right.
2. **Outer Stage Container:** A generous `rounded-[32px]` porcelain card housing the board viewport with 24px padding, clean turn status, and live match point score bar.
3. **Bottom Thumb Zone:** Dominant high-contrast primary action pill (52px height) seated in the natural thumb arc, with secondary utilities (`[ OFFER DRAW ]`, `[ OPTIONS ]`) presented as soft hairline pills.
4. **No Shell Tabs:** Zero interference from the global bottom navigation dock during play.

---

## 5. Responsive Adaptation: Compact Desktop & Tablet (1280×800)

On wider viewports, Private Arcade expands gracefully without losing its intimate tactile character:
1. **Top Floating Island Header:** Expands to a centered `max-w-5xl` glassmorphic capsule with brand title on the left, segmented navigation pills in the center, and partner presence on the right.
2. **2-Column Body Layout:**
   - **Left Column (7 cols):** Full-bleed hero duel carousel adapted for landscape width, featuring the active turn card and tactile resume CTA.
   - **Right Column (5 cols):** Vertical stack containing the Duo Shared Streak card (with weekly checkmark track) and the Quick Launch Vault card (with 1-tap duel invite pills).
3. **Maintained Squircle Geometry:** Cards retain their deep continuous `rounded-[32px]` corners and generous internal padding.

---

## 6. The Complete Four-Theme Palette Matrix

Private Arcade supports two distinct emotional modes across light and dark viewports:

| Visual Attribute | Standard Light (Porcelain Kinetic) | Standard Dark (Nocturne Kinetic) | Romantic Dark (Aubergine Velvet) | Romantic Light (Blush Rose) |
| :--------------- | :--------------------------------- | :------------------------------- | :------------------------------- | :-------------------------- |
| **Canvas Base** | `#F7F7F8` (Porcelain) | `#0C0C0F` (Charcoal Void) | `#120C1C` (Aubergine Plum) | `#FFF5F8` (Blush Porcelain) |
| **Elevated Cards** | `#FFFFFF` (Pure White) | `#16161B` & `#1F1F26` (Obsidian) | `#1D142A` & `#281C38` (Velvet) | `#FFE5EE` & `#FFFFFF` (Rose Cream) |
| **Hairline Borders**| `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.08)` | `rgba(201, 167, 255, 0.14)` | `rgba(154, 48, 94, 0.12)` |
| **Headings & Badges** | `Barlow Condensed` ALL CAPS (`#0D0D0D`) | `Barlow Condensed` ALL CAPS (`#F4F4F6`) | `Barlow Condensed` ALL CAPS (`#FDF8FF`) | `Barlow Condensed` ALL CAPS (`#301A2C`) |
| **Banter Speech Bubble**| `#D4FE00` (Acid-Lime / Ink `#0D0D0D`) | `#D4FE00` (Acid-Lime / Ink `#0D0D0D`) | `#C9A7FF` (Luminous Lilac / Ink `#241135`) | `#E91E63` (Raspberry / Ink `#FFFFFF`) |
| **Wager Badge** | `#FF6B00` (Citrus Orange) | `#FF6B00` (Citrus Orange) | `#F4DE88` (Champagne Gold) | `#F7DE98` (Warm Champagne) |
| **Primary Pill CTA** | `#0D0D0D` (Solid Carbon / Text `#FFF`) | `#D4FE00` or `#FFFFFF` (Solid Ink `#0D0D0D`) | `#C9A7FF` (Lilac / Ink `#241135`) | `#301A2C` (Deep Berry / Text `#FFF`) |

---

## 7. Vector Iconography Standard: Lucide & Phosphor

- **Production-Grade Vector Standard:** Replaces all placeholder or generic icon artwork with precision vector glyphs from **Lucide Icons** (`lucide-react`) and **Phosphor Icons**.
- **Geometry & Consistency:** All icons operate on a standardized 24×24dp bounding frame with a uniform `2px` stroke weight, rounded caps (`stroke-linecap="round"`), and rounded joins (`stroke-linejoin="round"`).
- **Core Glyph Roles:**
  - `Sparkles`: Brand masthead badge next to `PRIVATE ARCADE`.
  - `Radio` / `Wifi`: Live peer latency and Cloudflare DO consensus indicators.
  - `Flame` & `Trophy`: Duo streaks, momentum milestones, and top 2% couple ranking.
  - `Coffee` & `Gift`: Custom friendly wager cards (`ICED MATCHA WAGER`).
  - `Dice5`: 3D tactile dice roll result and movement steps.
  - `Home`, `Gamepad2`, `Heart`: Fixed floating navigation dock destinations.
  - `Lock` & `ShieldCheck`: Secret handoff veil and Together mode anti-peeking shield.
