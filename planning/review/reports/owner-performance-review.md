# Owner Performance Review

## Scope and evidence

Read-only comparison of `planning/review/evidence/owner-corrections/build-baseline.json`, `performance-baseline.json`, and `performance-optimized.json`, plus the app entry and router imports. No source was changed and no test, build, or server was run for this review.

## Findings

- The measured optimized bundle is smaller: entry JavaScript falls from **517,672 B to 343,645 B** (174,027 B / 33.6% reduction). Under the recorded cold-load conditions, transferred bytes fall from **185,822 B to 145,214 B** (40,608 B / 21.9% reduction).
- The cold timing regressed in the supplied runs. Comparing the middle of three cold repeats, FCP changes from **684 ms to 820 ms** (+136 ms, 19.9%) and DOMContentLoaded from **490.7 ms to 539.6 ms** (+48.9 ms, 10.0%). The other repeats show the same direction for FCP (888→832 ms; 612→748 ms) and mixed/small variation in DCL (495.3→535 ms; 423.7→567.1 ms). These are small run counts, so treat this as a regression signal to investigate, not proof that the code change caused it.
- Traffic after the tested match cycles improves from **18 to 12 received messages** and **18,330 B to 12,057 B**, with sent messages/bytes unchanged at 6 / 1,542 B. This is a concrete reduction in received traffic for that scenario.
- The cycle evidence does not show listener growth: JavaScript listener count stays **195** before and after. Socket totals are **6 created / 1 active** after cycles in both recordings, so sockets are being replaced/reconnected across the cycle rather than accumulating active sockets.
- The node count changes from 612 to 646 before cycles and 612 to 656 after cycles. This is a 10-node increase after the same cycles in the optimized capture; the report alone does not identify ownership or prove a leak. Both captures report exactly **10,000,000 heap bytes** before and after; this fixed-looking value has no useful precision for heap-retention conclusions.
- Font decoded bytes are nearly unchanged (**28,344 B baseline, 28,504 B optimized**). `build-baseline.json` reports 56,448 B of font assets in the shell precache. The CSS defines two DM Sans faces, weights 400–500 and 600–800. The supplied data does not isolate preload timing as the cause of slower FCP, so do not claim that removing a font preload will improve it without a controlled comparison.

## Low-cost follow-up

`src/main.tsx` imports `App` from `"./app"`, which resolves through `src/app/index.ts`. That barrel reexports `App`, router, shell, and all page modules. Importing `App` directly from `"./app/App"` is a small, low-risk cleanup of the entry dependency edge. The router already lazy-imports the main pages in `src/app/router.tsx`, so the barrel may be tree-shaken; the expected bundle benefit is uncertain and must be measured. The current supplied baseline does not show this follow-up, so this report makes no claim about its impact.

## Conclusion

The supplied optimized capture demonstrates lower JS bytes and less received traffic for the exercised match cycles. It does not demonstrate faster cold rendering: median FCP and DCL are both higher. Listener counts and active-socket counts do not indicate resource accumulation; node counts deserve a targeted ownership check, while the reported heap metric cannot support a memory claim. Keep the performance claim limited to the measured bundle and traffic reductions until repeated cold-load captures explain the timing regression.
