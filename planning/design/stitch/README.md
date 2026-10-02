# Private Arcade — Visual Design Exploration & Design System

**Project:** Private Arcade (`projects/9099986947047806544`)  
**Design System Asset:** `assets/190075a88545430089f319180acfec77` / `assets/0fb48a45937f4aa7a98ce72c8c4231ee`  
**Location:** `planning/design/stitch/`  
**Status:** Approved Design Artifacts (Post-Grill iOS Squircle Overhaul)  

---

## 1. Visual North Star: "Porcelain Kinetic" (Evolution Type + Playful Accents)

Following our iterative reviews, the interface unites structural architectural rigor with playful arcade energy:
- **Main Headings in "THE EVOLUTION" Type:** High-impact condensed grotesque typography in bold ALL CAPS (`PRIVATE ARCADE`, `LUDO DUEL`, `CONNECT FOUR`, `EYES CLOSED`). Completely eliminates cursive and brush script.
- **30% Functional Controls in "THE EVOLUTION" All Caps:** Condensed grotesque uppercase with expanded letter-spacing (`+0.08em`) applied to buttons, badges, status chips, pills, and timers (`[ JUMP IN · RESUME → ]`, `[ SARAH 🟢 24MS ]`, `[ DROP DISC IN COL 4 → ]`).
- **60% Conversational Reading:** Warm modern sans (*Plus Jakarta Sans* / *Hanken Grotesk*) in friendly sentence case for partner dialogues and instructions.
- **Playful Accent Integration (from `playful-accent.png`):** Vibrant acid-lime (`#D4FE00`) speech bubbles with directional pointer tails for live move alerts, citrus-orange (`#FF6B00`) scalloped starburst wager badges (`ICED MATCHA WAGER`), and dimensional 3D game dice/tokens. **Strictly applied to conversational bubbles and wager stakes—never to headings or labels.**
- **iOS Continuous Squircles (`rounded-[32px]`):** Apple-style continuous corner curvature with generous `24px`–`32px` internal padding and zero clutter.
- **Full-Bleed Horizontal Carousel:** Swipeable active games deck with tactile peeking cards.
- **Outer-Body-Only Game Shell:** Pristine outer boundary around games (top bar with `← Games` pill, porcelain stage container, 52px thumb action pill) with 100% suppression of the bottom dock and untouched inner boards.
- **Desktop Landscape Adaptation (1280×800):** Centered floating glass top bar with a balanced 2-column bento layout.

---

## 2. Primary Revamped Screen Suite (`evidence/`)

## 2. Multi-Theme Screen Suite (`evidence/`)

| Ref | Screen | Viewport | Theme | Stitch ID | Evidence File | Core Focus |
| :-- | :----- | :------- | :---- | :-------- | :------------ | :--------- |
| **K1** | **Home Screen** | Mobile (390×844) | **Standard Light** | `da5d64510d2f4a208e0087ccc4082a8f` | `evidence/da5d64510d2f4a208e0087ccc4082a8f.png` | Porcelain `#F7F7F8` canvas, Evolution all-caps headings, acid-lime speech bubble, orange wager badge, Lucide icons, 52px black CTA. |
| **K2** | **Home Screen** | Mobile (390×844) | **Standard Dark** | `4180f8dee4d84b3f826c80ba2f7aa5fe` | `evidence/4180f8dee4d84b3f826c80ba2f7aa5fe.png` | Charcoal void `#0C0C0F` & obsidian `#16161B`, luminous acid-lime speech bubble, orange wager badge, Lucide icons, 52px mint CTA. |
| **K3** | **Home Screen** | Mobile (390×844) | **Romantic Dark** | `aa4c17bda0cd46349d50d542a034eaec` | `evidence/aa4c17bda0cd46349d50d542a034eaec.png` | Aubergine plum `#120C1C` & velvet `#1D142A`, luminous lilac speech bubble (*"You are in danger now 💜"*), champagne gold wager badge, 52px lilac CTA. |
| **K4** | **Home Screen** | Mobile (390×844) | **Romantic Light** | `3078c3213d1349c2ab8c5044a5577df1` | `evidence/3078c3213d1349c2ab8c5044a5577df1.png` | Soft blush `#FFF5F8` & rose cream `#FFE5EE`, radiant raspberry speech bubble, champagne gold wager badge, deep berry ink `#301A2C`, 52px berry CTA. |
| **K5** | **Outer Game Shell Chrome** | Mobile (390×844) | Standard Light | `a4744cce1df8431f880f28a0d4f01208` | `evidence/a4744cce1df8431f880f28a0d4f01208.png` | Outer boundary only: `[ ← GAMES ]` pill, `CONNECT FOUR` heading, porcelain stage, acid-lime banter bubble, 52px thumb pill `[ DROP DISC IN COL 4 → ]`, no bottom tabs. |
| **K6** | **Secret Handoff Veil**| Mobile (390×844) | Standard Light | `874c7424f99d415f8b1db09bd3849691` | `evidence/874c7424f99d415f8b1db09bd3849691.png` | Together mode privacy veil: `EYES CLOSED` heading, acid-lime speech bubble, citrus-orange shield seal, 3D gold padlock, and `[ I AM SARAH · REVEAL MY TURN → ]` black pill. |
| **K7** | **Desktop Home Adaptation** | Desktop (1280×800) | Standard Light | `750197390fbd41edae6ce5b5f424cf04` | `evidence/750197390fbd41edae6ce5b5f424cf04.png` | 1280×800 Bento Shell: Centered floating glass dock with Evolution all-caps tabs `[ HOME ] [ GAMES ] [ US ]`, 7-col hero duel with acid-lime bubble & orange wager, 5-col streak & quick vault stack. |
| **K8** | **Appearance & Settings** | Mobile (390×844) | **Standard Dark (Editorial)** | `12924945cd734fa3877426e8145516fe` | `evidence/12924945cd734fa3877426e8145516fe.png` | Editorial tracker composition: near-black framing, porcelain mode card with Evolution all-caps & banter bubble, mint `#CFE6A3` themes card, butter yellow `#F4DE88` piece card with orange wager badge, and charcoal sensory card. |

