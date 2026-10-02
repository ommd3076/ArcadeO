# Private Arcade — Screen & State Design Library

**Document Status:** Approved Design Artifact (Post-Grill Refinement)  
**Location:** `planning/design/stitch/SCREEN-LIBRARY.md`  
**Stitch Project:** `projects/9099986947047806544`  
**Downloaded Assets Directory:** `planning/design/stitch/evidence/`  

---

## 1. Definitive Multi-Theme Suite (Evolution Type + Lucide Icons + Playful Accents)

These primary screens embody the finalized visual system: **zero clutter, "THE EVOLUTION" condensed grotesque typography in ALL CAPS for main headings and 30% functional controls, 24px Lucide vector icons, conversational modern sans for reading, vibrant tactile accents (acid-lime / lilac speech bubbles & orange / champagne wager badges), continuous iOS squircles (`rounded-[32px]`), full-bleed horizontal carousels, and outer-body-only chrome**:

| # | Screen Title | Viewport | Theme Variant | Stitch Screen ID | Local Evidence File | Key Features |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **K1** | **Home Screen** | Mobile (390×844) | **Standard Light** | `da5d64510d2f4a208e0087ccc4082a8f` | `evidence/da5d64510d2f4a208e0087ccc4082a8f.png` | Porcelain `#F7F7F8` canvas, Evolution all-caps headings, acid-lime `#D4FE00` speech bubble, citrus-orange `ICED MATCHA WAGER` starburst badge, Lucide icons, 52px black CTA. |
| **K2** | **Home Screen** | Mobile (390×844) | **Standard Dark** | `4180f8dee4d84b3f826c80ba2f7aa5fe` | `evidence/4180f8dee4d84b3f826c80ba2f7aa5fe.png` | Deep charcoal `#0C0C0F` & obsidian `#16161B`, luminous acid-lime speech bubble with dark ink, citrus-orange wager badge, Lucide sparkles/home/gamepad/heart, 52px mint CTA. |
| **K3** | **Home Screen** | Mobile (390×844) | **Romantic Dark** | `aa4c17bda0cd46349d50d542a034eaec` | `evidence/aa4c17bda0cd46349d50d542a034eaec.png` | Aubergine plum `#120C1C` & velvet `#1D142A`, luminous lilac `#C9A7FF` speech bubble (*"You are in danger now 💜"*), champagne gold `SUNDAY GELATO WAGER` badge, 52px lilac CTA. |
| **K4** | **Home Screen** | Mobile (390×844) | **Romantic Light** | `3078c3213d1349c2ab8c5044a5577df1` | `evidence/3078c3213d1349c2ab8c5044a5577df1.png` | Soft blush `#FFF5F8` & rose cream `#FFE5EE`, radiant raspberry `#E91E63` speech bubble, champagne gold wager badge, deep berry ink `#301A2C`, 52px berry pill CTA. |
| **K5** | **Outer Game Shell Chrome** | Mobile (390×844) | Standard Light | `a4744cce1df8431f880f28a0d4f01208` | `evidence/a4744cce1df8431f880f28a0d4f01208.png` | Outer boundary only: `[ ← GAMES ]` pill, `CONNECT FOUR` heading, porcelain stage, acid-lime banter bubble (*"Sarah: Watch out for Column 4! 😏"*), 52px thumb pill `[ DROP DISC IN COL 4 → ]`. |
| **K6** | **Secret Handoff Veil** | Mobile (390×844) | Standard Light | `874c7424f99d415f8b1db09bd3849691` | `evidence/874c7424f99d415f8b1db09bd3849691.png` | Together mode privacy veil: `EYES CLOSED` heading, acid-lime *"Strictly No Peeking! 👀"* bubble, citrus-orange shield seal, 3D gold padlock, and `[ I AM SARAH · REVEAL MY TURN → ]` black pill. |
| **K7** | **Desktop Home Adaptation** | Desktop (1280×800) | Standard Light | `750197390fbd41edae6ce5b5f424cf04` | `evidence/750197390fbd41edae6ce5b5f424cf04.png` | 1280×800 Bento Shell: Centered floating glass dock with Evolution all-caps tabs `[ HOME ] [ GAMES ] [ US ]`, 7-col hero duel with acid-lime bubble & orange wager, 5-col streak & quick vault stack. |
| **K8** | **Appearance & Shell Settings** | Mobile (390×844) | **Standard Dark (Editorial)** | `12924945cd734fa3877426e8145516fe` | `evidence/12924945cd734fa3877426e8145516fe.png` | Editorial tracker composition: charcoal framing, porcelain white mode card with Evolution all-caps & acid-lime bubble, luminous mint `#CFE6A3` theme card, warm yellow `#F4DE88` player pieces card with orange wager pill, and charcoal sensory card. |

