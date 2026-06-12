# Design: Fire All Notification Types

## Technical Approach

One central dispatch module `notify-events.ts` exposes one function per notification type. Every server action, AFTER its `prisma.$transaction` commits, calls the matching `notify*` helper as a POST-tx side effect wrapped in try/catch — a notification failure NEVER rolls back or breaks the originating operation. Recipients are resolved per-event, the `actorId` is always excluded, and multi-recipient events use a single `createNotificationsForUsers` (one `createMany`, no N+1). Incident `entityId` (Int) is coerced to `String(incidentId)` to satisfy the schema. `INCIDENT_CLOSED` fires only on the real auto-close transition, surfaced via the existing `syncIncidentState` `{before, after}` return. Two manual types (SYSTEM/ANNOUNCEMENT) are driven by a new admin broadcast page. Implements proposal matrix verbatim (10 types: 8 auto + 2 admin). Ref spec 08-notificaciones, 04-asignaciones.

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Dispatch location | One module `notify-events.ts`, one fn per type | Inline in each action / event bus | Centralizes recipient resolution + actor exclusion; keeps actions thin; bus is over-engineering for in-app-only |
| Failure isolation | try/catch per call, POST-tx | Inside tx / Promise.allSettled inside tx | Notification is a side effect; must never roll back business op (success criterion) |
| Bulk writes | `createNotificationsForUsers` (createMany) | `Promise.all(createNotification)` (current legacy) | Eliminates N+1; legacy `notifyAssignees` replaced |
| Admin ids | `getAdminUserIds()` helper in notify-events.ts, per-event query | Cache / JWT | Volume is low (per-event, small result); 5-min cache deferred as optional, not needed for slice 1-2 |
| `INCIDENT_CLOSED` trigger | Surface `{before, after}` from tx out of `closeAssignment`/`reopenAssignment`, fire only `before!==CERRADO && after===CERRADO` | Re-query post-tx / fire on every sync | `syncIncidentState` already returns the delta; thread it through the tx return; avoids duplicate/false closes |
| Reassign + edit edge | Disjoint sets: `toAdd` → ASSIGNMENT_ASSIGNED; pre-existing active FSRs → ASSIGNMENT_UPDATED | Send both to everyone | New FSRs already get "assigned" context; avoids double-notify |
| Broadcast route | `/admin/notifications/broadcast` (Server Component + Server Action) | API route | Project default is Server Components; ADMINISTRADOR auto-accesses all `/admin/*` routes (no seed perm needed) |

## notify-events.ts API (concrete signatures)

```ts
// src/lib/notifications/notify-events.ts
import { createNotificationsForUsers } from "./notification-service";
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from "./notification-types";
import { prisma } from "@/lib/database/prisma.singleton";

/** Active ADMINISTRADOR user ids. */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: { active: true, role: { name: "ADMINISTRADOR" } },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

/** Internal: drop actor, skip empty, never throw. */
async function emit(
  userIds: string[],
  actorId: string | null,
  n: Omit<Parameters<typeof createNotificationsForUsers>[1], never>,
) {
  const recipients = [...new Set(userIds)].filter((id) => id && id !== actorId);
  if (recipients.length === 0) return;
  try {
    await createNotificationsForUsers(recipients, n);
  } catch (e) {
    console.error(`notify ${n.type} failed:`, e);
  }
}

export async function notifyAssignmentAssigned(p: {
  assignmentId: string; newFsrIds: string[]; incidentTitle?: string | null; actorId: string;
}) {
  await emit(p.newFsrIds, p.actorId, {
    title: "Nueva asignación",
    message: `Se te asignó una asignación${p.incidentTitle ? ` para el incidente: ${p.incidentTitle}` : ""}.`,
    type: NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED,
    entityType: "assignment", entityId: p.assignmentId,
    actionUrl: `/fsr/assignments/${p.assignmentId}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

