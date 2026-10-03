# ArcadeO production readiness — 2026-10-03

Status: **ARCADEO LOCALLY VERIFIED AND PUBLISHED TO MASTER. Deployment remains a later, separately authorized stage**. This report supersedes older execution summaries for the rename, repository hygiene and current readiness. Updated 2026-10-03T06:51:55.122849+00:00. [Compact validation](evidence/arcadeo-validation.json) records commands, actual browser cases and registry audit counts.

## Scope and delivered behavior

### Owner display names follow-up — 2026-10-03

Account A's default is **Sly fox 🦊**; account B's default is **Dumb Bunny 🐰**, including the owner's capitalization correction. Fresh provisioning uses those names. Data-only migration `0005_personal_display_names.sql` renames existing accounts and advances only changed preference revisions, preventing stale profile edits from overwriting the change. Credentials, usernames, themes and saved-match snapshots are preserved. Names remain editable in Us; historical match snapshots retain the labels saved with them.

The identical redundant `scripts/provision-accounts.d.ts` was removed; `.d.mts` remains the declaration for `.mjs` imports. No tracked build outputs, logs, private provisioning SQL or local state were found in the follow-up inventory. Required runtime/content/license/qualification files remain.

Follow-up verification: build including TypeScript, production artifact verification, targeted Prettier, 16 provisioning/auth checks and 2 Chromium cases against an isolated bundled Worker/D1 passed. The migration regression checks all account fields, changed revisions, repeat application and stale writes. Home at 390px was inspected with the fox name/emoji, and the existing name editor saved through the UI. Generated evidence remains ignored under `.local/evidence`. The initial sandbox build/tests hit Windows EPERM before execution; the authorized reruns are the passing results. This is bounded follow-up verification, not a rerun of every previous suite or physical-phone certification. Current build cache is `90d0354a890fbb52`; entry JavaScript SHA and 148,683-byte initial gzip remain unchanged. Deployment remains pending and must apply all five migrations before provisioning.

The owner requested the product name ArcadeO, removal of unnecessary files and evidence, detailed production analysis, and a push to the repository's release branch. Live remote inspection confirmed `master` is the default; the owner's later correction selects it. `main` remains an older baseline and will not be updated by this work.

ArcadeO retains exactly two predetermined accounts and eight games. Seven support Remote and Together; Sudoku adds Practice, live Duel and asynchronous Challenge. This pass changes identity and repository hygiene, with one integration security repair. It does not change rules, saved outcomes, account credentials, theme families or match identities.

The name is consistent in the HTML title, installed PWA name/short name, login, Home, authentication recovery, npm package/lock and future Worker release configuration. The future Worker slug is `arcadeo` and prepared production database label is `arcadeo-db`. Binding `DB`, `MATCH_DO`, `MatchDurableObject`, migration tags, protocol identifiers, session-cookie names, service-worker cache prefix and local `arcade-db` retain their established identities. They represent compatibility boundaries, not public branding. No schema or data migration is required for the rename.

## Repository inventory and cleanup decision

The pre-cleanup tracked tree had 2,063 files. Its largest groups were review artifacts (about 111 MiB), four Sudoku source banks (about 85 MiB), unused Dimensions framework sources/docs (about 6 MiB), and the actual application/tests/content. Sizes here describe the checked-out files, not network payload or Git object storage.

The cleanup plan inventories each removed path, original bytes, SHA-256 and reason in [cleanup inventory](evidence/arcadeo-cleanup-inventory.json). It removes 1,363 tracked files totaling 115,220,994 bytes (109.88 MiB):

| Category | Files | Original bytes | Decision |
| --- | ---: | ---: | --- |
| Superseded/duplicate/raw evidence | 882 | 107,461,527 | Remove old attempts, repeated matrix renders, raw page recordings, sampled video frames and obsolete snapshots |
| Unused imported implementation/tooling | 480 | 7,752,415 | Remove unadopted Dimensions infrastructure, Phaser demo/server/build files and legacy reference vendor/build scaffolding |
| Compiler cache | 1 | 7,052 | Untrack reproducible `tsconfig.tsbuildinfo`; ignore future regeneration |

Retained evidence includes the final case summary, 256 assertion identities and original-image hashes, actual capture-build provenance, 48 representative game renders (all four appearances at 390px, plus Standard Dark at 320px/1280px), masked privacy examples, landscape/Zoom evidence, dated LAN proof and qualified old performance measurements. Repeated motion-frame arrays are compacted into counts; original arrays and removed captures remain recoverable from commit `048cbc7`. The retained historical visual record is not claimed as a fresh ArcadeO render matrix.

