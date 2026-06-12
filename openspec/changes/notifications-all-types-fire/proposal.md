# Proposal: Fire All Notification Types

## Intent

10 `NOTIFICATION_TYPES` are defined but only `ASSIGNMENT_ASSIGNED` fires today (via the private `notifyAssignees` in `assignments.ts`, using single-write `createNotification` in a `Promise.all`). The other 9 are dead constants. FSRs, admins, and reporters get no in-app signal when assignments transition, incidents close, or work is reassigned — they must poll lists manually. This change wires every type to its real business event through one central, bulk, failure-isolated helper, and adds an admin broadcast UI for the two manual types (SYSTEM, ANNOUNCEMENT).

## Scope

### In Scope
- Central helper `src/lib/notifications/notify-events.ts` — one function per type, bulk via `createNotificationsForUsers`, each in try/catch, accepts `actorId` to exclude the actor.
- `getAdminUserIds()` helper (active ADMINISTRADOR ids).
- Wire 8 event-driven types in `assignments.ts` + state machine and `incidents.ts`.
- Surface `syncIncidentState`'s `{ before, after }` out of the tx to detect incident auto-close.
- Admin broadcast UI (page + server action) for SYSTEM (selectable audience) and ANNOUNCEMENT (all active).
- Replace legacy `notifyAssignees` with the central helper.

### Out of Scope (Non-Goals)
- Email / push / external delivery — in-app only.
- Per-user notification preferences or opt-out.
- Digest / grouping / batching of notifications.
- New notification entity columns or schema migrations.

## Capabilities

### New Capabilities
- `notification-events`: server-side event-to-notification dispatch — the trigger matrix, actor exclusion, recipient resolution, and failure isolation rules.
- `admin-broadcast`: admin-composed SYSTEM/ANNOUNCEMENT broadcast with audience selection (all active / by role).

### Modified Capabilities
- None — existing read/mark-read/delete notification behavior is unchanged.

## Approach

Each business action, AFTER its DB transaction commits, calls a `notify*` helper. Helpers use `createNotificationsForUsers` (single `createMany`, no N+1), wrap in try/catch (notification is a POST-transaction side effect — a failure NEVER breaks or rolls back the main operation), and accept `actorId` to drop the originator from recipients. Incident `entityId` (Int) is passed as `String(incidentId)`. INCIDENT_CLOSED fires only when `syncIncidentState` returns `before !== CERRADO && after === CERRADO`, surfaced from the tx. SYSTEM/ANNOUNCEMENT are admin-initiated via a new page + action, not wired to user events.

### Trigger Matrix

| Type | Event | Recipients (always exclude actor) | Priority |
|------|-------|-----------------------------------|----------|
| ASSIGNMENT_ASSIGNED | FSR added to assignment | new FSRs | High |
| ASSIGNMENT_UPDATED | every transition: Visto, Iniciado, Pausado, Reanudado, admin status override, notes/odtFolio edit | active assigned FSRs | Medium |
| ASSIGNMENT_COMPLETED | close (→CERRADO) | assigned FSRs + ADMINISTRADOR | High |
| ASSIGNMENT_REOPENED | reopen (CERRADO→EN_PROGRESO) | assigned FSRs | High |
| INCIDENT_CREATED | incident created (any role) | ADMINISTRADOR | Medium |
| INCIDENT_UPDATED | incident metadata edit | enabled FSRs (active IncidentAssignee) | Low |
| INCIDENT_CLOSED | auto-close (before≠CERRADO && after==CERRADO) | reporter (reportedById) + ADMINISTRADOR | High |
| INCIDENT_ASSIGNED | FSR enabled (IncidentAssignee added) | new FSRs | Medium |
| SYSTEM | admin manual broadcast | admin-chosen audience (all / by role) | Medium |
| ANNOUNCEMENT | admin manual broadcast | all active users | Low |

## Slices (stacked-to-main, chained)

1. **Core + assignment events** — `notify-events.ts`, `getAdminUserIds`, replace `notifyAssignees`; wire ASSIGNMENT_ASSIGNED/UPDATED/COMPLETED/REOPENED in `assignments.ts` state-machine actions. Boundary: no incident-event or broadcast code.
2. **Incident events** — INCIDENT_CREATED/UPDATED/CLOSED/ASSIGNED in `incidents.ts`; surface `syncIncidentState` `{before,after}` from assignment close/reopen for INCIDENT_CLOSED. Boundary: no broadcast UI. CLIENT seed permission already present (no change).
3. **Admin broadcast** — SYSTEM/ANNOUNCEMENT: admin page + server action + audience selection. Boundary: only the two manual types.

## Affected Areas

| Area | Impact | Slice |
|------|--------|-------|
| `src/lib/notifications/notify-events.ts` | New | 1 |
| `src/lib/notifications/index.ts` | Modified (exports) | 1 |
| `src/lib/actions/assignments.ts` | Modified (8 call sites; remove `notifyAssignees`) | 1 |
| `src/lib/actions/incidents.ts` | Modified (create/update/fsrs) | 2 |
| `src/lib/state-machine/sync.ts` / assignment close+reopen | Modified (surface `{before,after}`) | 2 |
| `src/lib/auth/...` or new `getAdminUserIds` | New helper | 1 |
| Admin broadcast page + action | New | 3 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Notification volume from "every transition" ASSIGNMENT_UPDATED | High | Medium priority; small FSR audience; revisit with preferences (non-goal) if noisy |
| Surfacing `syncIncidentState` `{before,after}` post-tx | Medium | Return value already exists; just thread it through action return |
| Actor self-notify (FSR closing gets own notification) | Medium | Mandatory `actorId` exclusion in every helper |
| Duplicate in `updateAssignment` when reassignment + edit coincide | Medium | New FSRs get ASSIGNMENT_ASSIGNED only; ASSIGNMENT_UPDATED targets pre-existing FSRs to avoid double-fire |
| CLIENT can't see INCIDENT_CLOSED | Low | Verified: CLIENT already has `notifications:read` in seed — no change needed |
| Extra admin-id query per admin-recipient event | Low | One `getAdminUserIds` query; acceptable for event frequency |

## Rollback Plan

Each slice is an independent stacked PR. Revert a slice's PR to remove its wiring; the central helper and prior slices keep working. Full revert: drop `notify-events.ts`, restore `notifyAssignees`, revert action edits — no schema migration to undo.

## Dependencies

- Existing `createNotificationsForUsers` (bulk) and notification schema — no changes required.

## Success Criteria

- [ ] All 10 notification types fire at their defined event (8 automatic + 2 admin-broadcast).
- [ ] Actor never receives their own action's notification.
- [ ] A notification-write failure never breaks or rolls back the originating operation.
- [ ] No N+1 — every multi-recipient event uses one `createMany`.
- [ ] INCIDENT_CLOSED fires only on real auto-close (before≠CERRADO && after==CERRADO).
- [ ] Admin can broadcast SYSTEM (by audience) and ANNOUNCEMENT (all active) from the new UI.
