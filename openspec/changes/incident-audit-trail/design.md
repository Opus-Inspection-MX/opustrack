# Design: Incident Audit Trail (RF-219)

Change: `incident-audit-trail` · Phase: design · Artifact store: hybrid

This design turns the proposal contract into concrete technical decisions. It does NOT reopen any contract point (append-only log, five write paths, silent-reopen guard, read-only timeline, no backfill, no event sourcing).

---

## 1. Executive Summary

Add `IncidentEvent` (incident FK, `eventType` enum, `actorId`, `fromStatus`/`toStatus`, JSON `payload`, `createdAt`, indexed `incidentId`). Add one helper `logIncidentEvent()` called from `syncIncidentState`, `cancelIncident`, the reopen path, `syncIncidentAssignees` (incident scope), and bulk-import persistence. Add a 3-line guard in `syncIncidentState`: a `CERRADO` incident with zero active assignments and a prior `BULK_IMPORTED` event is left untouched (`RECALC_SKIPPED` emitted). Render a paginated read-only timeline on the admin incident detail. Ship in 3 slices.

---

## 2. Schema Change (exact)

```prisma
model IncidentEvent {
  id         String   @id @default(cuid())
  incidentId Int
  incident   Incident @relation(fields: [incidentId], references: [id])
  eventType  IncidentEventType
  actorId    String?
  fromStatus String?
  toStatus   String?
  payload    Json?    // e.g. { resolvedAt, reason, rowRef, deniedUserId }
  createdAt  DateTime @default(now())

  @@index([incidentId, createdAt])
}

enum IncidentEventType {
  CREATED
  STATUS_CHANGED
  ASSIGNEE_ADDED
  ASSIGNEE_REMOVED
  ASSIGNEE_AUTO_CREATED // log-outcome of §3.5(a); unused if gate wins
  ASSIGN_DENIED         // gate-outcome of §3.5(a); unused if log wins
  CANCELLED
  REOPENED
  BULK_IMPORTED
  RECALC_SKIPPED
  ADMIN_OVERRIDE        // reserved for the §1.3 override; written by it when shipped
}
```

Decisions:
- Enum over free-text `String`: the event vocabulary is closed and reviewable; adding a type is a migration, which is the right friction for audit semantics.
- `actorId` nullable: system-driven transitions (`syncIncidentState` auto-close) have no human actor; `null` means "system".
- No `active` flag: append-only means no soft delete. Enforced socially (single helper, no update/delete call sites — asserted by a unit test that greps the module surface at apply time via an explicit allowlist test) rather than by DB triggers, matching repo pragmatism.
- `payload Json?`: carries `resolvedAt` snapshots, cancellation reasons, bulk row refs. Small, never queried by field (timeline reads whole rows).

---

## 3. Write Paths (all five, exact call sites)

Single helper in `src/lib/state-machine/` (co-located with the authority it observes):

```ts
logIncidentEvent(client, { incidentId, eventType, actorId, fromStatus, toStatus, payload })
```

| # | Call site | Event(s) | Actor |
|---|-----------|----------|-------|
| 1 | `syncIncidentState` (transition commits) | `STATUS_CHANGED` (from→to + `resolvedAt` snapshot in payload) | `null` (system) |
| 2 | `cancelIncident` | `CANCELLED` (reason + `resolvedAt` snapshot) | cancelling user |
| 3 | Reopen path (`updateIncidentDetails` / explicit reopen action) | `REOPENED` (from `CERRADO` + prior `resolvedAt` preserved in payload BEFORE nulling) | acting user |
| 4 | `syncIncidentAssignees` (incident scope) | `ASSIGNEE_ADDED` / `REMOVED`; `ASSIGNEE_AUTO_CREATED` or `ASSIGN_DENIED` per §3.5(a) outcome | acting user / system |
| 5 | `createIncidentsFromPreview` (bulk) | `BULK_IMPORTED` per row (row ref + initial status + `resolvedAt` if historical) | importing admin |

