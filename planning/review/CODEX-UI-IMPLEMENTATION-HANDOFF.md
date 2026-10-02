# Codex UI implementation handoff

Owner direction, 2026-10-02: implement the whole application UI and animations now in a new owner-created chat using GPT-6 Luna. Do not stop after six pilot screens, a prototype, screenshots or a written proposal. Work in `C:/ommd3076/Proejcts/arcade` on `codex/ui`, based on engine checkpoint `b9f3fa9`, published to `main` on 2026-10-02.

## Ownership and boundaries

- You are implementing the surrounding UI, responsive layouts, accessibility and motion. Preserve all eight games, two accounts, accepted engine behavior and current private-data boundaries.
- Read AGENTS.md, PRODUCT.md, planning/README.md, DESIGN.md, planning/UI-CONTRACT.md, planning/review/HAND-CRICKET-UI-PLAN.md, the fresh engine checkpoint report and this file. New direct owner decisions override older prose. Imported artifacts that label themselves approved are design candidates, not independent authorization to add features.
- Preserve `shared/games/`, `shared/protocol/`, `worker/`, `migrations/`, `src/sync/` and complete interactive boards under `src/games/`. Do not alter coordinates, hit mapping, rules, reducers, state machines, authority, recovery or accepted-event semantics to fit a picture.
- Existing board components and accepted game motion remain the protected engine surface. Size and frame them through their public interface. Style the outer shell and controls through semantic tokens without changing board geometry or input behavior.
- The match screen, auth presentation and secret-handoff presentation contain engine bindings. Refactor appearance only while preserving callbacks, privacy masking, pending handling and lifecycle behavior. Move reusable presentation into components instead of replacing those bindings.
- Root config/package changes and genuinely necessary shared-interface changes require a lead-managed lease. No two concurrent writers own the same file. If an engine capability is missing, record a concrete engine follow-up; do not fabricate it or implement a second authority in the UI.
- Do not deploy, reset data, remove tests, overwrite unrelated changes or merge this UI branch into main automatically.

## Read the whole design, not selected screenshots

Stitch project recorded by the design package: `projects/9099986947047806544`.

Existing local evidence:

- `assets/ui-references/`: owner tennis, tracker and supporting references. Open and visually inspect the files.
- `planning/design/stitch/SCREEN-LIBRARY.md`: screen IDs, themes and evidence mapping.
- `planning/design/stitch/evidence/`: the complete downloaded PNG collection. Inspect all relevant screens and all K1-K8 variants, not only Home or settings.
- `planning/design/stitch/REFERENCE-INTERPRETATION.md`, `VISUAL-DIRECTION.md`, `DESIGN-SYSTEM.md`, `REFERENCE-COMPARISON.md`, `REFINEMENT-LOG.md`, `MOTION-SPECIFICATIONS.md`, `BOARD-SPECIFICATIONS.md`, `IMPLEMENTATION-HANDOFF.md`.

This chat has no exposed Stitch MCP tool. During baseline verification, a real local source export arrived: 17 HTML files, K1-K8 screenshots and `planning/design/stitch/export/CODEX-HANDOFF.md`. Read every HTML source, its inline CSS/Tailwind configuration, referenced assets and font declarations. The source can be read without MCP. Consult `planning/review/STITCH-EXPORT-INVENTORY.md` for the actual package and limitations; do not treat the export as a complete responsive application or font license bundle.

If Stitch MCP is available in your new chat, use it for any remaining source retrieval. Otherwise use the existing HTML export and request only its missing assets/font files/licenses or genuinely missing design variants in one focused batch. Do not wait for MCP before reading and implementing the existing exported source.

Do not halt all implementation merely because direct MCP is absent. Inspect the complete local package, construct the real screen/state inventory and implement the unambiguous surfaces. Request missing export details in one focused batch while continuing independent work. Record source-fidelity gaps honestly.

Match reference composition, proportions, typography hierarchy, spacing, nested corners, pill shape and colors in real rendered output. Exported static HTML is a design source to adapt into the existing React application, not a replacement application or backend.

## Resolve known design drift

