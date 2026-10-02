# Private Arcade — 10-Cycle Iterative Refinement Log

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/REFINEMENT-LOG.md`  
**Stitch Project:** `projects/9099986947047806544`  
**Design System Asset:** `assets/0fb48a45937f4aa7a98ce72c8c4231ee`  

---

## 1. Overview of the 10 Refinement Cycles

To ensure that the visual design of Private Arcade is not a superficial first-draft mockup, the system was developed across ten disciplined, substantive refinement rounds. Every cycle generated real screens via Google Stitch MCP, inspected the visual results against the reference corpus, identified concrete deficiencies, executed corrective modifications, and documented whether each hypothesis was retained or rejected.

---

## 2. Detailed Chronicle of Refinement Cycles

### Cycle 1: Reference Analysis & Initial Visual Hypotheses
- **Focus:** Foundations of Home Screen & Theme Canvas.
- **Generated Screen:** Stitch Screen `db22d7fc20994fa9afc1a18aca471b37` (Home Standard Dark Initial).
- **Inspection Findings:** The initial canvas established a dark background (`#0C0C0F`) and rendered Daniel’s active Ludo turn in a Mint card (`#CFE6A3`).
- **Criticism against References:** The cards felt too uniform in size, resembling a generic dashboard. In `tracker-overview.png`, the visual rhythm relies on varied card proportions: a massive hero continue card, paired 2-column partner stats, and a slim cyan telemetry strip.
- **Concrete Next Change:** Alter the grid layout to an asymmetrical bento composition: increase vertical padding on the Mint hero card, split partner stats into dual Daniel vs. Sarah chronograph pillars, and introduce a warm yellow invitation card.
- **Outcome:** **Retained with architectural layout modifications.**

---

### Cycle 2: Competing Compositions (Light vs. Dark Foundations)
- **Focus:** Bright/Light Direction exploration based on `tennis-surfaces.png`.
- **Generated Screen:** Stitch Screen `07ef6400eb2845d09f9361f918ebe858` (Home Standard Light).
- **Inspection Findings:** Screen successfully adopted an off-white `#F7F7F8` porcelain canvas with pure white `#FFFFFF` cards and mint accents.
- **Criticism against References:** The light theme initially used gray text on the mint card, which washed out under bright conditions and failed WCAG AA. Furthermore, button pills lacked the dominant physical weight seen in `tennis-surfaces.png`.
- **Concrete Next Change:** Enforce deep forest dark ink (`#1D2915`) for all text inside Mint containers ($9.2:1$ contrast) and switch the primary button on light mode to a solid black pill (`#0C0C0F`) with crisp white typography.
- **Outcome:** **Retained as the official Standard Light baseline.**

---

### Cycle 3: Typography & Hierarchy Refinement
- **Focus:** Typeface comparison and weight tension across headings, counters, and controls.
- **Screen Evaluated:** Games Catalog `60e18ca960554588b46f622158f7984d` & Home Screen variants.
- **Hypothesis Tested:** Compare **Manrope** vs. **DM Sans** vs. **Plus Jakarta Sans** for interface harmony.
- **Inspection Findings:**
  - *DM Sans:* Good readability, but headings felt overly casual and lacked editorial authority.
  - *Manrope:* Crisp numerals and clean controls, but display titles felt slightly sterile.
  - *Plus Jakarta Sans:* Delivered the exact weight-pairing tension seen in the habit tracker references: light weight (`300`) stat counters + semibold (`600`) section anchors.
- **Criticism:** Early iterations overused all-caps on button labels, making the interface feel aggressive rather than intimate.
- **Concrete Next Change:** Lock Plus Jakarta Sans as primary font; restrict uppercase exclusively to `label-micro` (9px) with `+0.1em` tracking; use sentence case on buttons.
- **Outcome:** **Adopted Plus Jakarta Sans; rejected heavy bold headings everywhere.**

---

### Cycle 4: Surface, Color & Component Refinement
- **Focus:** Concentric corner curvature and elevation stratification.
- **Screen Evaluated:** Home Screen & Us Screen `94ba757e6e9445dd9d38643bf5fc3f11`.
- **Inspection Findings:** Child cards nested inside 24px outer containers had mismatched corner curves (16px inside 8px padding), creating optical pinch.
- **Criticism against References:** Both tennis and habit-tracker references maintain strictly concentric curvature. Shadows on dark cards also appeared muddy.
- **Concrete Next Change:** Enforce the concentric radii formula: $\text{Radius}_{\text{inner}} = \text{Radius}_{\text{outer}} - \text{Padding}$. Eliminate drop shadows in favor of 1px hairline border rings (`rgba(255,255,255,0.08)` on dark, `rgba(0,0,0,0.06)` on light).
- **Outcome:** **Retained as core design token rule.**

