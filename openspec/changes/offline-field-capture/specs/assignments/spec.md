# Delta for Asignaciones (Domain 04)

> Change: `offline-field-capture` | RF range: RF-250–RF-299 | Spec file: spec/04-asignaciones.md
> Free number verified: RF-250–RF-259 taken; RF-260 is next free.

---

## ADDED Requirements

### Requirement: RF-260 · Borradores offline y reintento para inicio/cierre de asignación

The system MUST persist locally (on-device) the field-captured payload of `startAssignmentWork` and `closeAssignment` when submission fails or the device is offline, and MUST allow retrying the exact captured action on reconnect. This is draft-and-retry ONLY — full offline sync and conflict resolution are explicitly excluded.

**Rules:**

- Drafts freeze action-time evidence: scalar payload, GPS fix, and `capturedAt` MUST be captured at field time and MUST NOT be re-captured at flush time.
- Each draft carries an idempotency key. The server MUST dedupe by key: re-flushing the same draft MUST NOT double-apply the transition.
- Server MUST reject drafts older than the freshness window (default 24h, confirmable at apply) with an operator-facing Spanish message.
- Past the freshness/validity checks, the retried action runs the UNCHANGED guards and state machine (permissions, terminal-state blocks, preconditions). Offline confers no privilege.
- If server state moved on (reassigned, closed, incident cancelled), the flush MUST return the action's standard business-rule error; the draft is kept for the user to resolve manually. NO merge UI.
- Draft storage is capped (count + bytes); eviction requires explicit user confirmation, never silent.
- Flush triggers: explicit retry control + automatic flush on reconnect, with bounded backoff (immediate → 30s → 5min → manual-only).
- Flushes re-enter through the real actions, so the §3.5(a) gate-vs-log outcome applies automatically (gate: stale authorization fails flush with denial; log: auto-create as today).

#### Scenario: Close persists offline and applies once

- GIVEN the FSR closes an assignment with no connectivity
- WHEN connectivity returns and the draft flushes (possibly twice through retry)
- THEN the assignment is closed exactly once with the action-time GPS and timestamp
- AND the normal close event/audit fires as if online

#### Scenario: Stale draft is rejected

- GIVEN a draft with `capturedAt` older than the freshness window
- WHEN flush is attempted
- THEN the server rejects it with a Spanish message and the draft is marked, not silently dropped

#### Scenario: Moved-on state surfaces as a normal rule error

- GIVEN a pending start-work draft for an assignment that was reassigned while offline
- WHEN flush is attempted
- THEN the standard business-rule error is returned, the draft is kept, and no state is overwritten
