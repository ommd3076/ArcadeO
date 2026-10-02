# Initial reproduction — 2026-10-03

Baseline source HEAD: 4fa98e3. Dirty owner preparation contracts and runtime-results edit preserved. Branch: codex/v1-finish.

`npm run build` completed before source repairs: frontend, public service worker and bundled Worker dry run passed. Initial JS gzip146.83kB, public precache761220bytes; these are build metrics, not performance evidence.

`npx playwright test tests/browser/overnight-remote.spec.ts` passed one test in39.6s (21.1s test). Two isolated synthetic accounts use PC1280x800 and phone-size390x844 Chromium contexts against isolated bundled workerd/SQLite DO/D1. All logins, creation, invitation acceptance, both Ready, seven alternating disc drops and terminal win use visible UI. No reload or API progression. Both boards converge after each move. This certifies that localhost baseline flow, not physical devices/LAN/all-games/release completion.

LAN baseline uses independent Vite5183 and Worker8793 because5173/8787 already have live processes; those preexisting services were left alone. Same development Origin policy as scripts/dev.mjs, isolated synthetic D1/DO state. Browser at actual Wi-Fi192.168.1.12:5183 reports login403 ORIGIN_MISMATCH, insecure context, randomUUID undefined and getRandomValues available. Redacted results: planning/review/evidence/overnight-lan-baseline.json. No cookies/passwords/solutions in committed evidence. Failed first setup attempt encountered occupied dev port and was replaced by distinct ports; it is not product proof.

A01/A04 static audits are completed and lead-reviewed; code findings remain assigned. A04 ran224 deterministic engine tests; no reducer-rule correction recommended. A02/A03/A09 repairs currently active. Migration0004 applied successfully to isolated actual D1, but full record eligibility/projection and legacy backfill require A05 and runtime tests.