---

### Cycle 5: Gameplay Composition: Board-First Ergonomics
- **Focus:** Connect Four Live Gameplay `1b3d2a3bb28e4619a1797f07cd01070a`.
- **Inspection Findings:** Connect Four 7x6 board rendered centrally with yellow and crimson discs.
- **Criticism against References & Mobile Ergonomics:** The global bottom navigation tabs remained visible at the bottom of the screen, reducing vertical board height and introducing touch conflict with the player's thumb. Furthermore, tapping individual 40px matrix cells on a 390px viewport led to frequent mis-drops.
- **Concrete Next Change:**
  1. Strictly remove shell navigation dock from all gameplay and setup views.
  2. Implement 7 dedicated circular column drop buttons (C1 to C7) directly below the board, showing capacity state (`1 left`, `FULL`).
- **Outcome:** **Retained as the universal gameplay interaction standard.**

---

### Cycle 6: Dense Board Architecture (Classic Character)
- **Focus:** Ludo (`1931ae8607c74c0daedce96cb1c472ee`) and Snakes & Ladders (`84209fc1bb144c2a914af6bc4c1161a4`).
- **Inspection Findings:**
  - *Ludo:* 15x15 classic board with 4 colored yards, cross arms, 8 star safe spaces, and center triumph.
  - *Snakes & Ladders:* 10x10 serpentine grid with wooden ladders and illustrated danger snakes.
- **Criticism against References:** 15x15 Ludo cells measure approximately 22px on an iPhone screen—physically impossible to tap accurately with fingers. Snakes & Ladders needed clear differentiation between ladder climb paths and snake drops.
- **Concrete Next Change:**
  - For Ludo: Introduce a sub-board **Token Action Deck** consisting of 4 dedicated thumb cards for the active player's tokens (*Token 1: Ready*, *Token 2: Yard (Unlock on 6)*, *Token 3: In Play*, *Token 4: Home Path*).
  - For Snakes & Ladders: Add an oversized 3D tactile **Roll Dice** pill button with roll telemetry history.
- **Outcome:** **Retained; provides high classic fidelity without microscopic touch targets.**

---

### Cycle 7: Secret Game Rituals & Privacy Handoff
- **Focus:** Rock Paper Scissors Together Mode Handoff (`7eed8bce7ac64557a44f21d4ddad8983`) and Reveal (`ee590de9e93c45e1a27071800394baa1`).
- **Inspection Findings:** Initial handoff screen displayed an alert dialog over the board.
- **Criticism against References:** A translucent modal or simple alert dialog fails to guarantee privacy in pass-the-phone mode. The opponent can glance at underlying cards during handoff.
- **Concrete Next Change:**
  1. Implement a 100% opaque **Privacy Shield** with a tactile sealed padlock graphic and explicit message *"Move Locked & Hidden · Pass phone to Sarah"*.
  2. Require an explicit authorization tap (*"I am Sarah · Continue →"*) before unlocking.
  3. In the Reveal state, display physical face-up clash cards with duel telemetry (lock timestamps and reaction speed).
- **Outcome:** **Retained as the gold standard for Together mode privacy.**

---

### Cycle 8: Exceptional States & Network Resilience
- **Focus:** Connection Drop & Recovery Screen `741c86cf36194c57907d13cf4d218fda`.
- **Inspection Findings:** Screen rendered a generic error modal stating *"Connection Lost"*.
- **Criticism against References & System Architecture:** Generic error modals cause user anxiety about lost turns and desynchronization. In Private Arcade, the Cloudflare Durable Object SQLite database guarantees atomic saved acceptance.
- **Concrete Next Change:**
  1. Replace generic error modal with a calm amber alert banner: *"⚠️ Connection Lost · Reconnecting (Attempt 2 of 5) · Session safely preserved in Durable Object"*.
  2. Render the actual game board in a frosted, dimmed state with an authoritative seal: *"🔒 State Locked at Turn 18 · Authoritative DO Consensus"*.
  3. Include a real-time resilience telemetry card verifying zero uncommitted moves and active controller lease countdown.
- **Outcome:** **Retained as the resilient exception-handling pattern.**

---