---

## 2. Comprehensive Theme & State Exploration Index

The complete library covers all required foundation states, themes, and gameplay representations:

| # | Screen Title | Category / State | Theme Variant | Stitch Screen ID | Local Evidence File |
| :- | :--- | :--- | :--- | :--- | :--- |
| **01** | Home Screen | Shell / Active Dashboard | Standard Dark | `db22d7fc20994fa9afc1a18aca471b37` | `evidence/db22d7fc20994fa9afc1a18aca471b37.png` |
| **02** | Home Screen | Shell / Active Dashboard | Standard Light | `07ef6400eb2845d09f9361f918ebe858` | `evidence/07ef6400eb2845d09f9361f918ebe858.png` |
| **03** | Home Screen | Shell / Active Dashboard | Romantic Dark | `d7505233d1bd42c68167497eea46a379` | `evidence/d7505233d1bd42c68167497eea46a379.png` |
| **04** | Home Screen | Shell / Active Dashboard | Romantic Light | `e8fba080c96f4be485d47573bf8b4314` | `evidence/e8fba080c96f4be485d47573bf8b4314.png` |
| **05** | Games Catalog | Shell / 8 Games Directory | Standard Dark | `60e18ca960554588b46f622158f7984d` | `evidence/60e18ca960554588b46f622158f7984d.png` |
| **06** | Us Screen | Shell / Shared Records & Duo | Standard Dark | `94ba757e6e9445dd9d38643bf5fc3f11` | `evidence/94ba757e6e9445dd9d38643bf5fc3f11.png` |
| **07** | Sudoku Game Setup | Setup / Mode, Diff, Puzzles | Standard Dark | `122c1ad4d1fd45a59381847bccdf14b5` | `evidence/122c1ad4d1fd45a59381847bccdf14b5.png` |
| **08** | Connect Four Gameplay| Gameplay / Board-First Duel | Standard Dark | `1b3d2a3bb28e4619a1797f07cd01070a` | `evidence/1b3d2a3bb28e4619a1797f07cd01070a.png` |
| **09** | Ludo Classic Board | Gameplay / 15x15 Full Track | Standard Dark | `1931ae8607c74c0daedce96cb1c472ee` | `evidence/1931ae8607c74c0daedce96cb1c472ee.png` |
| **10** | Snakes & Ladders | Gameplay / 10x10 Serpentine | Standard Dark | `84209fc1bb144c2a914af6bc4c1161a4` | `evidence/84209fc1bb144c2a914af6bc4c1161a4.png` |
| **11** | Sudoku Practice Board| Gameplay / 9x9 Grid & Notes | Standard Dark | `1a9a25c9d2354d0e93f4f44a30f783cd` | `evidence/1a9a25c9d2354d0e93f4f44a30f783cd.png` |
| **12** | RPS Secret Handoff | Secret / Together Mode Pass | Standard Dark | `7eed8bce7ac64557a44f21d4ddad8983` | `evidence/7eed8bce7ac64557a44f21d4ddad8983.png` |
| **13** | RPS Reveal & Result | Secret / Simultaneous Clash | Standard Dark | `ee590de9e93c45e1a27071800394baa1` | `evidence/ee590de9e93c45e1a27071800394baa1.png` |
| **14** | Offline Reconnecting | Exceptional / DO Recovery | Standard Dark | `741c86cf36194c57907d13cf4d218fda` | `evidence/741c86cf36194c57907d13cf4d218fda.png` |
| **15** | Appearance & Themes | Shell / Customization & Tokens| Standard Dark | `f2fb91320df84babafb33901f3cda5a4` | `evidence/f2fb91320df84babafb33901f3cda5a4.png` |

---

## 3. Definitive Screen Suite Deep Dives (K1–K8)

