# Private Arcade — Reference Comparison & Critical Analysis

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/REFERENCE-COMPARISON.md`  
**Reference Assets:** `assets/ui-references/`  
**Generated Screen Corpus:** `planning/design/stitch/evidence/`  

---

## 1. Overview & Comparative Framework

This document conducts a side-by-side critical evaluation between the reference materials provided in the repository and the final generated Stitch screens for Private Arcade. It examines what was adopted, what was adapted to the two-player game domain, and what was intentionally rejected to preserve product integrity.

---

## 2. Comparative Matrix: Private Arcade vs. Reference Corpus

### 2.1 The Bright / Light Direction: `tennis-surfaces.png`

| Feature / Trait | Reference Design (`tennis-surfaces.png`) | Private Arcade Light Mode (`07ef6400eb28...`) | Evaluation & Resolution |
| :--- | :--- | :--- | :--- |
| **Canvas Material** | Creamy porcelain off-white with warm ambient tint. | Porcelain Light `#F7F7F8` base with pure white `#FFFFFF` card layers. | **Full Alignment.** Matches the clean, non-sterile warmth of the court reference. |
| **Accent Hue** | Electric tennis lime (`#D4EB52`) and fresh court green. | Hero Mint (`#CFE6A3`) paired with Deep Ink Forest (`#1D2915`). | **Enhanced Accessibility.** Preserves the vibrant energy of lime while guaranteeing $>9:1$ text contrast. |
| **Action Treatment** | Oversized, confident pill-shaped primary action buttons. | 9999px full-width pill CTAs (`#0C0C0F` in Light Mode, `#CFE6A3` in Dark Mode). | **Full Alignment.** Dominates the thumb zone and provides unambiguous affordance. |
| **Depth Strategy** | Soft, directional surface depth with subtle realistic bevels. | Flat tactile index cards with crisp 1px hairline border rings (`rgba(0,0,0,0.06)`). | **Intentional Optimization.** Avoids heavy blur rendering on mobile web while preserving clean tactile stratification. |
| **Domain Content** | Equipment stores, tennis racquet collections, tournaments. | Eight classic turn-based and synchronized games. | **Intentional Deviation.** Replaced commercial gaming clutter with intimate two-player salon rituals. |

---

### 2.2 The Dark / Nocturnal Direction: `tracker-*.png`

| Feature / Trait | Reference Design (`tracker-overview/detail/components.png`) | Private Arcade Dark Mode (`db22d7fc...`, `60e18ca...`) | Evaluation & Resolution |
| :--- | :--- | :--- | :--- |
| **Canvas Void** | Deep pitch-black / charcoal frame (`#0C0C0F`). | Deep Charcoal `#0C0C0F` base, `#16161B` cards, `#1F1F26` raised layers. | **Full Alignment.** Achieves total immersion and reduces battery consumption on OLED displays. |
| **Color Infusion** | Bright mint, cyan, and warm yellow pastel index callouts. | Tri-color pastel decks: Mint (`#CFE6A3`), Warm Yellow (`#F4DE88`), Cyan (`#A8DFE4`). | **Full Alignment.** Solves dark mode monotony by injecting purposeful, readable editorial color. |
| **Card Proportions** | Asymmetrical bento grid: large hero cards + paired split stats. | Asymmetrical bento composition: hero active turn card, paired Daniel/Sarah chronograph split, slim cyan sync strip. | **Full Alignment.** Creates rhythm and guides the user’s eye naturally down the screen. |
| **Typography Scale** | Chronograph numerals in light weights paired with bold anchors. | Plus Jakarta Sans: Light (`300`) stat counters + SemiBold (`600`) anchors + tracked micro-labels (`label-micro`). | **Full Alignment.** Evokes the sophistication of a luxury timepiece or dual journal. |
| **Navigation Dock** | Floating rounded acrylic pill dock with frosted blur. | Centered floating capsule (`rgba(22,22,27,0.85)` + 20px blur) with circular touch icons. | **Full Alignment.** Delivers effortless one-handed thumb navigation across the three shell views. |

---

### 2.3 Classic Board Character: Ludo & Snakes & Ladders

| Feature / Trait | Classic Board Target | Diagnostic Legacy (`tests/e2e/evidence`) | Private Arcade Stitch Deliverable |
| :--- | :--- | :--- | :--- |
| **Ludo Board Anatomy** | Complete 15x15 board with 4 colored yards, cross arms, 8 safe stars, and center triangle. | Flat, undifferentiated dark gray grid with generic circular dots and no yard anatomy. | **Authentic Classic Board:** Complete 15x15 grid with distinct colored yards, cross tracks, safe stars (⭐), and center goal (`1931ae8607c74c0daedce96cb1c472ee`). |
| **Ludo Ergonomics** | Physical finger touch targets. | Tiny 20px unclickable grid cells. | **Sub-Board Action Deck:** 4 dedicated horizontal token cards beneath the board allowing instant one-tap moves. |
| **Snakes & Ladders** | 10x10 serpentine grid with authentic wooden ladders and illustrated danger snakes. | Straight red lines and dashed green lines overlaying generic table cells. | **Authentic Serpentine Grid:** 10x10 grid (1 to 100) with realistic wooden ladder rungs, patterned serpent bodies, danger head markers, and 3D dice station (`84209fc1bb144c2a914af6bc4c1161a4`). |

---

## 3. Remaining Intentional Deviations & Justifications

Every deviation from the reference materials was deliberately made to uphold the product brief and technical requirements:

1. **Absence of E-Commerce / Store Interfaces:** While `tennis-surfaces.png` features equipment purchase cards and gem bundles, Private Arcade strictly rejects commercial microtransactions. The visual quality of the cards is repurposed for **active game invitations**, **daily streak rituals**, and **customization previews**.
2. **Absence of Generic Matchmaking:** Modern mobile games feature endless matchmaking search screens and random opponents. Private Arcade is exclusively engineered for **Daniel and Sarah**. Presence indicators always reflect the partner's live status (`Sarah · Online 🟢`), creating warmth and intimacy.
3. **Shell Dock Concealment in Gameplay:** The habit-tracker keeps the bottom dock persistent across detail views. In Private Arcade, entering a game board **completely dismisses the bottom dock**. This grants the game board maximum vertical viewport space on mobile displays (320px–390px) and eliminates destructive accidental exits during play.
4. **Resilience Telemetry Integration:** Neither reference needed to account for real-time WebSocket disconnections. Private Arcade integrates a **calm session resilience telemetry card** (`741c86cf36194c57907d13cf4d218fda`) to reassure players that their moves are safely stored in Cloudflare Durable Objects.
