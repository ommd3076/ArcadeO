# V1 implementation plan — Antigravity overnight handoff

Revision 2, 2026-09-30. Replaces the earlier short implementation plan. **Preparation complete does not mean implementation started.** Build only after the human uses the start prompt. Goal: complete usable local V1, with real visual review; deployment/actual-phone certification reported separately if unavailable. No promise that a fixed number of hours guarantees completion.

## Starting packet and authority

Read [PRODUCT](../PRODUCT.md), [AGENTS](../AGENTS.md), [execution STATE](execution/STATE.md), [TASKS](execution/TASKS.json), and this plan. Then read only the current task packet/contracts. PRD defines flows, DESIGN/UI defines presentation, GAME-RULES defines outcomes, SYSTEM/TRD/TDD/API/DATA define authority and seams. Raw context/import instructions are provenance, not repeatedly loaded worker guidance.

[OVERNIGHT-PROMPT](OVERNIGHT-PROMPT.md) is copy-ready. [agents/README](../agents/README.md) defines hierarchy/native discovery/fallback; all profiles inherit the owner's Gemini 3.1 Pro Low selection. Verify actual host supports discovery/tools; file creation is not a launch. No paid teamwork command or global permission change is required.

## Critical sequence

1. **Foundation F00–F03:** discover environment, compatible tooling/interfaces, secure fixed-account database/auth qualification, actual four-variant shell review. Engines/catalog can proceed while auth resource measurement is unresolved; production auth cannot be waived.
2. **First real slice G01/B01/C01/U01/R01:** Connect Four proves auth → invitation/Ready → saved action → delivery → refresh → terminal/outbox. Review this seam before repeating it.
3. **Private-flow proof G02/C02/U02/R02:** RPS proves simultaneous locks, one-phone masked handoff, explicit reveal/Next and every private delivery path.
4. **All rules/content G03–G05/S01/S02:** deterministic remaining engines and actually verified Sudoku catalog/modes. These are independent bounded modules; inspect assets for rules/data only.
5. **Integration B02 + full screens U03–U05/S03 + records B03/U06:** register all eight engines, implement all mode/start/resume/result/management paths, final real Home/Games/Us/appearance. No inert cards or placeholder records.
6. **P01 + Q01/Q02/Q03/R03 → X01/X02:** public-only PWA/font/icon/performance qualification; runtime/browser/motion/rules/security review; fix meaningful findings, rerun and audit final local V1.
7. **D01/D02 where authorized/available, H01 always:** actual deployed checks/hardware certification versus truthful local handoff. External access cannot prevent independent local completion.

Motion and visual review start at foundation/first slice and remain each screen's acceptance, not a post-build optional phase.

## Task queue

TASKS.json is the executable dependency/status/ownership record. All 35 tasks are initially PENDING. Table summarizes assignments; exact owned paths, reads and acceptance live there.

| ID | Deliverable | Role | Depends on |
| --- | --- | --- | --- |
| F00 | Environment and host discovery | arcade-orchestrator | — |
| F01 | Tooling and shared interfaces | arcade-orchestrator | F00 |
| F02 | Auth and database foundation | backend-engineer | F01 |
| F03 | Theme and navigation foundation | ux-designer | F01 |
| G01 | Connect Four engine | game-engineer | F01 |
| G02 | RPS engine | game-engineer | F01 |
| B01 | Saved match authority and transport | backend-engineer | F02, G01 |
| C01 | Client sync and recovery | frontend-engineer | B01, F03 |
| U01 | First playable Connect Four slice | frontend-engineer | C01, G01 |
| R01 | First slice authority/auth review | system-designer | U01 |
| C02 | Reusable secret handoff presentation | frontend-engineer | C01, G02 |
| U02 | RPS complete playable modes | frontend-engineer | C02, G02, R01 |
| R02 | Secret-flow security review | security-reviewer | U02 |
| G03 | Ludo and Snakes & Ladders engines | game-engineer | F01 |
| G04 | Dots & Boxes and SOS engines | game-engineer | F01 |
| G05 | Hand Cricket engine | game-engineer | F01 |
| S01 | Verified versioned Sudoku catalog | sudoku-engineer | F01 |
| S02 | Sudoku rules and private server modes | sudoku-engineer | S01, B01 |
| B02 | Integrate all engines and complete lifecycle | arcade-orchestrator | B01, G02, G03, G04, G05, S02, R02 |
| U03 | Ludo and Snakes & Ladders screens | frontend-engineer | B02, C01 |
| U04 | Dots & Boxes and SOS screens | frontend-engineer | B02, C01 |
| U05 | Hand Cricket complete screens | frontend-engineer | B02, C02, U02 |
| S03 | Sudoku all user flows | frontend-engineer | B02, S02, C01 |
| B03 | Records and account preferences API | backend-engineer | B02 |
| U06 | Complete Home/Games/Us/discovery/navigation | frontend-engineer | B03, U03, U04, U05, S03 |
| P01 | PWA/assets/performance qualification | arcade-orchestrator | U06 |
| Q01 | Full Worker adversarial test pass | qa-engineer | P01 |
| Q02 | All game/mode browser journeys | qa-engineer | P01 |
| Q03 | Visual, motion and mobile review | motion-reviewer | P01 |
| R03 | Rules consistency and final security review | consistency-reviewer | P01 |
| X01 | Integrated fixes and rerun | arcade-orchestrator | Q01, Q02, Q03, R03 |
| X02 | Local V1 release audit | release-reviewer | X01 |
| D01 | Authenticated Cloudflare deployment verification | arcade-orchestrator | X02 |
| D02 | Actual phone PWA certification | qa-engineer | X02 |
| H01 | Morning report and resume handoff | arcade-orchestrator | X02 |