### K1. Home Screen — Standard Light ("Porcelain Kinetic")
- **Stitch Screen ID:** `da5d64510d2f4a208e0087ccc4082a8f`
- **Local File:** `evidence/da5d64510d2f4a208e0087ccc4082a8f.png`
- **Regional Breakdown:**
  - **Top Bar:** Condensed grotesque heading `PRIVATE ARCADE` in bold uppercase; frosted glass capsule on right with Sarah's live status dot and photo avatar.
  - **Conversational Sub-header:** *"Hey Daniel 👋 / Sarah just made her move"* in friendly sans.
  - **Full-Bleed Horizontal Carousel:** Centered squircle card (`rounded-[32px]`, 28px padding) for `LUDO DUEL` with turn badge, vibrant citrus-orange `ICED MATCHA WAGER` starburst badge, and an acid-lime (`#D4FE00`) speech bubble (*"Sarah: Rolled a 6! Heading for your home lane! 🎲"*). Dominant 52px black pill CTA (`[ JUMP IN · RESUME → ]`). Subtle stacked cards peek on left and right.
  - **Duo Momentum Card:** Soft tinted squircle card with friendly streak blurb and tall ultra-light numeral `14 DAYS`.
  - **Floating Dock:** Centered rounded-full capsule featuring crisp 24px Lucide icons (`Home`, `Gamepad2`, `HeartHandshake`).

### K2. Home Screen — Standard Dark ("Nocturne Kinetic")
- **Stitch Screen ID:** `4180f8dee4d84b3f826c80ba2f7aa5fe`
- **Local File:** `evidence/4180f8dee4d84b3f826c80ba2f7aa5fe.png`
- **Regional Breakdown:**
  - **Palette:** Near-black obsidian (`#0C0C0F` / `#16161B`) background with crisp high-contrast elements.
  - **Headings & Badges:** `PRIVATE ARCADE` and `LUDO DUEL` in condensed grotesque all-caps.
  - **Tactile Accents:** Luminous acid-lime speech bubble with dark ink (*"Sarah: Rolled a 6! Heading for your home lane! 🎲"*), paired with citrus-orange `ICED MATCHA WAGER` badge.
  - **Controls & Icons:** 52px mint pill CTA (`[ JUMP IN · RESUME → ]`) and 24px Lucide icons with 2px stroke.

### K3. Home Screen — Romantic Dark ("Aubergine Velvet")
- **Stitch Screen ID:** `aa4c17bda0cd46349d50d542a034eaec`
- **Local File:** `evidence/aa4c17bda0cd46349d50d542a034eaec.png`
- **Regional Breakdown:**
  - **Palette:** Deep aubergine plum (`#120C1C`) canvas with rich velvet (`#1D142A`) cards and subtle warm violet borders.
  - **Headings & Badges:** `PRIVATE ARCADE` and `LUDO DUEL` in condensed grotesque all-caps.
  - **Romantic Accents:** Luminous lilac (`#C9A7FF`) speech bubble with dark plum ink (*"Sarah: Just rolled a 5! You are in danger now 💜"*), paired with champagne gold (`#E5C07B`) `SUNDAY GELATO WAGER` badge.
  - **Controls & Dock:** 52px radiant lilac pill CTA (`[ JUMP IN · RESUME → ]`), floating dock with romantic lavender active indicators and Lucide icons.

### K4. Home Screen — Romantic Light ("Blush Rose")
- **Stitch Screen ID:** `3078c3213d1349c2ab8c5044a5577df1`
- **Local File:** `evidence/3078c3213d1349c2ab8c5044a5577df1.png`
- **Regional Breakdown:**
  - **Palette:** Soft porcelain blush (`#FFF5F8`) canvas with rose-cream (`#FFE5EE`) cards and delicate dusty rose borders.
  - **Headings & Badges:** `PRIVATE ARCADE` and `LUDO DUEL` in condensed grotesque all-caps rendered in deep berry ink (`#301A2C`).
  - **Romantic Accents:** Radiant raspberry (`#E91E63`) speech bubble with crisp white ink, paired with warm champagne gold `SUNDAY GELATO WAGER` badge.
  - **Controls & Dock:** 52px rich berry pill CTA (`[ JUMP IN · RESUME → ]`), frosted floating dock with delicate berry icons.

