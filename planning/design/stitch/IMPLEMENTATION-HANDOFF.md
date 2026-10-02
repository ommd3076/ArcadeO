# Private Arcade — Implementation Handoff & Technical Brief

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/IMPLEMENTATION-HANDOFF.md`  
**Target Roles:** Frontend Engineer, Game Engineer, Sudoku Engineer, QA Engineer  
**Reference Artifacts:**
- `REFERENCE-INTERPRETATION.md`
- `VISUAL-DIRECTION.md`
- `SCREEN-LIBRARY.md`
- `REFINEMENT-LOG.md`
- `REFERENCE-COMPARISON.md`
- `DESIGN-SYSTEM.md`
- `BOARD-SPECIFICATIONS.md`
- `MOTION-SPECIFICATIONS.md`

---

## 1. System Architecture & System Boundaries

Implementation teams must adhere strictly to the architectural contracts defined in `PRODUCT.md` and `planning/UI-CONTRACT.md`:

```
┌────────────────────────────────────────────────────────┐
│                   BROWSER / CLIENT                     │
│  - Viewport-Responsive Shell (Home, Games, Us)         │
│  - Board-First Gameplay Containers                     │
│  - Sub-Board Action Decks (Thumb Ergonomics)           │
│  - Optimistic Feedback (Pending Animation Only)        │
└────────────────────────────────────────────────────────┘
                           │ ▲
                 WebSocket │ │ Authoritative Acceptance
                           ▼ │
┌────────────────────────────────────────────────────────┐
│             CLOUDFLARE DURABLE OBJECT (DO)             │
│  - Single Authority for Active Match State             │
│  - Atomic SQLite Acceptance                            │
│  - Redaction of Secret Choices (RPS / Hand Cricket)    │
│  - Reconnect Consensus & Lease Management              │
└────────────────────────────────────────────────────────┘
                           │
                           ▼ Async Projection
