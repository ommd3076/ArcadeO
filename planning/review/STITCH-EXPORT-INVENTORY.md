# Stitch source inventory for Codex

Verified locally on 2026-10-02. This chat exposes no Stitch MCP tool, but ordinary exported files are available for the next UI chat to read.

## Available source

- Project recorded in the source handoff: projects/9099986947047806544.
- planning/design/stitch/export/html/: 17 HTML files with inline styles and utility configuration.
- planning/design/stitch/export/screenshots/: eight K1-K8 PNGs.
- planning/design/stitch/export/CODEX-HANDOFF.md: source contributor's technical/visual brief.
- planning/design/stitch/evidence/: 29 existing PNGs, mapped by SCREEN-LIBRARY.md.
- assets/ui-references/: original owner tennis/tracker/supporting references.
- Nine design documents plus the package README under planning/design/stitch/.

| HTML source | Presentation to derive |
| --- | --- |
| K1-home-standard-light.html | Standard Light Home |
| K2-home-standard-dark.html | Standard Dark Home |
| K3-home-romantic-dark.html | Romantic Dark Home |
| K4-home-romantic-light.html | Romantic Light Home |
| K5-game-shell-connect-four.html | Outer gameplay framing |
| K6-secret-handoff-veil.html | Opaque Together handoff presentation |
| K7-desktop-home-bento.html | Laptop composition |
| K8-appearance-editorial-dark.html | Appearance/settings composition |
| games-catalog.html | Eight-game catalog |
| us-screen.html | Shared records |
| sudoku-setup.html | Sudoku setup |
| connect-four-gameplay.html | Board framing/reference |
| ludo-duel.html | Board framing/reference |
| snakes-and-ladders.html | Board framing/reference |
| rps-handoff.html | Secret choice/handoff presentation |
| rps-reveal.html | Accepted reveal presentation |
| offline-reconnecting.html | Recovery presentation |

## Adaptation requirements

These are static source designs, not evidence of responsive React behavior, real privacy, network recovery or saved settings. The owner has asked to implement their visual direction, while preserving authored game scope and engine boundaries.

- Inspect every source and its corresponding image; inspect actual rendered app screens and motion after implementation. Do not substitute selected screenshots for full source or real interaction coverage.
- Sources reference Google Fonts and CDN scripts. K1 uses Antonio and Plus Jakarta Sans; K8 uses Barlow Condensed, Plus Jakarta Sans and Space Grotesk. The exported quick reference nominates Barlow Condensed/Plus Jakarta Sans. Normalize the actual adopted font roles consistently, obtain licensed self-hosted assets and keep notices. No local font asset/license bundle was supplied with this export.
- The plain-CSS/semantic-token React app does not currently use Tailwind. Translate styles into that system; do not ship CDN Tailwind or unpkg latest scripts.
- Some sources disable user scaling and assume a fixed phone preview. Remove those constraints in the real app and test all supported widths, long text and 200% scaling.
- The exported route table differs from the real router. Preserve working deep links and route semantics rather than replacing them with sample paths.
- Generated prose includes wagers, fabricated banter, peer-latency telemetry, font percentages, universal radii and unsupported sensory toggles. These do not override owner corrections or authorize new backend capabilities.
- Preserve boards, hit mapping, authority and accepted game motion. Board pictures in this export do not replace the verified engine geometry.
- Missing game shells/states/theme variants must be implemented from the unified system and real engine capabilities. Do not invent an illustrated design source or runtime evidence for them.

The controlling execution brief is planning/review/CODEX-UI-IMPLEMENTATION-HANDOFF.md. The exported CODEX-HANDOFF remains a design reference where it conflicts with that owner-aligned brief.
