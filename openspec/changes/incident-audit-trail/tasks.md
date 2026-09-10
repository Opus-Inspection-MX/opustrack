# Tasks: incident-audit-trail

Change: incident-audit-trail · Phase: tasks · Store: hybrid
Strategy: stacked-to-main (3 independent PRs, each <400 lines)
Delivery: ask-on-risk → chained; slice 2 gated on the §3.5(a) gate-vs-log decision

---

## SLICE 1 — Model + Helper + Sync Instrumentation

**PR target**: main
**Branch**: feat/incident-audit-trail-core
**Objective**: Events exist; transitions and the silent-reopen guard are covered.
**Satisfies**: RF-219 (model, transition events, guard)

### Tasks (sequential within slice)

- [ ] T1.1 — `prisma/schema.prisma`: `IncidentEvent` model + `IncidentEventType` enum (both §3.5(a) variants included) + relation.
- [ ] T1.2 — Run migration: `npm run db:migrate -- --name add_incident_event_log`.
- [ ] T1.3 — NEW helper `logIncidentEvent()` in `src/lib/state-machine/` (payload key allowlist, truncation).
- [ ] T1.4 — `src/lib/state-machine/sync.ts`: emit `STATUS_CHANGED` on every committed transition (with `resolvedAt` snapshot); add `RECALC_SKIPPED` guard for historical `CERRADO` rows.
- [ ] T1.5 — Tests: transition emits with from→to; guard replays bulk-import failure (stays `CERRADO` + `RECALC_SKIPPED`); append-only test (no update/delete call sites).

**Verification (manual)**:
1. Migration clean; table indexed on `(incidentId, createdAt)`.
2. Focused tests pass (record command + result at apply time).

**Rollback boundary**: inverse migration drops table + enum; revert `sync.ts`. Guard removal restores old recalc (bug returns — ship slice 1 forward, don't linger reverted).

**Estimated lines**: ~180 lines changed.

---

## SLICE 2 — Remaining Write Paths (gated on §3.5a)

**PR target**: main (after slice 1 merged)
**Branch**: feat/incident-audit-trail-writers
**Objective**: All five mutation paths emit; coverage test green.
**Satisfies**: RF-219 (cancel, reopen, assignees, bulk)
**Depends on**: Slice 1 + the §3.5(a) gate-vs-log decision (determines which assignee-event group is enabled)

### Tasks (sequential within slice)

- [ ] T2.1 — `cancelIncident`: emit `CANCELLED` (reason + `resolvedAt` snapshot) in-transaction.
- [ ] T2.2 — Reopen path: emit `REOPENED` with prior `resolvedAt` in payload BEFORE nulling.
- [ ] T2.3 — `syncIncidentAssignees` (incident scope): emit per §3.5(a) outcome (`ASSIGN_DENIED` vs `ASSIGNEE_AUTO_CREATED`); other group left ignored-with-reason.
- [ ] T2.4 — `createIncidentsFromPreview`: emit `BULK_IMPORTED` per persisted row.
- [ ] T2.5 — Emission-coverage test: one assertion per write path (5/5).

**Verification (manual)**:
1. Cancel → event with reason; reopen → prior closure timestamp visible in payload; bulk import → per-row events.
2. `npm run check` clean.

**Rollback boundary**: revert writer commits; slice 1 transition events keep flowing.

**Estimated lines**: ~150 lines changed.

---

## SLICE 3 — Timeline UI + Report Notes + Spec

**PR target**: main (after slice 2 merged)
**Branch**: feat/incident-audit-trail-timeline
**Objective**: Admins can read history; reports adopt the precedence rule; spec updated.
**Satisfies**: RF-219 (read surface, precedence)
**Depends on**: Slice 2 (events worth reading)

### Tasks (sequential within slice)

- [ ] T3.1 — Admin incident detail: "Historial" timeline (Server Component, 50/page, humanized labels).
- [ ] T3.2 — RF-503/RF-509 notes: closure moment = latest close-arriving event, not live `resolvedAt`.
- [ ] T3.3 — `spec/03-incidentes.md`: RF-219 + §1.3/§3.5(a) pointers.
- [ ] T3.4 — E2E (ephemeral DB): close → reopen → timeline shows both + preserved closure timestamp.

**Verification (manual)**:
1. Close, reopen, reclose an incident → timeline shows 3+ events with actors; closure timestamp recoverable.
2. `npm run check` clean.

**Rollback boundary**: revert UI + notes; event writes continue (harmless, indexed).

**Estimated lines**: ~160 lines changed.

---

## Dependency Graph

```
main
  └─ feat/incident-audit-trail-core     [Slice 1] ─ PR #1 → main
       └─ feat/incident-audit-trail-writers [Slice 2, needs §3.5a] ─ PR #2 → main
            └─ feat/incident-audit-trail-timeline [Slice 3] ─ PR #3 → main
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Chained PRs recommended | Yes (3 slices, ordered) |
| 400-line budget risk | Low — ~180 / ~150 / ~160 |
| Estimated changed lines total | ~490 lines (3 PRs) |
| Largest single PR | Slice 1 (~180 lines) |
| Decision needed before apply | YES — §3.5(a) gate-vs-log before slice 2 |

---

## Commit Map (work-unit-commits convention)

**Slice 1**:
- `feat(db): add IncidentEvent append-only log model`
- `feat(state-machine): emit transition events and guard historical CERRADO rows`

**Slice 2**:
- `feat(incidents): emit audit events on cancel, reopen, assignee sync, bulk import`

**Slice 3**:
- `feat(admin): render incident audit timeline`
- `docs(spec): document RF-219 audit trail and closure-timestamp precedence`
