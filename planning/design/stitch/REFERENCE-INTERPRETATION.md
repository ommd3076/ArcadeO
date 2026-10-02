# Private Arcade — Reference Interpretation & Visual Synthesis

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/REFERENCE-INTERPRETATION.md`  
**Target Applications:** Mobile Portrait (320px, 390px, 430px) & Adaptive Desktop  
**Design Project:** `projects/9099986947047806544` (*Nocturne Duo Arcade*)  
**Design System Asset:** `assets/0fb48a45937f4aa7a98ce72c8c4231ee`  

---

## 1. Executive Summary & Purpose

This document provides the foundational design interpretation for **Private Arcade**, translating reference art, visual research, and product constraints into a coherent design language. Private Arcade is an intimate, dedicated two-player digital salon built exclusively for two named users (**Daniel** and **Sarah**), supporting eight classic games (Ludo, Sudoku, Dots & Boxes, Rock Paper Scissors, Hand Cricket, SOS, Connect Four, and Snakes & Ladders).

This task is purely a **design and visual synthesis engagement**. In strict compliance with repository instructions, no application code (`src/`), game engines (`shared/games/`), backend workers (`worker/`), or migrations (`migrations/`) have been touched.

---

## 2. Comprehensive Analysis of Reference Imagery

### 2.1 The Bright / Light Direction: `assets/ui-references/tennis-surfaces.png`

The tennis reference establishes a vibrant, tactile, and highly physical visual vocabulary. Rather than sterile corporate flat design, it creates depth, optimism, and immediate tangibility:

| Visual Dimension | Reference Feature (`tennis-surfaces.png`) | Interpretation for Private Arcade (Light Mode) |
| :--- | :--- | :--- |
| **Canvas & Surfaces** | Soft porcelain white base with gentle tinted cards and warm off-white containers. | **Porcelain Light Canvas (`#F7F7F8`)** paired with crisp pure white card surfaces (`#FFFFFF`) framed by delicate hairlines (`rgba(0,0,0,0.06)`). |
| **Accent Hierarchy** | High-energy lime/mint court tones, energetic ball accents, and confident contrast. | **Signature Hero Mint (`#CFE6A3`)** and **Warm Yellow (`#F4DE88`)** applied to prominent action cards and active turn highlights. |
| **Physical Geometry** | Large, unmistakable game objects (tennis balls, racquets, courts) with realistic materials and soft shadows. | Large, recognizable game pieces (tactile 3D dice, wooden ladder rails, slotted Connect-4 discs, physical game cards). |
| **Breathing Room** | Generous 20–24px internal card padding, spacious touch targets, and rhythmic negative space. | Uncluttered 16–20px margins, 48px minimum touch heights, and strict hierarchical separation between cards. |
| **Corner Curvature** | Deep, concentric rounded corners (`rounded-2xl`, `rounded-full`). | Strict **Concentric Radii System**: 24px container $\rightarrow$ 16px nested card $\rightarrow$ 9999px pill buttons. |
| **Dominant Action** | High-contrast, full-width pill button that unambiguously anchors the bottom thumb zone. | Hero Mint and Solid Charcoal pill CTAs with 9999px radius and tactile scale feedback on press. |
| **What We Borrow** | Tactile material cues, high-contrast action pills, generous negative space, optimistic freshness. | Visual hierarchy, nested elevation, cheerful intimacy. |
| **What We Reject** | Commercial stores, avatar gacha, randomized matchmaking, photo uploads, onboarding carousels. | Private Arcade is an ad-free, two-account private sanctuary without monetization clutter. |

---

### 2.2 The Dark / Nocturnal Direction: `tracker-overview.png`, `tracker-detail.png`, `tracker-components.png`

The habit-tracker references represent a masterclass in modern dark editorial design. They demonstrate that dark mode must never be a monotonous field of flat dark gray boxes:

