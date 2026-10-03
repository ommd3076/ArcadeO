# Private Arcade V1 final local handoff

Updated 2026-10-03T04:57:34.156160+00:00. Status: **V1 LOCAL CLOSED WITH DEFERRED AND EXTERNAL GATES**.

Branch `codex/v1-finish`, baseline `4fa98e3`, application source `7f82b2a`, public cache revision `78decb9c6adb25d0`. Twelve original native GPT-6 Luna High submissions ran under the GPT-6.1 Sol High lead with at most three active specialists. Later commits record tests, evidence, handoff and LF checkout policy; application content remains unchanged from the final tested bundle.

The owner instructed immediate V1 closeout: finish the current validation, repair release blockers only, defer further UI polish/animation, performance and broad audit cycles to V2, save this handoff and stop. No release-blocking application failure remains in the selected local checks. Production and physical-phone certification remain open.

## Implemented behavior

Different-account Remote play uses canonical accepted invitation/Ready state and each account's own controller. Both takeover directions preserve the peer's Sudoku input. Exact LAN development Origin and safe UUID creation work outside HTTPS without weakening production configuration. HTTP fallback pauses in the background and delivers accepted moves to the peer without reload.

Connection loss no longer awards an automatic loss; saved matches have no expiry. Resume acknowledgments follow the actual Practice, sender Challenge, receiver Challenge, Duel, Together or Remote participants. Deliberately interrupted Duels remain in history and completion markers while excluded from wins, streaks and best times. Additive migration 0004 preserves explicit legacy metadata. Ordinary refresh/background/offline retains continuous competitive timing. Actual scheduled-start alarm snapshots expose only each Duel participant's cells without inventing an action/version.

Navigation and controls include visible Back, app-local deep-link fallback, legal-action-gated Save/resign/abandon, named color swatches and mode-aware Home/setup/Vault Resume. Accepted motion settles under offline/background/navigation/reconciliation/live reduced motion. Sheet replacement, history and focus survive accepted updates and save into an initially unloaded route.

Final narrow repairs address observed findings: `555e4c5` retains a started Duel across delayed same-version recovery responses; `8a7db13` fits all Sudoku rows and labels Practice correctly; `4ae2896`/`cc6bf72` immediately mount and animate already-public secret outcomes; `7f82b2a` enables eligible completed, unassisted Challenge sender publication while retaining session/controller/member/published/assisted restrictions. The actual Remote RPS interruption and published receiver recovery cases pass on the final bundle.

Startup/auth/asset handling bounds errors, rejects unsafe production Origin, preserves session-bound logout identity, increments login failures atomically and offers explicit recovery. Selected-game chunks load on demand. The service worker caches only reviewed public assets, waits during active matches and provides cold-offline recovery. Complete dependency/font notices ship in public output. LibreLudo reference archive/license remains pinned outside production imports; no upstream runtime or artwork is shipped.

## Actual validation and reconciliation

| Category | Actual result | Evidence boundary |
| --- | --- | --- |
| Build | PASS; 50 inventory paths / 59 public files | Final application bundle; local Worker dry run, not deployment |
| Typecheck, lint, formatting | PASS | Global checks plus affected paths after test-only fixes; 31 CRLF files have identical compiled output |
| Pure/unit | 23 files / 305 PASS | Vitest unit checks |
| Source/mocked contracts | 13 files / 78 PASS | Mocked SQLite/D1 integration |
| Components | 12 files / 62 PASS | Server rendering, not visual proof |
| Actual Worker | 3 files / 11 PASS | workerd/SQLite DO/D1 |
| Bundled real HTTP | 26 PASS | 17 normal supported journeys are API-assisted; runtime report dated 2026-10-03T03:31:14.413Z |
| Sudoku catalog | 1,000 PASS, 250 per difficulty | Content validity |
| Focused browser | 36 PASS | Native A11 and bounded lead recovery/interaction runs |
| Selected full browser suite | 123 unique PASS across five bounded batches | Standalone visual matrix and performance excluded |
| Visual matrix | 256 assertions PASS; 256 original PNGs individually inspected and hash matched | Capture versions preserved; browser emulation |
| Targeted acceptance | 41 PASS / 1 previous candidate / 1 owner deferred / 1 external | Individual records, not a blanket 44 PASS |
| Total acceptance ledger | 297 PASS / 1 previous candidate / 1 owner deferred / 1 external | 300 dispositions; not 300 PASS |
| Task queue | 55 VERIFIED / 2 previous candidate / 1 verified with limits / 1 owner deferred / 1 partial external | 60 individual tasks |

