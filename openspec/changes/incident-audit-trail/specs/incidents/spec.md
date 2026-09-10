# Delta for Incidentes (Domain 03)

> Change: `incident-audit-trail` | RF range: RF-200–RF-249 | Spec file: spec/03-incidentes.md
> Free number verified: RF-217/RF-218 taken by sibling Phase 3 proposals; RF-219 is next free.

---

## ADDED Requirements

### Requirement: RF-219 · Bitácora de auditoría del incidente (append-only)

The system MUST maintain an append-only `IncidentEvent` log recording every status-affecting occurrence on an incident: creation, status transitions, assignee changes, cancellations, reopens, bulk imports, skipped recalculations, and (reserved) admin overrides. Application code MUST never update or delete event rows.

**Rules:**

- Event types are a closed enum: `CREATED`, `STATUS_CHANGED`, `ASSIGNEE_ADDED`, `ASSIGNEE_REMOVED`, `ASSIGNEE_AUTO_CREATED` / `ASSIGN_DENIED` (exactly one pair active per the §3.5(a) gate-vs-log decision), `CANCELLED`, `REOPENED`, `BULK_IMPORTED`, `RECALC_SKIPPED`, `ADMIN_OVERRIDE` (reserved for the §1.3 admin-override decision).
- Every event carries `incidentId`, `eventType`, optional human `actorId` (`null` = system), `fromStatus`/`toStatus` where applicable, a small JSON `payload` (allowlisted keys; includes `resolvedAt` snapshots and reasons), and `createdAt`.
- The five write paths MUST all emit: `syncIncidentState` transitions, `cancelIncident`, the reopen path (BEFORE `resolvedAt` is nulled), `syncIncidentAssignees` in incident scope, and bulk-import persistence (one event per row).
- **Silent-reopen guard:** recalculation MUST NOT move a `CERRADO` incident with zero active assignments and a prior `BULK_IMPORTED` event out of `CERRADO`. It emits `RECALC_SKIPPED` and returns unchanged; only an explicit (logged) reopen leaves `CERRADO`.
- **Closure-timestamp precedence:** reports (RF-503, RF-509) MUST treat the latest close-arriving event as the closure moment, not the live `resolvedAt` column.
- No history backfill: events begin at deploy.
- The log is observability, not authority: state machines remain the sole writers of `statusId`.

#### Scenario: Reopen preserves closure history

- GIVEN a `CERRADO` incident with `resolvedAt = T`
- WHEN an admin reopens it (live `resolvedAt` nulled)
- THEN a `REOPENED` event exists with `T` in its payload
- AND RF-509 can still report the original closure at `T`

#### Scenario: Bulk-imported CERRADO survives recalculation

- GIVEN a bulk-imported incident in `CERRADO` with `resolvedAt` set and zero assignments
- WHEN `syncIncidentState` runs for it
- THEN it remains `CERRADO`
- AND a `RECALC_SKIPPED` event is recorded

#### Scenario: Assignee denial is logged under gate semantics

- GIVEN the §3.5(a) decision resolved to gate
- WHEN an unauthorized FSR add is rejected
- THEN an `ASSIGN_DENIED` event records the denied user and the acting admin
- (Under log semantics, the mirror scenario emits `ASSIGNEE_AUTO_CREATED` instead.)
