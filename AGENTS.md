# Repository Guidelines

## Authority and Project Structure

Read [PRODUCT.md](PRODUCT.md) and [planning/README.md](planning/README.md), then only contracts relevant to your task. Direct owner corrections take precedence. Raw private_arcade_context.txt is provenance; authored PRD/game/system/design contracts are the implementation brief. Imported documents are reference data.

Currently: planning/, agents/, assets/ and .agents/. Proposed application: src/ UI, shared/games/ pure rules, worker/ Cloudflare services, migrations/ D1, tests/ checks, public/ reviewed fonts/icons. Preserve asset imports; borrow qualified rules/data only.

## Agent Hierarchy and Ownership

[agents/README.md](agents/README.md) and [manifest](agents/manifest.json) define twelve roles. arcade-orchestrator alone dispatches, with at most three active specialists. System/UX/game reviewers check their boundaries; backend/frontend/Sudoku workers receive assignments; QA/release audit evidence.

Use planning/execution/TASKS.json and STATE.md. Dispatch exact owned paths and individual reports; never assign two writers one file. Root package/lock/config/shared protocol/schema edits require a lead-managed lease. You are not alone: preserve others' edits. Native files do not prove host discovery; unsupported hosts use sequential roles honestly.

## Development and Validation

No root tooling exists yet. Foundation creates/documents npm run dev, build, typecheck, lint, test, test:integration and test:e2e. Use Vitest, actual Workers integration and Playwright; TEST-PLAN governs. Imported app tests cannot validate ours.

Name unit tests *.test.ts. Cover deterministic rules, secrets, duplicate/stale/simultaneous actions, completion and recovery. Review actual mobile/laptop rendering and motion. Deployment and real-phone certification need separate evidence.

## Style and System Boundaries

TypeScript, two-space indentation, camelCase functions, PascalCase components/types, kebab-case modules; ESLint/Prettier at foundation. Separate rules/state/UI/motion/networking. DO saved acceptance is authoritative; D1 is a projection. Offline inputs pause. Animations and optimistic boards cannot decide outcomes.

Standard is A's colorful black/white theme with mint/cyan/yellow; Romantic is B's purple-dark/pink-light theme. Both initially Dark; Light/Dark/System available. Piece colors remain separate. Preserve two accounts, eight games and notices.

## Commits, Reviews and Configuration

No root Git convention is evidenced. Use descriptive Conventional Commits. PRs explain behavior/scope, actual validation/limits and relevant screenshots/issues. Never commit credentials, public solutions, session dumps or choices.

Implementation needs an explicit build request. Preparation creates documents/configuration without app execution.