The 123 unique browser cases passed as 79 + 23 + 14 + 6 + 1 across bounded continuations. This was not one uninterrupted passing run. Failed attempts remain recorded. Test-only corrections derive actual participant names, establish a nondefault preference before a stale conflict, and assert current lifecycle, Ludo, Cricket and Home copy. Privacy, conflict, accepted-action, recovery and overflow assertions remain intact. No application fix was needed during this final pass.

Native A11 executed build, unit/contracts/components, real Worker/HTTP, content and focused browser checks. The lead completed the 123-case selection, affected checks and final evidence reconciliation. [Validation record](evidence/v1-closeout-validation.json) preserves commands, batches, case titles and failure history. [Targeted records](evidence/overnight-acceptance/targeted-assertions.json) and the [300-case ledger](../execution/OVERNIGHT-ACCEPTANCE-2026-10-03.json) qualify every disposition.

PERF-01 is owner deferred: no fresh final loading/input benchmark. PERF-04 retains previous-candidate route/listener/heap measurements with limits; current hidden-poll behavior passes. PERF-07 remains partial external for real account/D1/Origin, secrets, account-specific dry run and deployed KDF qualification. The earlier A10 benchmark uses `index-CuPq0uy4.js` / `match-page-DmW9c0Oq.js`, not the final entry. Its conditions and observations are preserved without a final-performance certification. A bounded artifact read confirms final `index-Dwz2urzg.js` is 451,168 bytes raw / 148,695 gzip, below the 250 KiB budget; it is not a new performance benchmark.

A12's completed source/artifact/provenance review remains an interim independent review. A new final post-QA independent verdict is owner deferred (A12-T5); lead reconciliation does not become an A12 verdict. Further polish and animation work belongs to V2. No further audit or optimization cycle was opened.

Scheduled Duel reconstruction from persisted SQLite uses a new DO instance. Platform eviction while a future start alarm is pending remains unverified; general eviction/hibernation tests pass separately. The no-forfeit actual Worker regression closes an authenticated Remote socket and executes an alarm with legacy 31-minute elapsed-time fixtures, then accepts B's move. Saved expiry uses 90-day legacy metadata. These are simulated elapsed-time fixtures, not wall-clock waits. Explicit abandonment flushes the real projection before active-slot assertions.

## Visual provenance and limits

[Candidate equivalence](evidence/overnight-acceptance/candidate-equivalence.json) identifies actual capture builds. VIS-001–096 retain unchanged Together Ludo/Snakes/Connect Four paths from `ce60da8`; Dots VIS-097–128 and SOS VIS-193–224 retain the post-`6f3c5bc`/`f06fa1cd747193b0` build. All 32 Sudoku cells were regenerated on `8a7db13`/`cd79381c103ceb57`. All 64 RPS/Cricket cells were regenerated on `7f82b2a`/`78decb9c6adb25d0`, then actually inspected. This completed through bounded resumes; it is not one uninterrupted run or 256 fresh captures of one binary. Old attempts remain under `attempts/`.

The six masked privacy originals preserve their older `8a7db13` build labels/hashes and scoped equivalence: the early concealment return is unchanged, later repairs only affect already-public outcome rendering/motion. Final-source secret-motion execution is separate. A12 verified current artifacts, all 256 image hashes and six privacy originals; its existing independent reviews are preserved. A new post-QA independent verdict is deferred under the owner closeout instruction; no final A12 verdict is claimed.

