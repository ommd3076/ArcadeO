# Owner performance comparison — 2026-10-02

## Method

Raw evidence: `planning/review/evidence/owner-corrections/performance-baseline.json`, `performance-optimized.json`, `build-baseline.json`, `build-optimized.json`.

Same Chromium 153.0.8010.12, 1280×900, three fresh contexts with cold/warm loads, 4× CPU slowdown, 50 ms latency and 1 MiB/s network. Service workers were blocked for comparable loading. Input was unthrottled local Worker pointerdown to authoritative disc insertion; frames were headless requestAnimationFrame samples. Six Match→Home→Match route cycles tested resource lifetime. Host load was not controlled, and three load repeats are a small sample.

| Metric | Baseline | Final |
| --- | ---: | ---: |
| Initial JavaScript bytes | 517,672 | 342,456 |
| Public shell precache bytes | 631,268 | 435,579 |
| Cold transferred bytes | 185,822 | 143,287 |
| Cold FCP median ms | 684.0 | 800.0 |
| Cold DOMContentLoaded median ms | 490.7 | 564.1 |
| Warm FCP median ms | 232.0 | 324.0 |
| Accepted input response median ms | 15.5 | 19.5 |
| Sampled frame interval median ms | 16.7 | 16.7 |
| Received socket messages | 18 | 12 |
| Received socket bytes | 18,330 | 12,057 |

## Changes and conclusions

- Lazy routes and the direct App import move game code/CSS away from initial loading. Initial JS fell **33.8%**, shell precache **31.0%**, and cold transfer **22.9%**. The direct import additionally separated 7.18 kB game CSS from the entry CSS.
- The public shell precaches only entry dependencies and the three used DM Sans faces. Known public lazy assets can be cached on demand; APIs, query/private pages and solutions are excluded. The real-browser service-worker test passed. Runtime font payload is nearly unchanged (28,344→28,504 bytes); the medium face is a real 500-weight font.
- An accepted WebSocket action now sends the authoritative reply to its requester and broadcasts to the other sockets. Same-account other sockets still receive events; HTTP actions broadcast normally. Received message count fell **33.3%**, bytes **34.2%**; six sent messages/1,542 bytes remain unchanged. Saved acceptance, transaction/sync and D1 outbox semantics remain intact.
- **Faster rendering or input is not demonstrated.** Cold and warm medians are slower in the final capture; input median also rose. Typical frame intervals remain 16.7 ms. Earlier optimized repeats varied (cold FCP 756–824 ms); no causal latency improvement or phone smoothness claim is made. No numeric loading-speed target was supplied; the demonstrated optimization is payload/cache/traffic reduction.

## Resource measurement

The final six-route probe kept one document, **197 listeners before and after**, and **one active socket**. Six sockets were created across route entries, with earlier sockets closed. Connected DOM nodes grew **175→177**; the head-link inventory identifies exactly two new module-preload links for Home and its Zap icon. CDP total nodes grew 650→660; connected-node/head-link data explains the attached increase, not every detached node.

After garbage collection, precise CDP heap was **3,477,248→4,527,164 bytes** while Home code was first loaded. Baseline `performance.memory` reported a coarse fixed 10 MB and cannot support a precise heap comparison. This short run does not prove absence of long-term retention. Listener/socket accumulation was not observed in the exercised cycles.

Every accepted move still performs authoritative DO persistence; completed records project through the D1 outbox. Those required writes were preserved. No measured projection bottleneck was established. DOM reaction/frame samples do not isolate React render time or low-end phone GPU cost. Production latency, deployment, physical-phone behavior and prolonged memory use remain separate measurements.