export async function notifyIncidentClosed(p: {
  incidentId: number; incidentTitle?: string | null; reporterId: string | null; actorId: string;
}) {
  const recipients = [...(await getAdminUserIds()), ...(p.reporterId ? [p.reporterId] : [])];
  await emit(recipients, p.actorId, {
    title: "Incidencia cerrada",
    message: `La incidencia${p.incidentTitle ? ` "${p.incidentTitle}"` : ""} se cerró.`,
    type: NOTIFICATION_TYPES.INCIDENT_CLOSED,
    entityType: "incident", entityId: String(p.incidentId),
    actionUrl: `/admin/incidents/${p.incidentId}`, // per-recipient override below
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}
```

Functions (one per type): `notifyAssignmentAssigned`, `notifyAssignmentUpdated`, `notifyAssignmentCompleted`, `notifyAssignmentReopened`, `notifyIncidentCreated`, `notifyIncidentUpdated`, `notifyIncidentClosed`, `notifyIncidentAssigned`, `notifyBroadcast(type, recipients, title, message)`. All take `actorId`. `actionUrl` is role-aware: FSR-facing types use `/fsr/...`; admin/reporter-facing (INCIDENT_CREATED, INCIDENT_CLOSED) use `/admin/incidents/{id}` (CLIENT reporter still reads via the shared notification list; a single actionUrl is acceptable for v1 — per-recipient URL split is an open question, see below).

## Sync surfacing plan (INCIDENT_CLOSED)

`syncIncidentState` already returns `{before, after}`. The only change: each transaction that closes/reopens must return that delta so it can be inspected POST-tx.

```ts
// closeAssignment — inside tx, after sync:
const sync = await syncIncidentState(current.incidentId, tx);
return { assignment: updated, incidentId: current.incidentId,
         incidentBefore: sync.before, incidentAfter: sync.after };

// POST-tx:
if (result.incidentBefore !== "CERRADO" && result.incidentAfter === "CERRADO") {
  await notifyIncidentClosed({
    incidentId: result.incidentId,
    incidentTitle: result.assignment.incident?.title,
    reporterId: /* loaded incident.reportedById */ null,
    actorId: user.id,
  });
}
```

Same pattern applies where a sync can flip to CERRADO: `closeAssignment` is the primary trigger. `updateAssignmentStatus` and `markAssignmentSeen`/start/pause/resume cannot reach CERRADO (state machine blocks it), so they need only ASSIGNMENT_UPDATED, not INCIDENT_CLOSED. `reopenAssignment` surfaces `{before, after}` to drive ASSIGNMENT_REOPENED (not INCIDENT_CLOSED). To get `reportedById`, extend the close tx's incident include or do one post-tx `findUnique` (acceptable, off the hot path).

## Event → call map

| Action | notify fn | Recipients | actorId |
|---|---|---|---|
| `createAssignment` | AssignmentAssigned | `uniqueAssignees` | user.id |
| `updateAssignment` | AssignmentAssigned + AssignmentUpdated | `toAdd` → ASSIGNED; pre-existing active (existingIds ∩ newIds) → UPDATED | user.id |
| `updateAssignmentOdtFolio` | AssignmentUpdated | active assignees | user.id |
| `updateAssignmentStatus` | AssignmentUpdated | active assignees | user.id |
| `markAssignmentSeen` | AssignmentUpdated | active assignees | user.id (actor self-excluded) |
| `startAssignmentWork` | AssignmentUpdated | active assignees | user.id |
| `pauseAssignment` / `resumeAssignment` | AssignmentUpdated | active assignees | user.id |
| `closeAssignment` | AssignmentCompleted (+INCIDENT_CLOSED if delta) | assignees + ADMIN; closed → reporter + ADMIN | user.id |
| `reopenAssignment` | AssignmentReopened | active assignees | user.id |
| `createIncident` / `createIncidentAsClient` | IncidentCreated | ADMIN | user.id |
| `updateIncident` | IncidentUpdated (+IncidentAssigned for toAdd) | enabled IncidentAssignees → UPDATED; new IncidentAssignees → ASSIGNED | user.id |
| `updateIncidentFsrs` | IncidentAssigned | new IncidentAssignees (`toAdd`) | user.id |
| `cancelIncident` | (out of matrix — no type) | — | — |

`updateAssignment` edge: load active assignees BEFORE the tx mutation set is computed; `toAdd` (new) get ASSIGNMENT_ASSIGNED only; the intersection of pre-existing-active ∩ still-active get ASSIGNMENT_UPDATED. Sets are disjoint → no double notify. `syncIncidentAssignees` must return its `{toAdd}` so `updateIncident`/`updateIncidentFsrs` can target new FSRs for INCIDENT_ASSIGNED vs pre-existing for INCIDENT_UPDATED.

## Broadcast UI (SYSTEM / ANNOUNCEMENT)

- Route: `/admin/notifications/broadcast/page.tsx` (Server Component, `requireRouteAccess("/admin/notifications/broadcast")`). ADMINISTRADOR auto-accesses all `/admin/*`; NO seed permission change.
- Form (client component `BroadcastForm`): `title`, `message`, `type` (SYSTEM | ANNOUNCEMENT), `audience` (all-active | by-role with role select). ANNOUNCEMENT forces audience=all-active (Low priority); SYSTEM allows role-scoped (Medium).
- Server action `sendBroadcast(input)` in `src/lib/actions/notifications.ts`: `requirePermission("...")` (reuse an admin-only perm, e.g. a route guard or `incidents:create`; final perm chosen at tasks-time — see open question). Resolve recipients: `all-active` → all `user.active=true`; `by-role` → `user.active=true, role.name in selected`. Call `notifyBroadcast(type, recipientIds, title, message)`. actorId = sender (admin excluded from their own broadcast).

## File Changes

| File | Action | Slice |
|---|---|---|
| `src/lib/notifications/notify-events.ts` | Create (all fns + getAdminUserIds + emit) | 1 |
| `src/lib/notifications/index.ts` | Modify (export notify-events) | 1 |
| `src/lib/actions/assignments.ts` | Modify (remove `notifyAssignees`; wire 8 call sites; surface deltas) | 1/2 |
| `src/lib/actions/incidents.ts` | Modify (wire create/update/fsrs; `syncIncidentAssignees` returns toAdd) | 2 |
| `src/app/admin/notifications/broadcast/page.tsx` | Create | 3 |
| `src/components/notifications/broadcast-form.tsx` | Create | 3 |
| `src/lib/actions/notifications.ts` | Create (`sendBroadcast`) | 3 |

## Slicing Plan (stacked-to-main, chained)

1. **Core + assignment events** (~180-230 LOC): `notify-events.ts`, `getAdminUserIds`, replace `notifyAssignees`; wire ASSIGNMENT_ASSIGNED/UPDATED/COMPLETED/REOPENED across the 8 assignment actions + surface `closeAssignment` delta for INCIDENT_CLOSED stub-ready. Boundary: no incidents.ts, no broadcast. Independent: assignment notifications fire end-to-end. Rollback: revert PR, legacy behavior was already replaced so revert restores nothing broken (helper removed). Depends on: nothing.
2. **Incident events** (~120-160 LOC): INCIDENT_CREATED/UPDATED/CLOSED/ASSIGNED in incidents.ts; `syncIncidentAssignees` returns `{toAdd}`; wire INCIDENT_CLOSED from slice-1 surfaced delta. Boundary: no broadcast UI. Depends on: slice 1 (`notify-events.ts`). Rollback: revert removes incident wiring; assignment events keep working.
3. **Admin broadcast** (~140-180 LOC): page + form + `sendBroadcast` action for SYSTEM/ANNOUNCEMENT with audience. Boundary: only the 2 manual types. Depends on: slice 1 (`notifyBroadcast`). Rollback: revert removes the page/action only.

Total estimate ~440-570 LOC across 3 PRs; each under the 400-line budget individually.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `emit` actor-exclusion + empty-skip; close delta predicate | pure-fn / mocked prisma |
| Integration | each action fires correct type/recipients; failure isolation (notify throws → action still succeeds) | seed + action call |
| Manual | broadcast audience resolution; INCIDENT_CLOSED only on real auto-close | dev DB |

## Migration / Rollout

No schema migration. CLIENT already has `notifications:read/update/delete` in seed (`prisma/seed.ts:901`) — no seed change.

## Open Questions

- [ ] Per-recipient `actionUrl` for INCIDENT_CLOSED (admin `/admin/...` vs client `/client/...`): v1 ships a single admin URL; split deferred unless required.
- [ ] Exact permission gating `sendBroadcast` (dedicated `notifications:broadcast` vs reuse existing admin perm). Resolve at tasks-time; default = admin-route guard, no seed change.