---

## 3. Deliverables Directory

1. [VISUAL-DIRECTION.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/VISUAL-DIRECTION.md) — 60-30-10 typography, iOS squircle curvature, and outer shell architecture.
2. [DESIGN-SYSTEM.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/DESIGN-SYSTEM.md) — CSS variables, Tailwind mapping, component catalog, and outer chrome specs.
3. [SCREEN-LIBRARY.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/SCREEN-LIBRARY.md) — Master index of all 20 generated Stitch screens and deep regional breakdowns.
4. [REFINEMENT-LOG.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/REFINEMENT-LOG.md) — 11 documented cycles from initial hypotheses to the post-grill overhaul.
5. [IMPLEMENTATION-HANDOFF.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/IMPLEMENTATION-HANDOFF.md) — Engineering brief, Tailwind config, component specs, and boundaries.
6. [REFERENCE-INTERPRETATION.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/REFERENCE-INTERPRETATION.md) — Reference analysis of `tennis-surfaces.png` and `tracker-*.png`.
7. [REFERENCE-COMPARISON.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/REFERENCE-COMPARISON.md) — Side-by-side comparative analysis against reference art.
8. [BOARD-SPECIFICATIONS.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/BOARD-SPECIFICATIONS.md) — Board artwork, vector geometry, and thumb deck specifications.
9. [MOTION-SPECIFICATIONS.md](file:///c:/ommd3076/Proejcts/arcade/planning/design/stitch/MOTION-SPECIFICATIONS.md) — Tactile physics, card flips, and reduced-motion guidelines.

---

## 4. Complete Screen Exploration Index (`evidence/`)

- `evidence/af1a51f69020433f8a89db203c7fec43.png` — Revamped Mobile Home (iOS Squircle)
- `evidence/c6f7fcfc029a4d9eaccbc7a2ee21f40d.png` — Outer Game Shell Chrome (Connect Four)
- `evidence/3026c1bdcbf340a9a512f039811ef3a9.png` — Desktop Home Adaptation (1280×800)
- `evidence/0490ce5cef10451395cfbfafe5e5fd17.png` — Secret Game Handoff Veil (Together Mode)
- `evidence/ee845567a3304367acb90930d658148a.png` — Appearance & Shell Settings
- `evidence/db22d7fc20994fa9afc1a18aca471b37.png` — Home Screen (Standard Dark Exploration)
- `evidence/07ef6400eb2845d09f9361f918ebe858.png` — Home Screen (Standard Light Exploration)
- `evidence/d7505233d1bd42c68167497eea46a379.png` — Home Screen (Romantic Dark Exploration)
- `evidence/e8fba080c96f4be485d47573bf8b4314.png` — Home Screen (Romantic Light Exploration)
- `evidence/60e18ca960554588b46f622158f7984d.png` — Games Catalog (Standard Dark)
- `evidence/94ba757e6e9445dd9d38643bf5fc3f11.png` — Us Screen (Standard Dark)
- `evidence/122c1ad4d1fd45a59381847bccdf14b5.png` — Sudoku Game Setup
- `evidence/1b3d2a3bb28e4619a1797f07cd01070a.png` — Connect Four Live Gameplay
- `evidence/1931ae8607c74c0daedce96cb1c472ee.png` — Ludo Classic 15x15 Board
- `evidence/84209fc1bb144c2a914af6bc4c1161a4.png` — Snakes & Ladders Serpentine Board
- `evidence/1a9a25c9d2354d0e93f4f44a30f783cd.png` — Sudoku Practice Board & Keypad
- `evidence/7eed8bce7ac64557a44f21d4ddad8983.png` — RPS Secret Handoff Privacy Shield
- `evidence/ee590de9e93c45e1a27071800394baa1.png` — RPS Simultaneous Reveal & Result
- `evidence/741c86cf36194c57907d13cf4d218fda.png` — Offline Reconnecting & DO Recovery
- `evidence/f2fb91320df84babafb33901f3cda5a4.png` — Appearance, Themes & Token Customization
