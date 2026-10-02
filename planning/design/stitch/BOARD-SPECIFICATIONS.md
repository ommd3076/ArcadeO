# Private Arcade — Board Artwork, Geometry & SVG Requirements

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/BOARD-SPECIFICATIONS.md`  
**Purpose:** Technical brief for subsequent game frontend implementation. Does not modify application code.  

---

## 1. Universal Board Container Principles

1. **Aspect Ratio & Centering:** All board games must be contained in a dedicated, square or mathematically proportional container (`aspect-ratio: 1/1` for Ludo, Sudoku, Dots & Boxes; `7/6` for Connect Four; `10/10` for Snakes & Ladders).
2. **Touch Target Resolution on Mobile Viewports:** On standard mobile screens (320px–390px width), individual cells on dense grids (15x15 Ludo, 10x10 Snakes & Ladders) are smaller than the standard 44px touch target. The design specification **strictly resolves this via dedicated sub-board action decks** (e.g. four large token buttons for Ludo, large Roll Dice CTA for Snakes) rather than forcing players to tap microscopic cells.
3. **SVG Vector Scalability:** All boards must be implemented via scalable SVG with responsive `viewBox` coordinates to guarantee pixel-crisp rendering on 1x, 2x, and 3x Retina displays.

---

## 2. Individual Game Specifications

### 2.1 Ludo (Classic 15x15 Geometry)
- **Stitch Reference Screen:** `1931ae8607c74c0daedce96cb1c472ee`
- **Grid Matrix:** Exact 15x15 coordinate system ($x: 0\dots 14, y: 0\dots 14$).
- **Yards (Corners):** 4 distinct 6x6 square quadrants:
  - Top-Left (Yellow Yard): `x: 0..5, y: 0..5`
  - Top-Right (Blue Yard): `x: 9..14, y: 0..5`
  - Bottom-Left (Red Yard): `x: 0..5, y: 9..14`
  - Bottom-Right (Green Yard): `x: 9..14, y: 9..14`
  - Each yard features 4 circular pawn resting slots with subtle inset depth.
- **Cross Arms & Home Paths:** 3 cells wide and 6 cells long along the north, south, east, and west axes. Center column of each arm contains the tinted colored home path leading into the center.
- **Safe Spaces:** Exactly 8 safe spaces marked with crisp 5-point vector stars (⭐):
  - 4 starting track cells (e.g. Red start at `[1, 6]`, Green start at `[8, 13]`, etc.).
  - 4 milestone safe cells located 8 steps from each starting point.
- **Center Goal:** Triangular triumph zone converging into the center 3x3 square (`x: 6..8, y: 6..8`), split into 4 colored triangles.
- **Sub-Board Thumb Deck (Ergonomics):** A horizontal tray of 4 dedicated cards below the board representing the active player's 4 tokens:
  - Card 1: Token in Yard (disabled if die $\neq 6$; active with pulse when die $= 6$).
  - Cards 2–4: Tokens in Play (displays current tile index, target tile on advance, and safety status e.g. *"Tile 24 → 30 (Safe Star ⭐)"*).

---

### 2.2 Snakes & Ladders (10x10 Serpentine Grid)
- **Stitch Reference Screen:** `84209fc1bb144c2a914af6bc4c1161a4`
- **Grid Matrix:** 10 rows $\times$ 10 columns (100 total squares).
- **Serpentine Numbering Algorithm:**
  ```typescript
  // Given tile index T (1..100):
  const rowFromBottom = Math.floor((T - 1) / 10); // 0..9 (Row 0 is 1..10)
  const isEvenRow = rowFromBottom % 2 === 0;
  const colIndex = isEvenRow ? (T - 1) % 10 : 9 - ((T - 1) % 10);
  const rowIndex = 9 - rowFromBottom; // SVG y-coordinate from top
  ```
- **Illustrated Wooden Ladders:** Rendered with dual vertical rails in warm timber tone (`#C28E58`) and realistic horizontal cross rungs spaced at regular intervals. Start square highlighted with emerald climb arrow.
  - Required ladder links: `4 → 14`, `9 → 31`, `20 → 38`, `28 → 84`, `40 → 59`, `51 → 67`, `63 → 81`, `71 → 91`.
