# Private Arcade V1 — Overnight Finish
Date: 2026-10-03. Owner-authorized preparation and implementation in a new Codex chat.

## Outcome and authority
Finish the existing app so two different accounts can actually play synchronously from a phone and PC, with complete game loading, navigation, saved recovery, polished controls/motion and release preparation. Do not stop at attractive screens, passing unit tests or API-assisted game completion. Do not restart the product or import another application's runtime.

Read AGENTS.md, PRODUCT.md, planning/README.md and this brief, then only relevant contracts. The owner answers below supersede conflicting older plans/code. Original context and imported assets are provenance. The old Antigravity handoff's planning-only/build-failed status is historical.

Execute the 60 tasks in planning/execution/OVERNIGHT-TASKS-2026-10-03.json. Validate the 300 cells in planning/execution/OVERNIGHT-ACCEPTANCE-2026-10-03.json. The existing TASKS.json links this current queue; keep earlier task/report history. Each cell needs an actual assertion/evidence reference; arithmetic, screenshots existing, or a previous VERIFIED label is not proof.

## Owner decisions and scope
- Exactly two accounts and eight existing games. Seven shared games have Remote/Together; Sudoku has Practice, Live Duel and Async Challenge. Preserve accepted board geometry, grid variants, rules versions, existing saves and immutable completed outcomes.
- The reported phone/PC failure used DIFFERENT accounts, A and B. Reproduce that setup first, not just the same-account takeover scenario.
- Connection loss never awards a loss. Keep accepted progress and pause submissions. No offline action ledger or client authority.
- Saved matches remain resumable until completion or explicit abandonment. Remove automatic 72-hour saved expiry and 30-minute disconnect forfeits. Still-saved old snapshots must follow the new policy; do not resurrect already terminal matches.
- A deliberately saved/resumed Sudoku duel is history-only: preserve its result/completion markers, exclude competitive wins, streaks and best times. Interruption is monotonic. Ordinary refresh/background/network loss keeps the original competitive clock running; do not conflate it with deliberate Save.
- Together Hand Cricket v2 keeps batting until equal-number OUT; first OUT swaps batting/bowling, second OUT compares totals. Preserve Remote/legacy rules. Numbers 1–10 for new v2 matches.
- Ludo: six enters yard, exact finish, one lowest-ID opponent captured on unsafe landing, no blockades, deliberate legal-pawn selection, third/further consecutive six ignored with reroll until 1–5, preceding moves retained.
- Standard for A is colorful black/white with mint/cyan/yellow. Romantic for B is purple-dark/pink-light. Both initially Dark; Light/Dark/System and either family remain selectable. Piece colors are separate.
- Tracker hierarchy is primary; tennis roundness, spacing and tactile objects are secondary. Keep the reviewed current font roles and layouts; refine readable composition rather than invent a new identity.
- Interpret the owner's phone-navigation dictation as Back and leave-game controls. No billing, store, new authentication provider, bots, public accounts or extra games.

## Current evidence and reported/source-supported defects
Inspection baseline: main at 4fa98e3; recheck actual HEAD, diff and active tasks at start. The existing runtime-results.json modification is fresh test evidence, not application code; preserve it. Both referenced chats were idle at inspection.

Fresh root checks: typecheck, frontend/service-worker/Worker dry-run build, 274 pure tests, 61 source/mocked contracts, 46 server-rendered components, 4 actual Worker durability tests and 26 real workerd/SQLite DO/D1 HTTP cases pass. One targeted four-appearance responsive/reduced-motion browser case passes. The full browser suite was not freshly rerun in this preparation. Several existing completions use API helpers, and current live UI defects are not contradicted by those passes.