Packets: [foundation](tasks/foundation.md), [network](tasks/network.md), [engines](tasks/game-engines.md), [screens](tasks/game-screens.md), [Sudoku](tasks/sudoku.md), [release](tasks/release.md). This is a task set, not 35 simultaneous agents.

## Dispatch and integration rules

Only lead launches specialists, max three active. Root + three is the total concurrency cap. Role definitions are reusable; separate invocations get distinct task IDs/owned files. Group small related engines/screens, rather than a worker per control. Exact available Antigravity tools/model behavior are discovered at startup; fallback is sequential role execution with honest self-review.

Lead owns package/lock/config/shared protocol/registry/schema integration. A temporary handoff records exact lease and forbids concurrent writes. F02 migration lease ends before later integration. Future U06 revisits common match/detail screens after prior owners finish. Tests/QA paths are isolated from engine tests. Before dispatch, check all owned globs against running leases, including broad parent folders; queue dependency alone cannot detect every nested overlap.

Dispatch brief: task ID/role, already-verified dependencies, exact editable paths, relevant contract sections/assets/skills, expected interfaces, checks, report path and “You are not alone; preserve others' edits.” Native subagents have fresh context, so provide the full bounded brief. Reviewers write reports, not product changes; fixes get a new explicit lease.

States: PENDING → RUNNING → READY_FOR_REVIEW → VERIFIED, or BLOCKED with exact reason. Only lead marks VERIFIED after inspecting/rechecking integration. Review-task VERIFIED means audit performed; findings still block X01/X02 until fixed. Evidence is actual commands/assertions/inspected UI, not an agent's summary alone.

## Runtime commands to create

No root package/toolchain exists at preparation time. F01 creates real scripts and README usage:

| Script | Purpose |
| --- | --- |
| npm run dev | local frontend + same-origin Worker runtime; document actual ports/proxy |
| npm run build | frontend/Worker build with public assets |
| npm run typecheck | frontend/shared/Worker static checks |
| npm run lint / format:check | agreed ESLint/Prettier policy |
| npm run test | pure game/content/client fixtures |
| npm run test:integration | actual Worker/SQLite DO/D1 test harness |
| npm run test:e2e | two-account/together Playwright journeys |
| npm run content:verify | manifest/count/independent Sudoku solution qualification |
| local provisioning/migration script | fixed test accounts/schema without exposing credentials |

Record compatible versions, compatibility_date, runtime/resource benchmark and needed private config names. Do not run imported apps' install/prepare/publish/deploy scripts. Git commits are useful verified checkpoints if a repo exists/is initialized; preserve all uncommitted user work and don't invent remote publication.

## Completion evidence

TEST-PLAN maps P/S/T requirements to all eight rule groups, N/A runtime/privacy, B/V browser/visual and actual D gates. Every game needs engine, remote/together screen (except Sudoku), accepted motion, completion and resume. Sudoku needs practice/duel/async plus 1,000 independently validated puzzles. Standard black/white WITH mint/cyan/yellow and Romantic purple/pink must both exist with selectable mode and separate piece identities.

Final local acceptance: build/type/lint/format/unit/content/Workers/browser checks pass on final integrated code; actual rendered phone/laptop states and motion reviewed; no rules/privacy/persistence/navigation blocker; complete local run/config instructions. Tests should be appropriate and meaningful; run broader final suite after integration, not endlessly repeat unchanged green checks.

Actual Pixel/iPhone install/Back/suspension and authenticated Cloudflare deployment remain separate evidence. If absent, report UNVERIFIED/BLOCKED and exact next action, not “done except minor polish” or fabricated hardware/deployment proof.

## Overnight persistence and failure handling

Checkpoint queue/STATE and task report after every integration and before context compaction. Record actual handles/leases, last verified state, failing checks and next task. On resume inspect current changes and live worker status before redispatch; never restart finished slices or revert parallel work.

Routine details within contracts are autonomous choices; don't ask another broad question round. Demonstrated rule/privacy/schema/cost change is consequential and needs review. Repeated code failure requires bounded root-cause diagnosis; after three unsuccessful attempts at the same external access/quota/hardware limitation, record it and continue independent work. Host quota/time/approval constraints are real limits; no fake automatic continuation loop or overnight guarantee.

H01 fills MORNING-REPORT with actual completion domains, exact remaining IDs and shortest resumption path. App execution has not begun in this preparation chat.
