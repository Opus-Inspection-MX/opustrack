# Proposal: Incident Audit Trail (RF-219)

## Intent

Incident state changes leave no trace. Two defects prove the cost: (1) reopening an incident nulls `resolvedAt` (`src/lib/state-machine/sync.ts` sets `resolvedAt: null` whenever the target isn't `CERRADO`; spec/03 documents it), destroying the closure timestamp that RF-503/RF-509 analytics depend on — every reopen/reclose cycle rewrites history; (2) bulk import (RF-206) creates rows directly in `CERRADO` with a `resolvedAt` but **no assignments**, and the next status recalculation silently reopens them because zero active assignments don't satisfy "all CERRADO". Nobody can answer "who closed this, when, and what happened after". This change adds an **append-only event log** for transitions, assignee changes, cancellations, and admin overrides — and it **unblocks the §1.3 admin-override decision**, which is only safe to allow once overrides are recorded.

## Scope

### In Scope
- RF-219: `IncidentEvent` append-only log (event type, actor, from→to status, payload incl. `resolvedAt` snapshots, timestamp). Written by: `syncIncidentState` transitions, `cancelIncident`, reopen path, assignee sync (`syncIncidentAssignees`), bulk-import persistence, and the future admin override.
- Read surface: timeline on the admin incident detail.
- Guard fix: recalculation MUST NOT silently reopen a `CERRADO` incident that has zero active assignments and a bulk-import (historical) event — it stays closed until an explicit reopen action, which itself is logged.
- Spec/03 update (RF-219).

### Out of Scope (Non-Goals)
- NO generic audit for other entities (assignments, schedules, users) — incidents only.
- NO event sourcing: the log is observability, not authority. State machines remain the sole writers of `statusId`.
- NO backfill of history (events start at deploy; past reopens stay unrecoverable — stated honestly).
- NO redesign of the §1.3 admin override itself (this change only unblocks it).

## Capabilities

### New Capabilities
- None (new log model + timeline read).

### Modified Capabilities
- `incidents`: RF-219 — every status-affecting path emits an event; silent-reopen guard added to sync.

## Approach

One Prisma model, written from the five existing mutation paths, never updated or deleted by application code (append-only enforced by code review + a unit test asserting no `update`/`delete` call sites, not by DB magic). Payloads are small JSON snapshots (`{ resolvedAt, actorId, rowRef }`), so the closure timestamp survives even when the live `resolvedAt` column is nulled — fixing the RF-503/509 drift at the read layer (reports prefer the last `CLOSED` event's timestamp; exact join decided at apply). The bulk-import guard is a 3-line early return in `syncIncidentState`, covered by a regression test that replays the reported failure (import CERRADO → recalc → stays CERRADO + `RECALC_SKIPPED` event).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | New `IncidentEvent` model + relation |
| migration | New | Create table (additive) |
| `src/lib/state-machine/sync.ts` | Modified | Emit transition events + silent-reopen guard |
| `src/lib/actions/incidents.ts`, `incidents-bulk.ts`, `tracking.ts` (`cancelIncident`, assignee sync, reopen) | Modified | Emit events at each mutation path |
| Admin incident detail | Modified | Event timeline (read-only) |
| `spec/03-incidentes.md` | Modified | RF-219 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Write-path misses one mutation site, log goes stale | Medium | Single `logIncidentEvent()` helper; every `statusId`-touching path audited at apply; test asserts all five paths emit |
| Event volume on large instances | Low | One row per transition (not per read); indexed `incidentId`; timeline paginated |
| Reports mixing live `resolvedAt` vs event timestamps | Medium | Design fixes the precedence rule (last `CLOSED` event wins); RF-503/509 notes updated in the same slice |

## Rollback Plan

Additive table + helper. Revert commits, drop table. Live status behavior unchanged (guard removal restores old recalc — the silent-reopen bug returns, which is why the guard ships WITH the log, not before).

## Dependencies

- **§3.5(a) IncidentAssignee gate-vs-log — DIRECT dependency.** Phase 2 kept auto-create; `assignFSRToIncident` has no UI consumer while RF-025/514/515 describe the inverse path. This proposal is compatible with BOTH outcomes: if gate wins, denials emit `ASSIGN_DENIED`; if log wins, auto-creations emit `ASSIGNEE_AUTO_CREATED`. The decision determines which event type fires — the log schema covers both, so apply can proceed but the assignee-event tests pin the chosen semantics.
- **Unblocks §1.3 admin-override decision:** override becomes permissible once every override writes an `ADMIN_OVERRIDE` event with actor + reason. This proposal ships the mechanism; §1.3 ships the permission.
- **§3.5(b) ScheduleStatus:** independent. Schedule status changes are out of scope unless that decision adds a machine (then a follow-up logs them).

## Success Criteria

- [ ] Every transition, assignee change, cancellation, bulk import, and reopen writes an event with actor + timestamp.
- [ ] Reopening preserves history: last closure timestamp recoverable from the log after `resolvedAt` is nulled.
- [ ] Bulk-imported `CERRADO` rows with no assignments survive recalculation (regression test replays the failure).
- [ ] Admin timeline renders the incident's events in order.
- [ ] spec/03 documents RF-219 + the §3.5(a)/§1.3 relationships.