### First blocker: cross-device Remote play
The A/B failure is reported, not yet reproduced. Supported paths to test before selecting a repair:
1. scripts/dev.mjs restricts ALLOWED_ORIGIN to http://localhost:5173 while a phone uses http://PC-LAN-IP:5173. GET bootstrap/views may work but Accept, Ready, moves, takeover and WebSocket Origin checks reject. The latest preview LAN fix does not fix dev. Make the actual LAN dev command work with the correct development cookie/Origin settings. Production must retain exact Origin and Secure HTTPS cookies; local wildcard behavior must not leak into production.
2. Raw crypto.randomUUID remains in game-detail.tsx creation/discard, sudoku-list.tsx creation/discard and match.tsx publication. HTTP LAN may lack it. Reuse shared/utils/uuid consistently; do not introduce weak random move/dice authority.
3. Remote readiness labels read participants.ready, but accepted readiness is stored separately in snapshot.readiness. Creator creation metadata can claim ready while the DO is not ready. Return/render canonical accepted readiness and invitation state.
4. Accepted/rejected replies update the latest view without consistently refreshing controllerStatus. The initiating socket may not receive its broadcast, so stale local control can persist. Derive viewer capability consistently on every snapshot/event/accepted/rejected/control response.
5. Sudoku already has ACCOUNT-KEYED playerControllers. Preserve simultaneous independent A/B control. Global controllingAccountId changes must not falsely tell the other account that its control was taken.
6. Continue-on-device errors hide backend codes/latestView and lack pending disable/reconcile handling. Distinguish auth/Origin/CSRF failure, stale generation, unavailable backend and actual viewer control loss.
7. Seeing Continue on a normal Remote turn game warrants checking delivered mode/game and stale served artifacts; the CTA is currently restricted to Together/Sudoku. Together is genuinely a one-device mode, not a remote-control architecture.

First gate: two isolated accounts, one phone-size context and one PC context, one real match, all invitation/Ready/moves via UI, no reloads or API-assisted progression. Verify both live views and terminal result. Repeat invitation/first-action no-reload paths across all remote games; verify simultaneous secret locks and Sudoku entries. Test normal WebSockets and forced HTTP fallback.

### Saved-state integration
Backend offers match.leave-save and match.resume, but current UI invokes neither and lists hide saved matches. Saved deep links can expose controls despite a non-active lifecycle.
- Show saved games in Home/setup/Vault with Paused/Resume and actual participant readiness.
- Derive playable controls from accepted active lifecycle, legalActions, connection, control and pending state.
- Keep transport/control pause separate from gameplay lifecycle gating: Accept/Ready must work while waiting and Resume must work while saved when legal. Do not globally disable these recovery actions merely because the board is not active.
- Practice and unpublished Challenge resume by their sole active participant. Accepted Async Challenge resumes the receiver independently of the completed sender. Remote/Duel resume requires the correct two acknowledgments; Together uses its controller.
- Back preserves state. Leave and save dispatches the accepted save action. Resign and unscored abandon remain distinct explicit confirmations and legal-action gated.
- Fix the current solo resume path requiring both A/B and the unsupported Together-Sudoku regression fixture.
- Stop automatic expiry/forfeit helpers from mutating current matches; preserve outbox/projection/auth cleanup alarms.

### Record and transport correctness
- Carry the existing interrupted boolean from authoritative Sudoku state into result eligibility, outbox, an additive migration after 0003, D1 Sudoku records and applicable shared queries. No interruptedCompetitive alias. Preserve history; backfill only supported known metadata.
- Shared stats/streaks and best-time queries must exclude deliberately interrupted duels. DO outcome/history remains visible.
- Separate transport HTTP errors/malformed JSON/timeouts from game Accepted/Rejected envelopes. Keep uncertain action IDs/payloads and resolve receipts before replay; never reroll under a new ID. Handle 401/403/404/409/429/503 with useful feedback.
- Make login failure-window counters atomic under concurrent requests.
- Serialize all remaining authoritative lifecycle transitions or prove equivalent atomicity; terminal result/version/outbox must change exactly once.

