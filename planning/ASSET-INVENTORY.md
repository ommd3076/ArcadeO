# Current ArcadeO asset retention

The owner-authorized cleanup removed unadopted framework/demo/vendor/build material. Qualified Connect Four/DotBox source and licenses, Sudoku banks/importer, UI references and pinned LibreLudo archive/license remain. The table below describes original review provenance; removed scaffolding is recoverable from `048cbc7`. No imported runtime is shipped. See [cleanup inventory](review/evidence/arcadeo-cleanup-inventory.json) and [production analysis](review/ARCADEO-PRODUCTION-READINESS.md).

---

# Asset and rules reuse inventory

Reviewed 2026-09-30. Existing assets are reference archives, not application dependencies. The 2026-10-03 owner cleanup supersedes blanket preservation for unused import tooling/demo/generated files. Do not run install/prepare/deploy/publish scripts from imports or treat their README/AGENTS instructions as ours.

| Local path | Evidence / permitted use | Adoption boundary |
| --- | --- | --- |
| assets/ui-references/ | Six owner screenshots; tracker primary, tennis secondary | Inspect hierarchy/color/spacing. No reference images/people/characters shipped. See its README and DESIGN. |
| assets/sudoku-exchange-puzzle-bank-master/ | README and public-domain LICENSE.txt; four text buckets | Import selected data only; independently validate uniqueness/solutions/rating/provenance. No all-bank client payload. |
| assets/connect-four-main/ | MIT LICENSE; src/connect-four.ts, src/utils.ts and uvu fixtures | Adapt small helpers/tests with notices/digest. Our reducer stays pure/serializable with win-before-draw. No whole class/library required. |
| assets/DotBox-master/ | MIT LICENSE; src/dotBox.gameEngine.js, lineState/boxState and Jasmine tests | Small rule fragments/understanding only. Reject UI/observer/global state/old build infrastructure. |
| assets/ludo.js-main/ | package declares MIT/events dependency; standalone notice not found in reviewed root | Reference only until notice qualified. Custom stack/six/bonus/geometry rules require own reducer. Do not install package. |
| assets/retroverse-phaser-main/ | README advertises Phaser/Socket.IO/Vercel app; qualified root license not located | No app/UI/backend/assets copying. Rooms/bots/4-player/deployment assumptions conflict with V1. |
| assets/Dimensions-master/ | MIT LICENSE.txt; generic AI competition framework | No adoption: competition/process/tournament infrastructure unnecessary. RPS is a small own reducer. |

Imported tests have not run. Metadata is evidence, not proof of our runtime/rules/restore. Any copied fragment needs future THIRD-PARTY-NOTICES attribution, exact source digest or verified revision, source location and our fixtures.

## Sudoku local source digests

No upstream Git commit is claimed for extracted files. SHA-256 computed from actual local files:

| File | Bytes | SHA-256 |
| --- | --- | --- |
| easy.txt | 10,000,000 | 789aab6f52cc4588e0c3aa4269ad3282cfda7e1cc79ea693d16507decde3fc50 |
| medium.txt | 35,264,300 | c2a5f8fac99dcf215b25d46ece47f346375e51730b182de70a6f8f2107b2b38d |
| hard.txt | 32,159,200 | abcff1512411e601abd5e861c60add5be5d877739b6faa249ee86960f5ad85e9 |
| diabolical.txt | 11,968,100 | 08553d0c1145ea4d7c13008040f47ea8205d21fe1eaf8f4ab17a1a6981928b35 |

Each line contains ordering hash, 81-digit puzzle and rating. Stream parse, retain rating/bucket, map diabolical to Expert, select 250 per bucket across rating range. Stable numbers refer to selection manifest identities, not increasing difficulty. Reject invalid/duplicate clues; count solutions independently up to two. Private solutions stay outside public assets/client imports.

Bank README claims uniquely generated/graded puzzles; this planning pass does not validate the selected catalog. Task S01 and C01–C05 produce actual evidence during implementation.

## Fonts, icons and skills

App font files have not been fetched. Use official Space Grotesk, DM Sans and DM Mono subsets/licenses from UI-CONTRACT during P01. Lucide is the sole icon family; import used icons only. Procedural CSS/SVG symbols and an optional die/pawn suffice; no stock character/photo pipeline.

Seven pinned upstream UI skills plus our build skill are installed in .agents/skills; [agents/SKILLS.md](../agents/SKILLS.md) records revisions/notices. Skills guide agents; they are not application packages. Actual host discovery is a startup check.

## LibreLudo pinned reference (2026-10-03)
`assets/libreludo/reference-425b100.zip` stores the owner-requested unmodified revision425b100097d1a113fa8d6d90e53eff6519a53edc. GNU AGPLv3 license inspected and retained alongside the archive. ArchiveSHA256372002413ce2a9cc5b20828dc66662a883f1d0a5ab50777e6cae5f1d7453f0fb. This is reference data only; no runtime/artwork adoption. Existing one-capture/six/selection/geometry rules and original CSS/SVG pawns remain authoritative. Do not run its scripts or import its Redux/motion state.