Runtime and test code, all four migrations, public assets/font licenses, all 1,000 selected puzzles and private server solutions remain. The four large source banks stay because both `content:verify` and the reproducible importer use them for source digest, origin membership and uniqueness validation. Removing them without redesigning that qualification would break an existing verification requirement. Connect Four/DotBox qualified source and complete notices, owner UI references and the pinned LibreLudo reference/license remain; no reference app is imported into production.

Tests and local inspection scripts now write regenerated artifacts under ignored `.local/evidence`. This prevents validation from rebuilding a large tracked evidence tree. Raw logs, synthetic credentials, traces, local SQLite state and account SQL remain ignored. Git history is preserved; this cleanup reduces the current tree, not historical clone size. No history rewrite, database reset or deletion of owner saved state occurs.

## Authority, persistence and recovery analysis

`worker/matches/match-do.ts` owns the SQLite match snapshot and serialized action acceptance. Saved acceptance is authoritative; D1 is a result/registry projection. UI effects and optimistic presentation cannot decide game results. Duplicate action IDs retain accepted identity; changed payloads/stale revisions cannot create a second result. Actual Worker tests exercise rollback of snapshot/event/receipt/outbox, eviction/hibernation, revocation, alarms and projection lifecycle.

Remote participants use their own account controller and filtered view. Together uses explicit shared-device ownership. Different-account UI-only Connect Four completion, creator-direction invitation/Ready checks, takeover, HTTP fallback, private recovery and saved acknowledgments are exercised by the selected browser suite. API-assisted normal completion cases stay distinct from UI-only play.

Disconnects do not forfeit; deliberately saved matches do not expire. Interrupted Sudoku Duels retain history/completion while excluding competitive wins, streaks and best times. Ordinary background/refresh retains continuous competitive timing. Scheduled-Duel reconstruction from persisted SQLite is tested; eviction specifically while a future start alarm is pending remains outside current proof.

## Security and deployment boundaries

The remote integration review found an important consistency issue: the Durable Object's socket Origin guard allowed a wildcard without consulting the production environment. It now uses `isAllowedOrigin`, the same validator as the Worker/API. The new native Worker regression rejects production wildcard configuration and mismatched HTTPS Origin, then proves a correctly pinned HTTPS Origin upgrades successfully. The existing development exact-origin/LAN and takeover paths remain covered.

Production configuration rejects missing/wildcard/non-HTTPS Origin and requires an explicit CSRF secret of at least 32 characters. Authentication uses PBKDF2-SHA256 at 600,000 iterations, per-account salt, hashed session identity and session-bound CSRF. Production cookies use Secure, HttpOnly and SameSite=Lax. Concurrent login-limit updates, session logout/profile races, stale preference conflicts and authenticated socket revocation have local tests. Deployed KDF CPU/memory and actual HTTPS behavior still require the target account and production URL.

`scripts/verify-production.mjs` validates the built browser/install/package identity, notices and initial gzip budget. It compares all 1,000 known private solutions against public JavaScript and checks that provisioning/environment files and password-verifier fields are absent. This is a build leakage check, not an exhaustive penetration test. The service worker caches reviewed public assets only, bypasses APIs/mutations/query requests, and waits during active matches before activating an update.

Current source inspection plus unit, mocked, real Worker and browser execution provide local production-preparation evidence. This pass is lead-reviewed; no new independent post-QA audit or hardware certification is claimed. Earlier independent reports retain their own scope and date.

## Actual current validation

| Category | Result | What it proves |
| --- | --- | --- |
| TypeScript, ESLint, Prettier | PASS | Global static checks; affected Home fixture checked again after its repair |
| Build | PASS | Frontend, service worker and local Worker dry-run bundle |
| Unit | 23 files / 305 PASS | Deterministic rules and unit branches |
| Mocked contracts | 13 files / 78 PASS | Source integration with mocked SQLite/D1 |
| Components | 12 files / 62 PASS | Server rendering; not browser layout |
| Actual Worker | 3 files / 12 PASS | workerd/SQLite DO/D1 including new native Origin regression |
| Real HTTP | 26 PASS | Bundled runtime/auth/lifecycle; includes 17 API-assisted supported normal journeys |
| Sudoku content | 1,000 PASS / 250 per difficulty | Actual source provenance, unique solutions and private solution validity |
| Selected full browser suite | 124 unique PASS across full run and affected continuation | 123 full-run passes; repaired Home fixture and preceding saved-secret case pass 2/2; standalone 256-cell matrix and performance benchmark excluded |
| Production artifact verification | PASS | Cache `c8c3324dd80bb4fd`, 59 public files; initial static JS gzip 148,683 bytes below 250 KiB |