┌────────────────────────────────────────────────────────┐
│                 CLOUDFLARE D1 DATABASE                 │
│  - Archival Match Records & Duo Statistics             │
│  - Asynchronous Puzzle Challenges                      │
└────────────────────────────────────────────────────────┘
```

### Golden Implementation Rules:
1. **Durable Object Saved Acceptance is Authoritative:** Optimistic client animations may depict a piece in motion, but **cannot decide outcomes**. If the server rejects a move (e.g. concurrent race condition), the client must immediately roll back to the authoritative state.
2. **Offline Inputs Pause:** If the WebSocket connection drops, the UI must immediately display the frosted reconnection state (`741c86cf36194c57907d13cf4d218fda`) and pause input queueing.
3. **Tab Dock Concealment:** The global bottom floating navigation dock (`Home`, `Games`, `Us`) must be **strictly hidden** when entering any game board or setup screen.
4. **Visible Back Action:** Every game view must have an unambiguous, hairline-bordered Back pill (`← Games`) in the top navigation bar.

---

## 2. Token & Tailwind Configuration Mapping

Frontend engineers should integrate the following token extensions into `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: {
          base: 'var(--pa-canvas-base)',
        },
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
        squircle: '32px', // primary containers & game stage
        card: '28px',     // horizontal carousel cards
        inner: '20px',    // nested cards & modules
        control: '14px',  // sub-controls & inputs
        full: '9999px',   // capsules & pill buttons
      },
      fontFamily: {
        heading: ['"Barlow Condensed"', '"Antonio"', '"DIN Condensed"', 'sans-serif'], // Main Headings: ALL CAPS
        sans: ['"Plus Jakarta Sans"', '"Hanken Grotesk"', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'sans-serif'], // 60% Conversational Reading
        functional: ['"Barlow Condensed"', '"Antonio"', '"DIN Condensed"', 'monospace'], // 30% Controls & Badges: ALL CAPS
      },
    },
  },
};
```

---

## 3. Component Architecture Recommendations

To ensure modularity and clean separation between outer chrome and internal game rules, frontend engineers should build the following components:

1. **`GameShell.tsx` (Outer Body Only):**
   - Renders the outer boundary around any game: top bar (`← Games` pill, condensed all-caps title e.g. *`CONNECT FOUR`*, partner presence capsule).
   - Bottom thumb action area: hosts the dominant 52px solid black pill CTA (`DROP DISC IN COL 4 →`, `ROLL DICE 🎲`) and utility capsules.
   - **Strict Rule:** Completely suppresses the global bottom navigation dock (`Home | Games | Us`). Does **not** contain or alter any internal game boards, piece logic, or win conditions.
2. **`BoardStage.tsx`:** Centered porcelain or slate container (`rounded-[32px]`, 20px–24px padding, hairline border ring) that hosts the game view without visual clutter.
3. **`CardCarousel.tsx`:** Full-bleed horizontal card deck with `-webkit-overflow-scrolling: touch`, `scroll-snap-type: x mandatory`, peeking edge cards, and tactile stacked depth.
4. **`PlayfulSpeechBubble.tsx` (`playful-accent` motif):** Acid-lime (`#D4FE00`) rounded container with a 45-degree directional tail, hosting conversational move updates and partner banter in clean sentence-case text.
5. **`WagerBadge.tsx` (`playful-accent` motif):** Citrus-orange (`#FF6B00`) scalloped or starburst pill badge displaying high-stakes wager agreements (*`ICED MATCHA WAGER`*).
6. **`DesktopBentoShell.tsx`:** Landscape (1280×800) container featuring a centered floating glass top bar and 2-column bento layout (7-col hero carousel on left, 5-col streak & quick vault on right).
7. **`PrivacyVeil.tsx`:** 100% opaque full-screen cover used for Together mode secret choices, featuring the bold condensed heading *`EYES CLOSED`*, 3D padlock graphic, conversational instructions, and an explicit role unlock pill (*`[ I AM SARAH · REVEAL MY TURN → ]`*).
8. **`TurnBanner.tsx`:** Dynamic pill card displaying player avatar, status prompt, and `tabular-nums` chronograph timer.
9. **`ReconnectionBanner.tsx`:** Ambient warning bar with automated retry countdown ring and link to resilience telemetry.

---

## 4. Asset Inventory & Licensing Summary

1. **Fonts:**
   - **Barlow Condensed / Antonio / DIN Condensed:** Open Font License (OFL). Main display headings and 30% functional controls/buttons/pills/badges in ALL CAPS.
   - **Plus Jakarta Sans / Hanken Grotesk:** Open Font License (OFL). 60% Conversational reading and body copy in sentence case.
   - **Zero Cursive / Brush Script:** Strictly prohibited throughout the application.
2. **Icons:** Material Symbols Rounded / Lucide Icons (MIT License / Apache 2.0).
3. **Board Assets:** Pure vector SVGs created specifically for Private Arcade (Ludo cross tracks, safe stars, Snakes ladders and serpent vectors, Connect Four matrix cutouts). No third-party copyright or watermarked assets.

---

## 5. Unresolved Design Questions & Future Exploration

While the visual design and component system are fully established and validated, the following items are flagged for subsequent implementation testing:

1. **Haptic Vibration Driver Compatibility:** While `navigator.vibrate` is standard on Android Chrome, iOS Safari has restricted web haptic API support. The engineering team should test fallback audio micro-clicks for iOS PWA environments.
2. **Smallest Viewport (320px iPhone SE) Margin Scaling:** On 320px widths, outer card margins should automatically step down from `16px` to `12px` via `@media (max-width: 340px)` to maximize board display area.
3. **Ludo & Snakes Functional Engine Corrections:** As explicitly stated in the design brief, functional rule updates (e.g. piece collision math and multi-token house rules) will be delivered under a separate engineering brief.