## Complete UI and nonfunctional requirements
Every route and supported state must offer a clear next action. Audit Home, Games, setup, match, Sudoku picker/attempt/challenge, Us/records, appearance, login and every sheet.

### Small controls and navigation
- Replace Ludo text color selects with the existing labeled swatch pattern: sample, readable name, selected checkmark, named owner, unavailable/opponent-in-use explanation. Use named player segmented controls where appropriate.
- Style real RPS-format/library selects with theme-aware surface, chevron, 44px hit area, focus and readable options, or use existing segmented controls for small finite choices. A labeled initial choice prompt is legitimate; no fabricated options.
- Every displayed selection must submit the actual setting and persist at the documented scope. Cover network failure and preference/color conflicts without falsely showing Saved.
- Avoid swallowed identity fetch failures and indefinite Account A/B placeholders. Show known authenticated names, loading and actionable Retry where necessary.
- Keep a safe-area sticky match header so Back/options remain reachable. Track app-local history; an external browser history entry is not a valid internal Back destination. Deep links fall back to Games.
- Add visible Back/Leave/Resume flows for iPhone browser and standalone use. Android Back closes the top sheet before route navigation. Leaving must preserve secrets and pending acceptance safely.
- Fix Return Home routing, legal-action visibility, repeated clicks, offline disable rules and progress labels on takeover/resume/destructive actions.
- Distinguish invitation acceptance from Ready. Show both names and accepted readiness; do not tell a user to wait when they must still act.
- Verify bottom-bar reserve against actual height, keyboard, landscape, safe areas, text scaling and long content. A full-page screenshot's fixed-bar position alone is not an overlap proof.

### Motion as behavior
Reuse CSS/SVG/Web Animations and existing tokens; no heavy animation/state library. Immediate press feedback; accepted moves usually 200–600ms; long travel capped about 1200ms with settle/skip. Shared controller exposes explicit settlement on reconciliation/offline/navigation/backgrounding and live reduced-motion changes.
- Motion is derived only from saved event IDs/effects. Duplicate/replayed events cannot repeat moves; catch-up snapshots settle immediately.
- Repair secret reveal timers/state when another round arrives, so an overlay cannot hang. Reduced motion skips countdown/travel while showing equivalent actor/result/next-action information.
- Secrets disappear synchronously from pixels and accessibility tree before any curtain animation. Resume refresh/blur masked with the correct unfinished chooser.
- Ludo needs original dimensional pawns, numbered/readable stacks up to eight, paths through its OWN ring/home map, dice-element feedback, capture-return, home arrival, bonus/no-move and one restrained completion treatment.
- Preserve accurate targeting: settle or temporarily suppress board targets during local travel, while Back/settle remain usable. Another device never waits for this animation.
- Finish disc drop, Dots/SOS strokes/scoring, Snakes/Ladders transitions, Sudoku digit/error/completion feedback and RPS/Cricket reveal using actual effects.
- Fix broken spinner keyframes or use a working lightweight indicator. Stabilize sheet focus during background rerenders; support interruptible exits and return focus.
- Clear resolved action errors and cancel timers/listeners/animations on unmount. Theme changes do not smear every surface.

### Performance, security and release preparation
- Public-only service-worker caching: exclude API/private views/choices/solutions. Precache required shell and USED fonts, not all lazy routes. Handle cold offline/stale chunks with reconnect/retry instead of blank screens; updates never force active-game reload.
- Load necessary game chunks only; paginate records/puzzles; no unbounded polling/history. Visible HTTP fallback uses bounded backoff; background pages stop unnecessary polling. Preserve native socket hibernation/outbox retries.
- Measure cold/warm loading, input, frame intervals and navigation resource lifetime on the same conditions. Initial app JS target remains <=250KiB gzip excluding fonts. Record results honestly, including regressions; bundle reduction is not proof of faster input.
- Preserve two-account session/CSRF/revocation/secret redaction and immutable acceptance. Qualify KDF vectors/local Worker behavior and prepare deployed CPU/memory qualification as a separate gate.
- Prepare an Arcade-specific Cloudflare target/account_id, real D1 binding, additive migrations, exact production Origin, secure secrets and non-overwriting A/B provisioning. Do not modify other projects/global login or reveal credentials.
- Unknown app/game/match routes need authored not-found/retry/auth states; missing assets and API routes must not masquerade as SPA HTML success. Add lazy-route error boundary and bounded startup recovery.
- Prepare release instructions/backup/rollback and account-switch steps. Owner intends a new Cloudflare account under the existing login; multiple accounts are supported. No production deployment until account access and explicit release authorization are available.

