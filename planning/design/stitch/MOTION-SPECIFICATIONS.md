# Private Arcade — Motion & Tactile Feedback Specifications

**Document Status:** Approved Design Artifact  
**Location:** `planning/design/stitch/MOTION-SPECIFICATIONS.md`  
**Classification:** Intended Runtime Behavior (Specifications for subsequent implementation)  
**Governing Standard:** WCAG 2.1 Criterion 2.3.3 (Animation from Interactions)  

---

## 1. Motion Principles: "Calm Physicality"

Private Arcade enforces a motion language of **tactile weight and calm responsiveness**. Animations are never decorative distractions; every motion communicates state transitions, ownership transfers, and spatial continuity:
1. **Immediate Press Response:** Touch feedback is instantaneous ($\le 16\text{ms}$) to guarantee tactile confidence.
2. **Authoritative Confirmation:** Game pieces only animate into their final resting positions **after** server acceptance from the Cloudflare Durable Object.
3. **Interruptibility:** All transitions are cancelable and interruptible. Sudden network drops or rapid inputs immediately transition to the current authoritative state without broken animation queues.
4. **Zero Motion Sickness:** Strictly avoid full-screen camera swings, spinning 3D zooms, or parallax vertigo.

---

## 2. Core Interaction Physics & Choreography

### 2.1 Micro-Interactions: Tactile Touch Feedback
- **Target:** All buttons, pills, column drop controls, keypad digits, and cards.
- **Press Down State:**
  - `transform: scale(0.98)`
  - `opacity: 0.92`
  - Timing: `80ms cubic-bezier(0.2, 0.8, 0.4, 1.0)`
- **Release / Up State:**
  - `transform: scale(1.00)`
  - `opacity: 1.00`
  - Timing: `150ms cubic-bezier(0.34, 1.56, 0.64, 1.0)` (subtle elastic snapback)
- **Haptic Vibration:** A single micro-tick (`10ms` duration via `navigator.vibrate(10)` where supported).

---

### 2.2 Board Animations: Accepted Move Execution

#### Connect Four Disc Drop
- **Trigger:** Server WebSocket returns `ACCEPTED_MOVE` for column $C$.
- **Choreography:**
  1. The disc spawns at the top of column $C$ with initial opacity `1.0`.
  2. Accelerates downward into target row $R$ using gravitational acceleration:
     - Curve: `cubic-bezier(0.55, 0.055, 0.675, 0.19)`
     - Duration: $180\text{ms} + (R \times 40\text{ms})$ (deeper rows take proportionally longer).
  3. Small settling bounce on landing ($4\text{px}$ rebound, $90\text{ms}$ duration).
  4. Subtle sound bite: 8-bit wooden clink.

#### Ludo & Snakes Pawn Advance
- **Trigger:** Dice roll accepted; pawn progresses from tile $A$ to $B$.
- **Choreography:**
  - Pawn advances tile-by-tile via an arc hop curve (`transform: translateY(-8px)` at mid-step).
  - Duration per tile: $120\text{ms}$.
  - Ladder Climb: Smooth diagonal slide upward over $600\text{ms}$ with celebratory chime.
  - Snake Drop: Sinuous slide downward over $750\text{ms}$ with low rumble sound.

---

### 2.3 Secret Games: Handoff & Simultaneous Reveal

#### Privacy Shield Cover (Pass Phone)
- **Choreography:**
  - When Player A taps "Lock Move", the screen transitions to the opaque **Privacy Shield** within $200\text{ms}$.
  - The 3D padlock icon executes a crisp click-shut scale animation (`scale(1.1) → scale(1.0)`).
  - Screen remains completely opaque until Player B taps "I am Sarah · Continue".

#### Simultaneous Card Reveal
- **Choreography:**
  - Both duel cards start face down in the arena.
  - On countdown zero (`3... 2... 1... FLIP`):
    - Both cards flip along the Y-axis (`transform: rotateY(180deg)`), duration $350\text{ms}$ ease-out.
    - At $90^\circ$ (edge-on), card faces swap to the revealed selections (e.g. Rock vs. Scissors).
    - Energy clash pulse emanates from the center node (`scale(0.8) → scale(1.4)`, opacity fade $400\text{ms}$).
    - The winning card gains an active luminous border glow; the losing card dims to $70\%$ opacity.

---

### 2.4 State Transitions: Reconnection & Recovery

- **Connection Interruption:**
  - A frosted dark scrim smoothly dissolves over the active board over $250\text{ms}$ (`backdrop-filter: blur(4px)`, opacity $0 \rightarrow 1$).
  - The amber reconnection banner slides down from top (`transform: translateY(-100%) → translateY(0)`).
  - The retry countdown ring pulses with a smooth $4\text{s}$ linear stroke animation.
- **Connection Restoration:**
  - On WebSocket re-establishment and state reconciliation, the frosted scrim fades out over $200\text{ms}$, and a subtle mint toast announces: *"Session Synchronized · Turn Restored"*.

---

## 3. Reduced-Motion Implementation Specification

In strict adherence to accessibility standards, when the user or operating system requests reduced motion (`@media (prefers-reduced-motion: reduce)`):

```css
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Functional Adjustments under Reduced Motion:
1. **Button Presses:** Instant color/border shift without scale displacement.
2. **Disc Drops & Pawn Moves:** Disc appears immediately in the resting slot; pawn teleports instantly to the destination tile without tile-by-tile hops.
3. **Card Reveal:** Instant cross-fade dissolve ($100\text{ms}$) replaces 3D rotation.
4. **Reconnection Overlay:** Simple instant opacity toggle with no sliding motion.
5. **Haptic Feedback:** Haptic vibration remains active (subject to the user's independent setting in Appearance) to provide non-visual tactile confirmation.