Largest SOS glyphs at 200-percent text do not fit the compact grid. The tested explicit Zoom alternative fits the glyphs and retains equal cells, keyboard reachability and all rows. Packed Ludo on-board glyphs remain small; count summaries and larger numbered controls provide the readable selection path. Physical touch/readability certification is not implied.

Earlier UI-only two-account PC/phone-size Remote Connect Four reaches normal completion without reload/API-driven gameplay; 14 separate creator-direction invitation/Ready/first-action cases cover seven shared games. Actual isolated LAN dev repeats the normal completion at exact origin `http://192.168.1.12:5619`; final inspected captures are dated `2026-10-02T21:48:20.456Z`, PC 1280×1150 and phone 390×844. This is historical actual LAN evidence with preserved date, not a final-build LAN recapture or physical-phone certification.

The six masked originals and three interaction originals retain verified hashes and actual inspection records. Automatically regenerated auxiliary owner-correction captures and the public accepted-motion video are retained as runtime artifacts; they are not claimed as a new exhaustive human visual/video review. The 256 matrix originals and their capture provenance remain authoritative.

## Deployment handoff — separately authorized work

These steps are prepared, not executed. See [release preparation](ARCADE-RELEASE-PREPARATION.md) for target verification, backups and rollback.

1. Confirm the intended Arcade Cloudflare account and Arcade-only D1 identity. Set `ARCADE_CF_ACCOUNT_ID`, `ARCADE_D1_DATABASE_ID` and the exact HTTPS `ARCADE_PRODUCTION_ORIGIN`. Run `node scripts/prepare-release.mjs --check`, then `node scripts/prepare-release.mjs`; inspect `.local/wrangler.arcade-production.json`. The check validates formats, not account ownership.
2. For an authorized release, run `npm run build` and `npx wrangler deploy --dry-run --config .local/wrangler.arcade-production.json`. Keep production Origin restrictions and existing Durable Object namespace/identities. Store a random CSRF secret of at least 32 characters through interactive `npx wrangler secret put CSRF_SECRET --config .local/wrangler.arcade-production.json`.
3. Record the previous deployed Worker version. Export D1 privately with `npx wrangler d1 export DB --remote --config .local/wrangler.arcade-production.json --output .local/arcade-before-release.sql`. D1 export does not back up authoritative Durable Object state.
4. Apply additive migrations with `npx wrangler d1 migrations apply DB --remote --config .local/wrangler.arcade-production.json`. Inspect existing A/B accounts first. If provisioning is required, supply `ACCOUNT_A_PASSWORD` and `ACCOUNT_B_PASSWORD` privately to `node scripts/provision-accounts.mjs`, then apply `.local/accounts.sql` only to the verified target using `npx wrangler d1 execute DB --remote --config .local/wrangler.arcade-production.json --file .local/accounts.sql`. Inserts do not overwrite existing accounts; no reset is authorized.
5. Deploy only after explicit authorization using `npx wrangler deploy --config .local/wrangler.arcade-production.json`. Verify HTTPS Secure/HttpOnly/SameSite cookies, exact Origin/CSRF rejection, private account views and deployed KDF CPU/memory. Sign in separately as different A/B accounts and complete Remote gameplay through the UI without reload on the actual URL.
6. Certify physical iPhone/Android browser and installed PWA flows: Back/Leave/Save/Resume, keyboard/insets, suspension/reconnect, reduced motion and phone/PC Remote completion. Browser viewport emulation does not certify hardware.

Rollback uses the previous compatible Worker build while retaining additive schema and the Durable Object namespace. Do not drop migration columns or restore a D1 export over newer accepted DO state. Keep all secrets, provisioning SQL and backups private.


No deployment, push, merge, global login change or owner-account/match/database reset occurred. Handoff and local evidence are saved; execution stops here.