### Cycle 9: Aesthetic Theme Extension (Romantic Duo)
- **Focus:** Romantic Dark (`d7505233d1bd42c68167497eea46a379`) and Romantic Light (`e8fba080c96f4be485d47573bf8b4314`).
- **Inspection Findings:** Initial romantic exploration attempted to change border radii and font families to cursive script.
- **Criticism against References:** Changing structural shapes or typography between themes breaks component reusability and degrades usability. Themes must share identical layout mechanics.
- **Concrete Next Change:** Lock typography (Plus Jakarta Sans) and concentric radii across all themes. Express romantic personality strictly through color tokens: velvety aubergine (`#120C1C`) and luminous lilac (`#C9A7FF`) in Dark; blush (`#FFF5F8`) and deep berry ink (`#301A2C`) in Light.
- **Outcome:** **Retained; achieves distinct mood with 100% component compatibility.**

---

### Cycle 10: System Consolidation & Token Customization
- **Focus:** Appearance & Customization Screen `f2fb91320df84babafb33901f3cda5a4`.
- **Inspection Findings:** Screen brings together theme families, display modes, and player token customization.
- **Criticism against References:** Previously, player piece colors were conflated with the app theme. If Daniel changed the app to Dark mode, piece colors could become ambiguous.
- **Concrete Next Change:**
  1. Visually and architecturally decouple **App Theme** (Standard vs. Romantic) from **Game Token Colors** (Emerald Mint, Royal Cyan, Crimson Coral, Warm Gold).
  2. Add a live Connect Four interactive preview showing Daniel's selected piece color alongside Sarah's synchronized color.
  3. Provide independent haptic vibration and audio feedback toggles.
- **Outcome:** **Retained; delivers final system consolidation and customization clarity.**

---

### Cycle 11: Grill-Me Review & iOS Squircle Overhaul (Post-Grill Consensus)
- **Focus:** Complete typography overhaul (60-30-10 system), clutter elimination, iOS continuous squircles (`rounded-[32px]`), full-bleed horizontal carousels, outer-body-only chrome, and desktop landscape adaptation.
- **Generated Screens:**
  - Stitch Screen `af1a51f69020433f8a89db203c7fec43` (Primary iOS Squircle Mobile Home)
  - Stitch Screen `c6f7fcfc029a4d9eaccbc7a2ee21f40d` (Outer Game Shell Chrome)
  - Stitch Screen `3026c1bdcbf340a9a512f039811ef3a9` (Desktop Home Adaptation 1280×800)
  - Stitch Screen `0490ce5cef10451395cfbfafe5e5fd17` (Secret Game Handoff Veil)
  - Stitch Screen `ee845567a3304367acb90930d658148a` (Appearance & Settings Screen)
- **User Directives & Inspection Findings:**
  - The user explicitly rejected previous mockups: *"typography is not good. too much clutter, ui is mainly sticking to a single font, i'd like to have 60-30-10 where 10 is header/rare font with so and so. now look at the ref images i gave u and the plan accordingly. dont design the inner games just the out body and everything around it. and the current mockups dont match up to the inspirations/referenfces i provided. i want ios style rounded."*
- **Criticism against Previous Iterations:**
  - Prior mockups relied on a single font family (Plus Jakarta Sans everywhere), failing to capture either the handcrafted, expressive charm of the tennis reference (*"ACE MATCH"*) or the delicate, ultra-thin chronograph numerals of the habit tracker (*"78%"*).
  - Interfaces suffered from telemetry clutter: too many competing badges, small stat boxes, and vertical stacked cards.
  - Border radii (`24px`) were conventional rounded rectangles rather than deep, continuous Apple-style squircles (`rounded-[32px]`).
  - Gameplay mockups over-focused on drawing internal game boards and pieces rather than perfecting the surrounding outer shell, header chrome, and bottom thumb zone.
- **Concrete Next Changes Executed:**
  1. **Enforce 60-30-10 Typography:** 10% handcrafted display script (*Caveat* / brush) for titles (*Private Arcade ✦*, *Connect Four ✦*, *Eyes Closed! 🙈*); 60% warm modern sans for conversational reading; 30% functional chronograph numerals (*14 DAYS*) and compact tabular tags.
  2. **iOS Squircle Curvature (`rounded-[32px]`):** All primary containers upgraded to `32px` continuous squircles; child cards to `28px`; buttons to `rounded-full` capsules.
  3. **De-Cluttering & Whitespace:** Eliminated dense stat matrices. Restricted screens to at most 2–3 bold components with generous `24px`–`32px` internal padding.
  4. **Full-Bleed Horizontal Carousel:** Transformed Home active games into a swipeable horizontal deck with peeking adjacent cards and a dominant solid black pill CTA (`Jump In · Resume →`).
  5. **Outer-Body-Only Game Shell:** Stripped all internal game-board rendering. Built a pristine porcelain outer stage with top back pill, partner presence capsule, 52px black thumb pill (`Drop Disc in Col 4 →`), and complete suppression of the bottom dock.
  6. **Desktop Landscape Adaptation:** Engineered a compact 1280×800 bento shell with centered floating glass top bar and 2-column layout.
