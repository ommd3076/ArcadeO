# Execution decision ledger

## Direct owner answers — 2026-10-03

- Different accounts A/B were used in the failed phone/PC Remote match.
- Keep matches resumable after disconnect; no automatic loss.
- Keep deliberately saved games until finished or explicitly abandoned; no 72-hour expiry.
- Deliberately saved/resumed Sudoku Duels retain history/completion but exclude competitive wins/streaks/best times.
- Prepare and implement in a new GPT-6.1 Sol High chat with GPT-6 Luna specialists; twelve bounded submissions, maximum three active.
- LibreLudo URL: https://github.com/priyanshurav/libreludo. Architect adoption decision: pinned non-shipped reference only, preserve own engine and original assets.
- Dictated phone-navigation wording is interpreted as Back/leave-game controls, not a billing feature.

Frozen owner outcomes live in PRODUCT/PRD/GAME-RULES/DESIGN, not here. This records small architect defaults and later technical measurements so workers do not reopen them.

| ID | Default / rationale | Status |
| --- | --- | --- |
| E01 | Standard colorful regular theme for A; Romantic purple-dark/pink-light for B; both initially Dark; either family selectable | Owner correction incorporated |
| E02 | Account family in D1, device mode locally; piece families separate/snapshotted | Architect implementation default |
| E03 | Lowest-ID unsafe-stack capture; further sixes ignored after two until 1–5 | Architect refinement of approved house rule |
| E04 | 250 unique independently validated Sudoku puzzles per bucket; free numbering, not progressive unlock | Quantity is architect default; import unexecuted |
| E05 | Exhausted duel/completed receiver replay saves unranked terminal comparison, scored=false; exclude shared records | Architect closure of replay completion edge case |
| E06 | Together resignation explicitly names strict A/B resigning seat; other game actors derived from state | Architect closure of trusted-controller ambiguity |
| E07 | CSRF token reproducibly derived through Web Crypto HMAC and separate configured secret, returned only through authenticated bootstrap | Architect auth-refresh seam closure; implementation unexecuted |
| E08 | At most three active specialists, inherited model, only lead spawns; native unsupported → sequential canonical roles | Host-compatible execution default |
| E09 | Small JS budget target and exact tool versions measured during scaffold; no numeric version invention | Implementation measurement pending |
| E10 | Uncertain secret recovery preserves an accepted lock or atomically supersedes old action ID before reselection; prevent delayed original choice locking later | Architect recovery race closure |

Append actual library/version/parameter/benchmark/compatibility choices with task/evidence/rationale. Changing product outcome, privacy, schema compatibility or new external cost needs explicit review; ordinary details within contracts do not need another broad question round.
