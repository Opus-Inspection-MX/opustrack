# Proposal: Offline-Tolerant Field Capture (RF-260, RF-261)

## Intent

Field work happens where connectivity doesn't: FSRs start site work, close assignments, and open/close vehicle trips from locations with poor signal. Today `startAssignmentWork` / `closeAssignment` (`src/lib/actions/assignments.ts`, `FormData` actions) and `startVehicleTrip` / `endVehicleTrip` (`src/lib/actions/vehicle-trips.ts`) fail hard offline — and with them the GPS-timestamped evidence captured at action time is lost forever (you cannot retroactively prove where you were). This change adds **local draft persistence + retry** for exactly these four actions. Scope is deliberately draft-and-retry ONLY: full offline sync with conflict resolution against the state machine is explicitly out (a merge UI that second-guesses the state machine would be a bigger, riskier change).

## Scope

### In Scope
- RF-260: local draft persistence (payload + GPS + timestamp captured at action time) and a retry queue with backoff for `closeAssignment` and `startAssignmentWork`, with idempotency keys so a retried close never double-applies.
- RF-261: same draft-and-retry treatment for `startVehicleTrip` / `endVehicleTrip` (odometer + photo staged locally, submitted on reconnect).
- Freshness window: drafts older than the configured horizon are rejected server-side with an operator-facing message (value fixed at design).
- Spec/04 (RF-260) + spec/06 (RF-261) updates.

### Out of Scope (Non-Goals)
- NO full offline sync, NO background sync workers / service-worker PWA.
- NO conflict resolution or merge UI: if server state moved on (assignment reassigned, closed, incident cancelled), the retried action returns the normal business-rule error (`rejected()`) and the user resolves it manually like any online failure.
- NO offline reads/caches of lists or dashboards.
- NO changes to state-machine transition rules themselves.

## Capabilities

### New Capabilities
- None (client-side draft store + retry around existing actions).

### Modified Capabilities
- `asignaciones`: RF-260 — start/close actions gain draft-and-retry.
- `vehiculos-viajes`: RF-261 — trip start/end gain draft-and-retry.

## Approach

A small client-side outbox (localStorage, one entry per pending action: action name, scalar payload, file refs where applicable, GPS fix + captured-at timestamp, idempotency key) with explicit user-triggered flush ("reintentar") plus automatic flush on reconnect. Server actions accept an optional `idempotencyKey` + `capturedAt`; the server validates the freshness window and processes the action through the UNCHANGED state machine — offline never bypasses guards, it only delays delivery. Files (trip photos) are staged as local blobs and uploaded as `File` in the retried `FormData`, preserving the no-base64 rule. GPS coordinates are captured at action time and sent as data, never re-captured at flush time (the whole point is proving where/when the work happened).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| New client outbox module (`src/lib/offline/` or equivalent) | New | Draft persistence, queue, backoff, flush triggers |
| FSR assignment screens (start/close forms) | Modified | Write drafts on failure/offline; surface pending state + retry |
| Trip start/end forms (`trip-start-form.tsx`, `trip-end-form.tsx`) | Modified | Same treatment incl. staged photos |
| `src/lib/actions/assignments.ts`, `vehicle-trips.ts` | Modified (additive) | Optional `idempotencyKey`/`capturedAt` params + freshness check; dedupe store |
| `spec/04-asignaciones.md`, `spec/06-vehiculos-viajes.md` | Modified | RF-260, RF-261 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stale draft conflicts with moved-on server state | High (by design) | No merge logic: server revalidates everything at flush; conflicts surface as normal business-rule errors |
| Duplicate closes on retry storms | Medium | Idempotency keys + server-side dedupe record; close remains guarded by the same preconditions |
| localStorage limits with staged photos | Medium | Cap queued drafts (count + bytes); oldest-draft eviction NEVER silent — user confirms |
| GPS spoofing/staleness disputes | Low | `capturedAt` + freshness window enforced server-side; out-of-window drafts rejected in Spanish |

## Rollback Plan

Client-only feature behind easily removable call sites; server changes are additive optional params. Revert commits; in-flight drafts simply stop flushing (documented in the revert note). No migration required (dedupe keys can live on existing tables or a tiny new table — decided at apply; if a table was added, inverse-migrate it).

## Dependencies

- **§3.5(a) IncidentAssignee gate-vs-log — DIRECT dependency.** Retry flushes re-enter through the normal actions, so gate semantics are automatically re-enforced at flush time. Under gate, a draft whose FSR lost authorization while offline fails flush with the denial message (correct). Under log, it auto-creates as today. No schema coupling — but the flush-failure tests must pin the chosen semantics, so run §3.5(a) before apply.
- **§3.5(b) ScheduleStatus:** independent (drafts never touch schedule state).
- Audit trail (`incident-audit-trail`, RF-219) is a natural sibling: flushed actions emit the same events as online ones with zero extra work, since they pass through the same actions.

## Success Criteria

- [ ] Airplane-mode start-work, close-assignment, trip-start, and trip-end all persist locally with GPS + timestamp and flush on reconnect.
- [ ] Retried close never double-applies (idempotency proven by test).
- [ ] Stale drafts past the freshness window are rejected with a Spanish message.
- [ ] Server-moved-on conflicts surface as standard business-rule errors (no silent overwrite, no merge UI).
- [ ] spec/04 (RF-260) and spec/06 (RF-261) updated.