- Design influence: 60% tracker, 30% tennis, 10% playful accents. These are influences, not text-case percentages.
- Standard Light: spacious white/porcelain with bright mint, cyan, yellow and a restrained lime accent. Standard Dark: charcoal framing with readable colorful surfaces. Romantic Dark/Light: purple/plum and pink/blush variants with the same component anatomy.
- Themes belong to the viewer; piece ownership and Ludo colors remain independent. Preserve Light/Dark/System, OS changes and saved appearance settings.
- The owner's latest instruction is to implement the Stitch visual design. Its HTML specifies Plus Jakarta Sans reading text and Antonio/Barlow Condensed display variants; the newly exported quick reference nominates Barlow Condensed. Normalize to Plus Jakarta Sans for reading/controls and Barlow Condensed for short display titles, using verified licensed self-hosted WOFF2 assets and retaining notices. DM Sans/system sans remain fallbacks until those assets are available. Do not introduce a fictional THE EVOLUTION font, font-percentage formula, condensed reading text or uppercase functional labels merely because generated prose says so. Record this typography adoption explicitly when updating the older DM Sans-only UI contract.
- Use readable editorial headings; avoid tiny tracked functional labels or blanket condensed uppercase.
- Use one spacing and radius system. Nested corners follow outer radius minus inset; do not apply 32px indiscriminately to every element.
- Preserve labeled Home/Games/Us navigation; hide global tabs inside gameplay. Keep an obvious Back action and meaningful history behavior.
- Do not import wagering, fabricated partner quotes, advice attributed to the partner, Spectate, currency, avatar stores, leaderboards, artificial Ludo rounds, telemetry copy or unverified sensory controls from generated mockups.
- Display real names and actual game state. Do not hard-code sample Daniel/Sarah identities, static peer-online badges, ON/SAVED statuses or timers in games without clock semantics.

## Full implementation scope

Implement coherent presentation across:

1. Login/session loading, failed bootstrap and reauthentication.
2. Home: empty, invitation, one active match, multiple active matches, favorites/play-next and existing recap content.
3. Games catalog: all eight games and available modes.
4. Game detail/setup: correct configuration, saved slot/Resume, Sudoku selection and RPS format.
5. Invitations: waiting, accepted, Ready, decline, cancel and unavailable state.
6. Gameplay shells for all eight boards: names, turn/roles, actual score, relevant controls, focus/large-canvas framing, options and connection state.
7. Secret-game presentation: named Ready, selection, Lock pending, pass, waiting, both locked, Reveal, result and Next readiness. Preserve immutable locks and accepted-state transitions.
8. Lifecycle/recovery: leave-save confirmation, saved, Resume requirements, expiry, uncertainty, reconnecting, control transferred, version update required and auth required, wherever supported by the engine.
9. Completion/results: accurate winner/draw/forfeit/unscored reason, applicable scorecard and working rematch.
10. Us/records: existing statistics, separate Sudoku records, cricket records exposed by the API, recent results and honest unavailable/loading/error states.
11. Appearance/settings: theme family, device display mode, player preferences, accepted save/retry/conflict and logout.

Reuse and extend existing primitives rather than duplicating them: Surface, Button, IconButton, GameHeader, PlayerScoreStrip, BoardViewport, FocusModeToggle, ActionDock, SegmentedControl, ColourPicker, Sheet, InlineNotice, ResultPanel and NavTabs. Map actual names/paths before editing. Add a primitive only when an existing one cannot express the required behavior.

Use the actual CSS/token system in `src/theme/`. Do not install Tailwind because an imported handoff assumes it exists. Translate exported utility classes into that system. Never ship Tailwind CDN, unpkg latest scripts, disabled user scaling or remote sample content from the HTML. Preserve working routes/deep links; the exported route table does not describe the current router. Keep one component language and one Lucide icon family.

## Responsive and interaction contract

- Verify 320, 390 and 430 CSS-pixel portrait widths, short phone heights, tablet and 1280px laptop. Test 200% text/zoom, long names and wrapped error copy.
- Use dynamic viewport units and safe-area insets. Keep primary controls reachable above device chrome and keyboards.
- Boards are dominant. Dots, SOS and Connect Four keep large playable canvases with reachable outer positions and the existing input alternatives. Do not shrink board targets to fit decorative cards.
- Desktop uses bounded content and intentional columns, not a stretched phone or arbitrary huge empty regions.
- One dominant action per state. Group through spacing; keep secondary options in a proper accessible sheet. Do not add more dashboard boxes to fill space.
- Maintain focus, keyboard interaction, dialog focus restoration, meaningful labels and restrained live announcements.
- Every loading, pending, disabled, selected, rejected and recovered state needs visible non-motion feedback. Acceptance, saving and peer presence must come from engine/API facts.