### K5. Outer Game Shell Chrome (Connect Four)
- **Stitch Screen ID:** `a4744cce1df8431f880f28a0d4f01208`
- **Local File:** `evidence/a4744cce1df8431f880f28a0d4f01208.png`
- **Regional Breakdown:**
  - **Top Bar Chrome:** Tactile Back pill `[ ← GAMES ]`, condensed grotesque heading `CONNECT FOUR`, match indicator, and Sarah's live connection pill (`[ SARAH 🟢 24MS ]`).
  - **Porcelain Stage:** Pristine squircle card (`rounded-[32px]`) housing the board. Acid-lime speech bubble with pointer tail (*"Sarah: Watch out for Column 4! 😏"*). Top turn badge (*YOUR TURN · DANIEL*) and live timer (*⏱ 0:24*). Match score pill (*DANIEL 2 : 1 SARAH*).
  - **Thumb Action Zone:** 52px solid black pill CTA (`[ DROP DISC IN COL 4 → ]`) positioned comfortably above the iOS home indicator. Symmetrical utility pills (`[ 🤝 OFFER DRAW ]`, `[ ⋯ OPTIONS ]`). Zero bottom dock tabs.

### K6. Secret Handoff Veil (Together Mode)
- **Stitch Screen ID:** `874c7424f99d415f8b1db09bd3849691`
- **Local File:** `evidence/874c7424f99d415f8b1db09bd3849691.png`
- **Regional Breakdown:**
  - **Privacy Stage:** Full-screen porcelain squircle card (`rounded-[36px]`) with centered 3D vaulted padlock and citrus-orange shield seal badge.
  - **Typography & Copy:** Condensed grotesque heading `EYES CLOSED` in bold uppercase; acid-lime speech bubble (*"Strictly No Peeking! 👀"*); conversational instruction (*"Daniel's move is locked in the couple vault. Pass the device over to Sarah"*).
  - **Authorization Action:** 52px solid black pill CTA (`[ I AM SARAH · REVEAL MY TURN → ]`). 100% suppression of the bottom dock.

### K7. Desktop Responsive Home Adaptation (1280×800 Bento)
- **Stitch Screen ID:** `750197390fbd41edae6ce5b5f424cf04`
- **Local File:** `evidence/750197390fbd41edae6ce5b5f424cf04.png`
- **Regional Breakdown:**
  - **Floating Top Bar:** Centered frosted glass dock with condensed grotesque title `PRIVATE ARCADE`, segmented pills `[ HOME ] [ GAMES ] [ US ]`, and Sarah's live presence pill.
  - **Left Bento Column (7 cols):** Full-bleed hero duel card with `LUDO DUEL` heading, acid-lime speech bubble, citrus-orange wager badge, and 52px resume pill.
  - **Right Bento Column (5 cols):** Duo Momentum card with giant `14 DAYS` metric and weekly streak tracker, paired with Quick Launch Vault card.

### K8. Appearance & Shell Settings Screen (Editorial Tracker Composition)
- **Stitch Screen ID:** `12924945cd734fa3877426e8145516fe`
- **Local File:** `evidence/12924945cd734fa3877426e8145516fe.png`
- **Regional Breakdown:**
  - **Canvas & Framing:** Charcoal framing (`#0C0C0F` / `#16161B`) with Dynamic Island `SYNCED` telemetry, tactile frosted Back pill `[ ← US ]`, and `[ SAVED ✓ ]` status pill.
  - **Card 1 (Display Mode - Porcelain White):** Bold headline `APPEARANCE & SHELL` in "THE EVOLUTION" condensed all-caps, 3-way segmented mode pill `[ LIGHT | DARK ● | SYSTEM ]`, and acid-lime speech bubble with directional tail (*"Sarah: Dark mode looks gorgeous tonight 🖤"*).
  - **Card 2 (Theme Families - Luminous Mint `#CFE6A3`):** Varied-proportion mint squircle card with dark forest ink (`#182412`), featuring `STANDARD DUO` (`[ ACTIVE ● ]`) and `ROMANTIC VELVET` (`[ PREVIEW ]`) decks with palette DNA swatches.
  - **Card 3 (Player Game Pieces - Butter Yellow `#F4DE88`):** Varied-proportion butter yellow squircle card with Daniel's token swatches (Emerald, Cyan, Coral, Amber), live Connect-4 tandem preview, and citrus-orange starburst pill `[ PEER SYNCED ]` with Lucide radio icon.
  - **Card 4 (Sensory Controls - Elevated Charcoal `#1F1F27`):** Clean iOS switches for Tactile Haptics and 8-bit Audio with Lucide vector icons (`zap`, `volume-2`).
  - **Dock:** Centered floating pill dock with `Us` tab highlighted in a soft mint squircle container.
