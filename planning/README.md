# Implementation handoff index

Updated 2026-09-30. Core product/game/navigation decisions are resolved. The current request prepares skills/profiles and the execution handoff only; **application implementation has not started**.

## Read progressively

1. [PRODUCT](../PRODUCT.md): authored scope; [PRD](PRD.md): requirements and complete flows.
2. [DESIGN](../DESIGN.md): reference hierarchy, Standard/Romantic palettes and screen specifications; [UI-CONTRACT](UI-CONTRACT.md): identity/controls/motion.
3. [GAME-RULES](GAME-RULES.md): all eight deterministic outcomes, geometry and Sudoku modes.
4. [SYSTEM](SYSTEM-CONTRACT.md), [TRD](TRD.md), [TDD](TDD.md), [API](API-CONTRACT.md), [DATA](DATA-MODEL.md): authoritative state, reliability, security, modules and persistence.
5. [TEST-PLAN](TEST-PLAN.md), [ASSET-INVENTORY](ASSET-INVENTORY.md): concrete cases and qualified reuse boundaries.
6. [IMPLEMENTATION-PLAN](IMPLEMENTATION-PLAN.md), [TASKS](execution/TASKS.json), [STATE](execution/STATE.md), [OVERNIGHT-PROMPT](OVERNIGHT-PROMPT.md): 35-task sequence, resume and human starting instruction.
7. [Agents](../agents/README.md), [manifest](../agents/manifest.json), [skills provenance](../agents/SKILLS.md): twelve roles, seven installed UI skills plus our build skill; inherited owner-selected model.

Raw private_arcade_context.txt retains original scope provenance. Future agents use authored scope/current contracts instead of repeatedly rereading it. [CONVERGENCE](CONVERGENCE.md) is historical research/edge-case register; older palette/proposal wording is superseded.

## Owner outcomes and selected defaults

- Offline together play saves accepted state and pauses input until connected.
- Sudoku free numbered selection within Easy/Medium/Hard/Expert; completed markers, no unlocks.
- Unsafe Ludo landing captures exactly one token. Third consecutive six ignored/another roll, earlier moves retained.
- Competitive Sudoku clocks continue after Start through refresh/background/offline. Practice has explicit pause.
- A's regular Standard theme retains black/white with mint/cyan/yellow; B's Romantic is purple-dark/pink-light. Both initially Dark, either family and Light/Dark/System selectable.
- Tracker layout/typography primary; tennis roundness/spacing/tactility secondary.

Architect defaults close residual edges: lowest-ID capture; further sixes ignored until 1–5; fixed board maps; 250 independently validated launch Sudoku puzzles per group; unranked replay terminal exclusion; strict named together resignation; account family/device mode; one saved referee/versioned projection; reproducible session-bound CSRF bootstrap. [DECISIONS](execution/DECISIONS.md) labels defaults versus owner answers. No extra owner question round needed.

## Remaining execution evidence

All 35 application tasks are PENDING. Actual dependency/KDF resource compatibility, content import validation, implementation checks, rendered UI/motion, real-device PWA and deployment remain execution work. Files/metadata are installed and validated locally; Antigravity host discovery has not been verified. No server, app tests, launched worker, schedule or deployment is claimed.

All twelve original blocking design rows have contracts or bounded adoption gates. Important/deferred edge cases remain in CONVERGENCE and TEST-PLAN; completion of planning does not waive them. External phone/account access cannot be fabricated or replaced by a compilation pass.