| Visual Dimension | Reference Feature (`tracker-*.png`) | Interpretation for Private Arcade (Dark Mode) |
| :--- | :--- | :--- |
| **Framing & Canvas** | Deep velvety charcoal/near-black background (`#0C0C0F` / `#131316`) acting as a nocturnal stage. | **Charcoal Base (`#0C0C0F`)** paired with stratified elevated containers (`#16161B`, `#1F1F26`). |
| **Color Punch** | Luminous mint, cyan, and warm yellow index cards with high-contrast dark text. | **Pastel Index Decks**: Mint (`#CFE6A3`), Warm Yellow (`#F4DE88`), Cyan (`#A8DFE4`), each using dark ink typography (`#1D2915`, `#2E2305`, `#11292B`) guaranteeing $>8:1$ contrast. |
| **Typography Tension** | Oversized, relatively lightweight display numerals (chronograph-style) paired with refined micro-labels. | **Plus Jakarta Sans** weight pairings: Light (`300`) stat counters + SemiBold (`600`) anchors + tracked uppercase micro-labels (`label-micro`, `0.1em` letter spacing). |
| **Card Proportions** | Asymmetrical bento grid: wide hero cards, 2-column partner stat splits, compact pill strips. | Variable card rhythm: large Continue card, dual Daniel vs Sarah tracker split, full-width turn callout. |
| **Controls & Navigation** | Floating rounded pill navigation dock, circular tactile icon buttons, segmented mode switches. | **Floating Pill Dock (`rgba(22,22,27,0.85)` + 20px blur)** with 44px circular tap targets and active capsule badges. |
| **What We Borrow** | Editorial card hierarchy, nocturnal warmth, pastel paper cards on night canvas, chronograph counters. | Quiet intimacy, ritualistic record tracking, conspiratorial dual-player ambiance. |
| **What We Reject** | Medical checklists, generic fitness telemetry, clinical graphs. | Adapted directly to game scorebooks, move tickers, turn clocks, and shared duel records. |

---

### 2.3 Diagnostic Critique of Legacy Evidence (`tests/e2e/evidence`)

Prior diagnostic screenshots from the end-to-end test suite revealed severe visual deficits that this design exploration resolves:

1. **Monotonous Gray Grids:** Legacy screens rendered games inside undifferentiated flat gray `#222` containers with indistinguishable borders. The new system introduces tonal stratification (`#0C0C0F` canvas, `#16161B` cards, `#1F1F26` interactive layers) and crisp hairline borders (`rgba(255,255,255,0.08)`).
2. **Tiny, Low-Contrast Board Cells:** Games like Ludo and Snakes & Ladders were previously depicted as microscopic, unstyled table cells impossible to touch reliably on mobile. The new design introduces **dedicated thumb control zones** (e.g. 4 distinct token action cards for Ludo, large 3D Roll Dice pill for Snakes & Ladders) and authentic illustrated board anatomy.
3. **Tab Dock Intrusion in Gameplay:** In earlier iterations, the global bottom navigation tabs remained visible during intense gameplay, cluttering the viewport and causing accidental exits. The new contract strictly **hides all shell tabs during gameplay and game setup**, dedicating 100% of the viewport to the game board and thumb controls.
4. **Generic Dashboard Typography:** Earlier screens used uniform medium bold sans-serif across all labels, creating visual fatigue. The new system establishes a nuanced scale pairing delicate chronograph scores with crisp uppercase category badges.

---

## 3. The Four Theme System

To honor both users and provide aesthetic flexibility across lighting environments, the design system defines four distinct, fully realized themes:

```
                         ┌────────────────────────────────────────┐
                         │       PRIVATE ARCADE THEME SYSTEM      │
                         └────────────────────────────────────────┘
                                      │              │
                    ┌─────────────────┘              └─────────────────┐
                    ▼                                                  ▼
     ┌─────────────────────────────┐                    ┌─────────────────────────────┐
     │        STANDARD DUO         │                    │        ROMANTIC DUO         │
     │   (Mint · Cyan · Yellow)    │                    │       (Lilac · Berry)       │
     └─────────────────────────────┘                    └─────────────────────────────┘
          │                   │                              │                   │
          ▼                   ▼                              ▼                   ▼
    ┌───────────┐       ┌───────────┐                  ┌───────────┐       ┌───────────┐
    │   DARK    │       │   LIGHT   │                  │   DARK    │       │   LIGHT   │
    │ (Nocturne)│       │(Porcelain)│                  │(Aubergine)│       │  (Blush)  │
    └───────────┘       └───────────┘                  └───────────┘       └───────────┘
```

1. **Standard Dark (Nocturne Duo):** Charcoal `#0C0C0F` canvas, Mint `#CFE6A3`, Cyan `#A8DFE4`, Warm Yellow `#F4DE88`. The primary nocturnal experience.
2. **Standard Light (Porcelain Day):** Crisp white `#F7F7F8` canvas, pristine porcelain `#FFFFFF` cards, fresh mint `#CFE6A3` hero callouts with solid charcoal `#121216` typography.
3. **Romantic Dark (Aubergine Velvet):** Deep plum `#120C1C` canvas, velvety containers `#1D142A`, luminous lilac `#C9A7FF` and deep berry `#9A305E` accents.
4. **Romantic Light (Blush Rose):** Soft blush `#FFF5F8` canvas, warm rose cream `#FFE5EE` surfaces, rich berry ink `#301A2C` typography, and radiant ruby highlights.

All four themes share identical component anatomy, concentric corner radii, and spacing tokens, guaranteeing complete functional interchangeability without layout shifts.