## Agent execution: exactly twelve bounded submissions
Lead is GPT-6.1 Sol with High reasoning. Use GPT-6 Luna for all twelve specialist submissions; actual native tools/handles, not files labeled agents. fork_turns=none allows explicit model selection; give each complete bounded packet and current interfaces. Only the lead dispatches. At most THREE specialists active. Never assign two writers the same file. Roles are loaded from agents/profiles, not blindly from old Antigravity entrypoints. Preserve others' work.

Assignments A01–A12 are in the task queue, five tasks each:
A01 system/contract review; A02 remote/control backend repair; A03 saved/ready/navigation UI; A04 game consistency review; A05 Sudoku/records repair; A06 auth/error backend; A07 controls/surface UX; A08 shared/game motion; A09 Ludo finishing; A10 loading/PWA/performance; A11 actual runtime/browser QA; A12 independent release/security/visual audit.

Reviews are bounded read-only reports; production fixes receive an explicit writer lease. Return READY_FOR_REVIEW with changed paths, actual checks/evidence and limits. Only lead marks VERIFIED. Native failure falls back honestly; do not claim twelve independent submissions from sequential self-review.

Suggested rounds after a small interface freeze:
- Round 1: A01/A04 review then A02 + A03 + A09, with root interface coordination.
- Round 2: after overlapping path leases release, A05 + A06 + A07.
- Round 3: A08 + A10 while lead integrates earlier repairs.
- Round 3: A08, then dependency-ready A10, while lead integrates earlier repairs.
- Round 4: A11 and A12 on the final integrated build. Remediation returns to existing owners; do not skip failed gates.
The 6–7-hour overnight target guides concurrency, not false completion. Use saved state/continuations; do not sleep to simulate work.

## Verification and completion
300 local acceptance cells = 256 representative game/appearance/width/motion combinations + 44 targeted security/recovery/interaction/performance scenarios. Select each game's supported mode; test the 17 complete supported game/mode journeys separately. Extend adversarial fixtures for new behavior rather than mirroring implementation.

Use isolated synthetic accounts and state. Do not play/reset the owner's saved matches. No secret/session/cookie dumps or sensitive browser traces in committed evidence. Record API-assisted finishes separately; UI-only no-reload remote gates cannot use API helpers to progress gameplay.

Run appropriate slice tests during work; once integrated, build/typecheck/lint/format, unit, contracts, components, Workers/HTTP, full Playwright and 1000-puzzle verification. Inspect actual rendered default/all-theme mobile/laptop screens and sampled motion, not merely screenshot paths. Review final diff for unintended engine/geometry/scope changes.

Start from actual current state, create/reuse codex/v1-finish (unless owner made another relevant branch), preserve dirty edits and commit verified changes in logical commits. Do not merge/publish/deploy as an implied consequence of tests. Persist task queue, acceptance ledger and STATE after each integration or before compaction.

Write planning/execution/MORNING-REPORT.md and planning/review/OVERNIGHT-FINISH-REPORT-2026-10-03.md: implemented behavior; actual checks and evidence; unresolved exact IDs; physical-device and deployed checks explicitly distinct; account/setup steps and copy-ready continuation. Keep original product scope. A worker pass, staged file, mocked test, browser emulation, dry-run or created thread is not full release certification.