- **Outcome:** **Retained as intermediate exploration.**

---

### Cycle 12: "THE EVOLUTION" Condensed Grotesque Headings & Playful Accent Synthesis
- **Focus:** Complete elimination of decorative brush script fonts; enforcement of "THE EVOLUTION" condensed grotesque typography in ALL CAPS for main headings and 30% functional controls; integration of vibrant tactile accents (acid-lime speech bubbles, citrus-orange wager badges) from `playful-accent.png`.
- **Generated Screens:**
  - Stitch Screen `da5d64510d2f4a208e0087ccc4082a8f` (Mobile Home Screen - Porcelain Grotesque)
  - Stitch Screen `a4744cce1df8431f880f28a0d4f01208` (Outer Game Shell Chrome - Connect Four)
  - Stitch Screen `874c7424f99d415f8b1db09bd3849691` (Secret Game Handoff Veil - Eyes Closed)
  - Stitch Screen `750197390fbd41edae6ce5b5f424cf04` (Desktop Home Adaptation 1280×800)
- **User Directives:**
  1. *"use this font for 30 in all caps"* (uploading "THE EVOLUTION" condensed font image).
  2. *"ok wait undo i dont want brush stroke its not good."*
  3. *"refer to playful accent, use that colored but for main headings use the evolution type. the playful accent, should be for other parts not headings or labels. research more"*
- **Inspection Findings & Criticisms:**
  - The previous brush script test (`b569096b3beb485c9d6b9716e0370e27`) felt too casual, handwritten, and unfocused for an architectural, intimate gaming salon.
  - The "THE EVOLUTION" typeface specimen exhibits tall, condensed, bold grotesque geometry with uniform monoline strokes and capsule-shaped curved terminals.
  - The `playful-accent.png` reference contains high-voltage acid-lime (`#D4FE00`) speech bubbles with directional tails, citrus-orange (`#FF6B00`) scalloped starburst wager badges, and dimensional 3D game pieces.
- **Concrete Next Changes Executed:**
  1. **Strictly eliminate brush script and cursive fonts across the entire application.**
  2. **Adopt "THE EVOLUTION" condensed grotesque in ALL CAPS for all Main Headings:** `PRIVATE ARCADE`, `LUDO DUEL`, `CONNECT FOUR`, `EYES CLOSED`.
  3. **Adopt "THE EVOLUTION" condensed grotesque in ALL CAPS for the 30% Functional Controls & Badges:** `[ CLASSIC DUEL · LIVE ]`, `[ SARAH 🟢 24MS ]`, `[ JUMP IN · RESUME → ]`, `[ DROP DISC IN COL 4 → ]`, `[ I AM SARAH · REVEAL MY TURN → ]`, `[ HOME ] [ GAMES ] [ US ]`.
  4. **Apply Playful Accents Strictly to Other Parts (Not headings, not labels):**
     - Acid-Lime (`#D4FE00`) rounded speech bubbles with pointer tails for conversational partner updates (*"Sarah: Watch out for Column 4! 😏"*).
     - Citrus-Orange (`#FF6B00`) scalloped starburst badges for wager bets (*`ICED MATCHA WAGER`*) and milestone seals.
     - Dimensional 3D game dice, Connect Four tokens with specular highlights, and gold streak trophies.
- **Outcome:** **Retained as the core typographic and layout baseline.**

---

### Cycle 13: Multi-Theme Matrix & Lucide Vector Iconography Finalization
- **Focus:** Complete realization of the 4-theme palette matrix (Standard Light, Standard Dark, Romantic Dark, Romantic Light) and standardization on production-grade Lucide / Phosphor vector iconography.
- **Generated Screens:**
  - Stitch Screen `4180f8dee4d84b3f826c80ba2f7aa5fe` (Home Screen - Standard Dark / Nocturne Kinetic)
  - Stitch Screen `aa4c17bda0cd46349d50d542a034eaec` (Home Screen - Romantic Dark / Aubergine Velvet)
  - Stitch Screen `3078c3213d1349c2ab8c5044a5577df1` (Home Screen - Romantic Light / Blush Rose)
- **User Directives:**
  - *"yes its good. finalizw ir. but the svg icons are bit placeholder type so, I want good quality. use lucid icons/ phospohorsu/ iconair and now lets do different themes"*