- **Illustrated Danger Snakes:** Rendered with sinuous bezier curves, patterned scales, and expressive triangular danger heads facing the destination tail square. Danger square highlighted with coral alert badge (`#FF7A7A`).
  - Required snake links: `16 → 6`, `47 → 26`, `49 → 11`, `56 → 53`, `62 → 19`, `64 → 60`, `87 → 24`, `93 → 73`, `95 → 75`, `98 → 78`.
- **Dice Station:** Large 3D tactile dice rolling station at bottom with physical face preview and rolling physics.

---

### 2.3 Connect Four (7x6 Matrix)
- **Stitch Reference Screen:** `1b3d2a3bb28e4619a1797f07cd01070a`
- **Grid Matrix:** 7 columns $\times$ 6 rows.
- **Physical Board Housing:** Deep blue-charcoal housing (`#1B2236`) with circular cutouts revealing the dark backplate. Cutouts have a 1.5px inner shadow to simulate physical plastic slots.
- **Player Discs:** High-contrast glossy discs with concentric rim grooves:
  - Player A (Daniel): Sunburst Yellow (`#F4DE88`) or Mint (`#CFE6A3`).
  - Player B (Sarah): Crimson Coral (`#E74C3C`) or Berry (`#9A305E`).
- **Drop Control Deck:** 7 dedicated circular buttons (C1 to C7) directly below each column.
  - Active button displays remaining slot count (e.g. `"3 left"`).
  - Filled column is disabled with a muted `"FULL"` label.

---

### 2.4 Sudoku (9x9 Grid & Keypad)
- **Stitch Reference Screen:** `1a9a25c9d2354d0e93f4f44a30f783cd`
- **Grid Matrix:** 9x9 cells divided into nine 3x3 blocks.
- **Dividers:**
  - Block Dividers: 2px solid white (`rgba(255,255,255,0.24)`).
  - Internal Cell Dividers: 1px hairline (`rgba(255,255,255,0.07)`).
- **Candidate Notes Micro-Grid:** Empty cells support a nested 3x3 sub-grid displaying pencil notes 1 through 9 in 9px muted font.
- **Focus Highlighting:**
  - Selected cell has a 2px solid Mint border with soft glow.
  - Associated row, column, and 3x3 block are tinted with `rgba(207,230,163,0.06)`.
  - All matching digits on the board are highlighted with an amber ring.
- **Keypad:** 9 tactile digit keys (1–9) with remaining placement counters underneath (`"Done ✓"`, `"2 left"`).

---

### 2.5 Dots & Boxes (Grid of Dots)
- **Grid:** 5x5 or 6x6 dots forming a grid of square boxes.
- **Edge Hit Area:** Hit areas for vertical and horizontal lines must expand to at least 24px width/height around the 3px line to guarantee effortless touch selection.
- **Box Capture:** Claimed boxes display the owner’s monogram ('D' or 'S') on an illuminated translucent pastel fill.

---

### 2.6 SOS (Grid & Strike Lines)
- **Grid:** 5x5 to 8x8 square cells with high-contrast letters ('S' or 'O').
- **Strike Line:** Completed S-O-S sequences are struck through with an animated vector line colored in the scoring player's theme accent, with celebratory point pill animation.

---

### 2.7 Rock Paper Scissors (Secret Duel Cards)
- **Stitch Reference Screens:** `7eed8bce7ac64557a44f21d4ddad8983` (Handoff) & `ee590de9e93c45e1a27071800394baa1` (Reveal).
- **Cards:** Physical playing-card proportions (`aspect-ratio: 2.5/3.5`).
- **Assets:** Custom tactile 3D illustrations for Rock (mineral stone), Paper (folded scroll), and Scissors (craft shears).
- **Clash Animation:** Synchronized card flip followed by an energetic clash pulse at the center node.

---

### 2.8 Hand Cricket (Batting & Bowling Deck)
- **Arena:** Pitch graphic displaying current innings, target score, runs scored, and wickets lost (out of 1).
- **Input Deck:** 6 circular buttons numbered 1 through 6 for run selection, protected by the same Secret Handoff privacy shield in Together mode.