## Animation implementation

Use the repository animate, better-ui, better-layout, mobile-native and accessibility guidance as relevant. Extend existing tokens and choose the cheapest suitable mechanism: CSS transitions for interactive states and Web Animations API for programmatic choreography. Add a motion dependency only for a concrete interaction the existing mechanisms cannot safely express.

- Immediate tactile press/selection feedback, normally 100-150ms; no animation delay before dispatch.
- Route continuity about 180-220ms, interruptible, with no board coordinate changes.
- Sheets about 240ms entry and a shorter exit; preserve focus management and dismissal.
- Short indicator movement/crossfade for segmented controls. Do not animate the entire layout on every selection.
- Score/turn transitions are brief highlights or crossfades; the real accepted state is already available.
- Reuse accepted board motion. No duplicate or recovered move replays, endless per-cell travel or motion-based readiness.
- Secret content is removed from visual and accessibility exposure immediately when concealed. Animate only the safe cover/chrome afterwards. Blur and fading private content are not a privacy veil.
- Reveal is presentation of a saved result. Never reveal before acceptance or advance state from animation completion.
- One restrained completion accent, then stable readable results. Keep repeatedly used interactions subtle.
- Theme changes do not smear every surface through simultaneous color transitions or change pieces/selection.
- Use explicit transform/opacity/stroke properties, not transition: all or repeated layout animation. Cancel animations/timers/listeners on navigation or superseding state.
- Reduced motion ships with every effect, including changes during a running animation. Use static or short fade/highlight feedback and identical information.
- Sound/haptics are not automatically enabled or promised; they remain separate capabilities unless already supported and authorized.

## Execution and verification

Implement the whole scope in coherent commits: tokens/primitives, shell/setup, gameplay framing/secret presentation, records/settings, then motion/accessibility/responsive refinement. There is no six-screen approval stop. Work autonomously through real rendering and fixes.

Read `.agents/skills/` only for relevant tasks. If delegation is used, obey the canonical repository roles, exact path ownership and three-specialist limit. Keep the owner-selected GPT-6 Luna model; do not silently change it.

Use the real local frontend plus Worker. Inspect browser DOM/accessibility state, actual interactions and animation recordings as well as images. Compare rendered screens against the owner references and mapped Stitch screens. A screenshot collection or passing build alone is not acceptance.

Build a coverage matrix of screen x state x theme x viewport. Cover all four Standard/Romantic x Light/Dark variants. Reuse representative invariant checks, but inspect every unique screen and difficult state; do not extrapolate the whole product from two screenshots.

Exercise actual Remote two-context and Together one-context flows, refresh, Back, reduced motion, interruption, pending/rejected actions, secrets, settings persistence and rematch. Preserve the eight-game regression suite. Tests using source mocks or renderToString remain labeled as such.

Run appropriate checks after each substantive packet, then final typecheck, lint, format:check, unit, contracts, components, build, actual Worker integration, Playwright and content verification. Wait for exit statuses. Do not disable tests or rewrite existing geometry to make snapshots pass.

Record before/after resource and input/frame measurements on representative Home and secret-game journeys. Fix measured UI regressions. The later comprehensive integration/optimization phase remains separate; do not claim faster performance from smaller assets alone.

## Completion package

Update a UI implementation report with exact changed scope, source/export availability, comparison images, state coverage, animation recordings, real test results, known engine dependencies and physical-device limits. Include source commit and artifact identity.

Finish with a reviewable UI branch and integration handoff. Do not report COMPLETE from imported Approved labels, historical test counts, static HTML, selected screenshots or background-launched tests.

## One-message kickoff

Implement the complete Private Arcade UI and animations now on codex/ui using this handoff. Read this entire document, inspect the full owner-reference and Stitch collection, retrieve source exports when available, preserve the frozen engine and board boundaries, and carry all screens and exceptional states through responsive browser verification and fixes. Do not stop at a proposal, six-screen pilot or screenshot-only review. Keep the selected GPT-6 Luna model. Do not deploy or merge automatically.