- **Inspection Findings & Criticisms:**
  - Previous icon renderings occasionally relied on generic geometric glyphs with inconsistent visual stroke weights.
  - The multi-theme requirement needed concrete, verified Stitch artifacts demonstrating that the layout mechanics, concentric squircle geometry (`rounded-[32px]`), full-bleed horizontal carousel, and Evolution condensed all-caps typography translate flawlessly across all four required emotional modes.
- **Concrete Next Changes Executed:**
  1. **Lock Lucide Icons (`lucide-react`) & Phosphor Icons as universal vector standard:** Built strictly on 24×24dp grids with uniform 2px stroke, rounded caps and joins (`Sparkles`, `Radio`, `Flame`, `Trophy`, `Coffee`, `Dice5`, `Home`, `Gamepad2`, `Heart`, `Lock`, `ShieldCheck`).
  2. **Standard Dark (Nocturne Kinetic):** Deep obsidian surfaces (`#16161B`), luminous acid-lime speech bubble with dark ink, citrus-orange wager badge, and crisp 52px mint CTA.
  3. **Romantic Dark (Aubergine Velvet):** Velvety plum containers (`#1D142A`), luminous lilac speech bubble (*"You are in danger now 💜"*), champagne gold wager badge (`SUNDAY GELATO WAGER`), and solid lilac pill CTA.
  4. **Romantic Light (Blush Rose):** Soft blush porcelain (`#FFF5F8`), warm rose cream surfaces (`#FFE5EE`), radiant raspberry speech bubble, champagne gold wager badge, deep berry ink typography (`#301A2C`), and solid deep berry CTA.
- **Outcome:** **Approved and finalized as the complete, multi-theme design system for Private Arcade.**

---

### Cycle 14: Appearance & Settings Overhaul (Editorial Tracker Composition)
- **Focus:** Complete replacement of legacy Appearance & Settings screen (`ee845567...`) with an editorial, varied-proportion card layout faithfully adhering to `tracker-detail.png` and `tracker-components.png`.
- **Generated Screen:**
  - Stitch Screen `12924945cd734fa3877426e8145516fe` (Appearance & Shell Settings - Editorial Dark)
  - Local Evidence: `evidence/12924945cd734fa3877426e8145516fe.png`
- **User Directives:**
  - Quoted: *"Appearance & Settings"* -> *"this is not acc to the ref/instrucyons"*
- **Inspection Findings & Criticisms:**
  - The previous mockup (`ee845567...`) was an obsolete pre-overhaul artifact: it retained the banned brush script title (`Appearance ✦`), used a generic off-white background with monotonous stacked rows, lacked "THE EVOLUTION" condensed all-caps typography, and failed to incorporate the bold editorial color surfaces from the tracker reference.
- **Concrete Next Changes Executed:**
  1. **Strict Tracker Reference Architecture:** Applied near-black/charcoal framing (`#0C0C0F` / `#16161B`) with deliberately varied card proportions, rounded iOS squircles (`rounded-[32px]`), and rich colored tactile surfaces.
  2. **Card 1 (Hero Display Mode - Crisp White Squircle):** Bold heading `APPEARANCE & SHELL` in "THE EVOLUTION" condensed grotesque all-caps, conversational sub-text, 3-way segmented pill (`[ LIGHT | DARK ● | SYSTEM ]`), and acid-lime speech bubble with pointer tail (*"Sarah: Dark mode looks gorgeous tonight 🖤"*).
  3. **Card 2 (Theme Families - Luminous Mint `#CFE6A3`):** Directly derived from tracker reference's green card. Dark forest ink (`#182412`), `STANDARD DUO` (active) and `ROMANTIC VELVET` (preview) decks with color palette DNA bars.
  4. **Card 3 (Player Game Pieces - Warm Butter Yellow `#F4DE88`):** Directly derived from tracker reference's yellow card. Deep ink (`#2C2204`), Daniel's token swatches (Emerald, Cyan, Coral, Amber), live Connect-4 tandem preview, and citrus-orange starburst pill `[ PEER SYNCED ]`.
  5. **Card 4 (Sensory Experience - Elevated Charcoal `#1F1F27`):** Clean iOS switches for Haptic Feedback and 8-Bit Chimes with Lucide vector icons (`zap`, `volume-2`).
  6. **Bottom Dock:** Centered floating pill dock with Lucide vector icons, highlighting `Us` in a soft mint squircle container.
- **Outcome:** **Flawless reference alignment. Retained as definitive K8 Appearance & Settings screen.**