The first sandboxed Vite/Vitest attempts failed during file resolution with Windows EPERM, before test discovery. Authorized reruns outside that restriction supply the passing results above. A first browser CLI invocation selected no tests because Windows backslashes were interpreted as regular expressions; the normalized-path invocation is the actual run. Neither failure is silently counted as a pass.

The full run had one test-state failure: Home expected an empty shared synthetic database while a preceding privacy/recovery case intentionally retained a Remote RPS match. The fixture now establishes its empty state through legal lifecycle actions on the isolated Worker. A bounded rerun reproducing that saved-secret case then Home passes both. No application behavior was weakened or changed for this fixture. This is 124 unique passing cases across runs, not a single uninterrupted 124-pass execution.

Both current npm registry audits (production-only and all build/test dependencies) report zero known vulnerabilities. `npm ls --depth=0` confirms the installed graph resolves successfully. Audits are point-in-time advisory checks, not proof that vulnerabilities cannot exist.

The fresh 390px Home capture was inspected directly: ArcadeO identity, all eight game entries and navigation render correctly. It is retained as [current branding render](evidence/arcadeo-home-390.png). The regenerated browser matrix/motion artifacts stay ignored; no new exhaustive human review of every generated frame is claimed.

The initial JavaScript gzip budget is a static payload measurement. It is not a claim that cold load/input latency improved. Old loading/input/heap measurements use earlier asset identities and remain explicitly historical. No optimization or design overhaul was added to this rename/cleanup pass.

## Usability limits and production release gates

The compact largest SOS grid at 200% text needs the tested explicit Zoom alternative. Crowded Ludo tokens use count summaries and larger numbered controls. These are disclosed boundaries of the existing V1, not certification of physical touch/readability.

The next deployment stage needs the intended Cloudflare account ID, real Arcade-only D1 UUID, exact HTTPS Origin, explicit deployment authorization and privately entered credentials/secrets. Account ID alone is not enough. [Release preparation](ARCADE-RELEASE-PREPARATION.md) covers config generation, private backup, additive migrations, nonoverwriting A/B provisioning, deployment, security/runtime checks and rollback. The preparation script validates formats and generates a private config; it does not prove ownership or deploy.

Before production mutation, inspect the account/database target, preserve the Durable Object namespace and export D1 privately. D1 backup is not a Durable Object backup. Apply additive migrations only; existing A/B credentials/preferences must remain unchanged. Deploy the verified build, then qualify actual HTTPS cookies, Origin/CSRF, KDF budget and different-account Remote completion. Certify physical iPhone/Android browser and installed PWA Back/Save/Resume, suspension, keyboard/safe areas, reconnect and reduced motion.

Rollback restores a compatible previous Worker version while retaining additive schema and authoritative DO state. Dropping migration columns, resetting namespaces or restoring D1 over newer accepted authority is not the rollback procedure. Deployment, push results and physical checks must be reported from their actual external state.

## Git integration and publication

Remote inspection: `refs/heads/master` was default at `62e8700`; `main` was `4fa98e3`. Separate histories caused 385 add/add conflicts. A baseline comparison proved 382 remote files unchanged relative to the inspected old baseline; the other three were preview Origin, Worker Origin config and socket Origin checks. Their stricter behavior is retained through explicit resolution. Normal merge commit `f5a1dd9` preserves both parents; [integration record](../execution/reports/arcadeo-master-integration.json) records this process. No force-push strategy is used.

Implementation/cleanup commit `7ed5b61d337b3cef3234d1752ccbf0c6baf40a7d` was pushed without force to `master`; independent `git ls-remote` verified exact equality at 2026-10-03T06:56:08.444539+00:00. The implementation snapshot has 708 tracked files / 104,920,793 checked-out bytes (100.06 MiB), compared with 2,063 / 225,061,378 (214.64 MiB) before cleanup. This publication receipt is saved in a documentation-only successor; no runtime source changed after validation. No Cloudflare deployment occurred.