Ordering guarantee: the event write joins the same `prisma.$transaction` as the mutation it records (where the path is already transactional); elsewhere it follows the write immediately. A failed mutation writes no event because `businessRule()` rolls back / `rejected()` returns before writing — event emission always comes last in the function.

---

## 4. Silent-Reopen Guard (exact)

In `syncIncidentState`, after computing `target` and before writing:

```ts
// Historical CERRADO rows (bulk import, no assignments yet) must not be
// silently reopened by recalculation. They leave CERRADO only via explicit reopen.
if (before === CERRADO && assignments.length === 0 && target !== CERRADO) {
  await logIncidentEvent(client, { incidentId, eventType: "RECALC_SKIPPED", ... });
  return { before, after: before };
}
```

Plus a `hasBulkImportedEvent` check (one indexed query) so the guard applies only to historical rows — a genuinely emptied incident (all assignments soft-deleted by an admin) keeps current recalc behavior and gets a `STATUS_CHANGED` event like any other transition. Regression test replays the reported failure: bulk-create `CERRADO` with `resolvedAt`, run `syncIncidentState`, assert still `CERRADO` + `RECALC_SKIPPED` present.

---

## 5. Closure-Timestamp Precedence (fixes RF-503/509 drift)

Rule for all report/tracking reads after this change: **the incident's closure moment is the `createdAt` of its latest `CLOSED`-arriving `STATUS_CHANGED`/`CANCELLED` event, not the live `resolvedAt` column** (which is legitimately `null` while reopened). RF-503 (trend) and RF-509 (aging) notes are updated to this rule in slice 3. No migration of existing rows; pre-deploy history remains approximate (stated non-goal: no backfill).

---

## 6. Read Surface

Admin incident detail gains an "Historial" timeline: chronological `eventType` (humanized label) + actor name + timestamp + reason/payload excerpt. Server Component, paginated (50/page), no mutations. FSR/CLIENT views: out of scope (admin-only audit surface keeps the slice small; widening read access is a follow-up).

---

## 7. §3.5(a) Compatibility Matrix

| Decision outcome | Events that fire | Test pins |
|---|---|---|
| Gate (membership required) | `ASSIGN_DENIED` on rejected adds; `ASSIGNEE_ADDED` on allowed | denial path emits with `deniedUserId` payload |
| Log (auto-create kept) | `ASSIGNEE_AUTO_CREATED` on implicit adds | auto-create emits with actor = requesting user |

The schema carries both enum values now so neither outcome needs a second migration. Apply-time instruction: run the §3.5(a) decision first, then enable the matching test group and leave the other as ignored-with-reason.

---

## 8. Spec Updates

- `spec/03-incidentes.md`: RF-219 (event model, write paths, guard, precedence rule) + notes on RF-503/509 timestamp source + pointer to §1.3 (override reserved event) and §3.5(a) (assignee events).

---

## 9. Slicing Plan

### Slice 1 — Model + helper + sync instrumentation
Table, enum, `logIncidentEvent()`, `sync.ts` transition events + guard, regression tests (guard + transition emission). Mergeable alone (writes events nobody reads yet).

### Slice 2 — Remaining write paths
cancelIncident, reopen, assignee sync (both §3.5(a) variants, one enabled), bulk import. Emission-coverage test over all five paths.

### Slice 3 — Timeline UI + report-precedence notes + spec
Admin timeline, RF-503/509 notes, spec/03 RF-219.

---

## 10. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| Missed writer → silent gaps | Coverage test enumerates the five call sites; slice 2 checklist requires one assertion per path |
| `payload` JSON grows unbounded | Allowlist of keys per event type, enforced in the helper; reasons truncated |
| Guard over-matches (blocks legitimate transitions) | `BULK_IMPORTED`-event check narrows it to historical rows; normal empties unaffected |
| Append-only violated by a future edit | Unit test asserts no `update`/`delete` on `IncidentEvent` outside migrations |

---

## 11. Next Recommended

`sdd-tasks` — task breakdown follows the 3-slice plan in section 9. Run the §3.5(a) gate-vs-log decision before slice 2 apply.
