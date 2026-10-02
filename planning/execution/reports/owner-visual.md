> Historical authored evidence plan. Execution and current results are now recorded in [the final checkpoint](owner-corrections-checkpoint.md). Its later 208-view matrix and live checks supersede the pending statements below.

# Owner correction browser evidence plan

`tests/browser/owner-visual.spec.ts` is an executable Playwright suite against the configured real Worker browser server. It creates fresh saved matches, visits every one of the eight game screens in Standard Dark, Standard Light, Romantic Dark and Romantic Light at 320, 390, 430 and 1280px, and writes 128 screenshots plus layout observations to `planning/review/evidence/owner-corrections` when run.

For the three grid games it captures focus mode; for Dots and SOS it captures zoom/reset on 320px. It also records keyboard focus, 125% root text size, and reduced-motion screenshots. A separate filmed UI journey submits an accepted action in Ludo, Snakes & Ladders, Connect Four, Dots and SOS, samples running browser Animations, reloads to inspect settled state, and saves a WebM plus JSON observations. All created matches are abandoned in `finally`; the appearance preference is restored after each matrix test.

Authoring check: `npx tsc --noEmit` exited 0. The suite has **not been run** because the lead owns the exclusive browser/server run. Screenshots, motion observations, browser exits and visual judgement must be reported only after that run completes; this file is not evidence of a passing browser matrix.
