# API and delivery contract

Implementation design; no endpoints currently running. Same-origin JSON API under /api/v1; static SPA fallback excludes /api. Authenticate all routes except login/session bootstrap where indicated. Private responses are no-store. Fixed accounts only.

## Endpoints

| Method / path | Input / result |
| --- | --- |
| POST /auth/login | username, password; generic failure or safe profile/CSRF metadata + secure cookie |
| GET /auth/session | current safe profile, CSRF token, expiry or unauthenticated status |
| POST /auth/logout | revoke current session, clear cookie; CSRF/Origin required |
| GET /profile | own safe account preferences and public names/accents for the two accounts |
| PATCH /profile | expectedPreferenceVersion, paletteFamily and/or accentFamily; atomic distinct-accent check |
| GET /catalog | eight games/modes/formats, content availability/version; no solutions |
| GET /sudoku/puzzles?difficulty=&cursor= | stable number/ID, rating bucket, own completed/replay marker; no private solution |
| GET /matches?cursor=&status= | accessible invitations/active/terminal discovery; initialization state, mode/phase/players |
| POST /matches | creationId, gameId, mode, validated game options; slot-conflict Resume or initialized match |
| POST /challenges | creationId, senderAttemptId; initialize published challenge from eligible server result |
| GET /matches/:id | latest filtered snapshot, serverTime, versions and control/lock status |
| POST /matches/:id/actions | action envelope; filtered accepted/rejected reply |
| GET /matches/:id/receipts/:actionId | authorized actor receipt status + current filtered view; never payload digest/choices |
| POST /matches/:id/secret-recovery | pendingActionId, roundId, applicable controllerGeneration; atomically return accepted lock or supersede unaccepted ID before reselection; no raw choice |
| POST /matches/:id/controller | expectedControllerGeneration; intentional takeover, increment + latest view |
| GET /matches/:id/socket | native WebSocket upgrade with Origin/session checks |
| GET /results?cursor=&game=&mode= | paginated shared result/solo filters |
| GET /records | basic head-to-head, weekly/streak and separate solo records; syncing status |

Prefix every path above with /api/v1. Mode/options must match fixed catalog. Creation and challenge publishing are idempotent by creationId; preference writes use preference version, not move IDs. Account-scoped device mode is local storage only. Never accept client-supplied actor, random outcome, solved time, winner or solution. Together resign is the narrow exception: strict resigningSeat names who forfeits under the trusted controller.

## Envelope and responses

Conceptual action envelope fields: protocolVersion=1, matchId, actionId (UUID), action (known discriminator), payload (exact action shape), and only the relevant expectedVersion/turnId/roundId/progressRevision/controllerGeneration. Full action vocabulary is in SYSTEM-CONTRACT. JSON schema/typed runtime validators reject nonintegers, out-of-range values, unknown fields and extraneous guards that conflict with the action.

Accepted reply: status, actionId, acceptedVersion/eventId, serverTime and current filtered view. Rejected reply: status, actionId, stable code, retry guidance and safe latest view if authorized. Unknown receipt means not currently accepted; resync before reusing/selecting a replacement action. Authentication failure never includes private view.

Socket server messages: snapshot, accepted event/update, rejection, control-changed, auth-expired, protocol-update-needed. Use contiguous delivery version and event ID, with viewer-safe effects. Initial upgrade requests latest snapshot; reconnect obtains full view rather than assuming uninterrupted delivery. Client actions use the same envelope/pipeline as HTTP. No socket connection grants permanent authority.

## Errors and UI mapping

| Code | Handling |
| --- | --- |
| AUTH_REQUIRED / SESSION_EXPIRED | mask private screens, sign in, preserve validated internal return route |
| FORBIDDEN / NOT_FOUND | common unavailable match screen; do not disclose other data |
| PROTOCOL_MISMATCH / UNSUPPORTED_RULES | read-only recovery/update; never reset saved match |
| INVALID_ACTION | show actionable reason; unchanged state |
| STALE_STATE / NOT_YOUR_TURN | resync, show current actor, no blind replacement action |
| CHOICE_LOCKED / WRONG_ROUND | restore lock/round; no second submission |
| CONTROL_TRANSFERRED | read-only with deliberate Continue on this device |
| MATCH_FINISHED | saved result/Back/Rematch |
| SLOT_OCCUPIED | Resume existing match |
| ID_REUSED | stop retrying mismatched payload; surface invariant error/report ID |
| ACTION_SUPERSEDED | original uncertain secret request was recovered before acceptance; resync, never replay that ID |
| RATE_LIMITED | retry-after with generic login wording |
| UNAVAILABLE | saved-view pause/retry; no pretend acceptance |
| PREFERENCE_CONFLICT | show current valid preferences and alternative accent |

Transport failures distinguish unknown acceptance from explicit rejection. Retry accepted-or-uncertain nonsecret action with identical ID/payload; never reroll dice under a new ID. Secret lock recovery uses the atomic secret-recovery endpoint; no raw choice in storage/receipt URL/logs. A live secret retry may reuse the same in-memory ID/value until concealment, then recover before reselection. GET receipt/snapshot alone cannot cancel an in-flight original request. Recovery requires current authenticated actor/control and validates round association; it cannot supersede another remote seat's lock. Old-generation requests after takeover already reject. No rollback of an accepted choice is permitted.

## Redaction matrix

| Data | Owner remote | Opponent remote | Together controller |
| --- | --- | --- | --- |
| Turn board/score/dice | public | public | public |
| Current local unsubmitted choice | ephemeral local | absent | ephemeral current chooser only |
| Locked choice before both lock | omitted from response | omitted | omitted |
| Both locked secret values/result | revealed | revealed | withheld until saved Reveal together |
| Sudoku entries/notes | own only | omitted | no together Sudoku in V1 |
| Sudoku solution | never | never | never |
| Payload digest/KDF/session token | never | never | never |

Apply this to snapshots, events, receipts, fallback, error payloads, caches and logs. Old receipt recovery is filtered under current reveal permission, not copied from an unfiltered stored object.
