# Tasks: notifications-all-types-fire

> Delivery strategy: stacked-to-main (3 PRs)
> Chain: s1 → s2, s1 → s3 (s2 and s3 parallel after s1 merges)
> Strict TDD: disabled — manual verification criteria per slice

---

## Dependency Graph

```
main
 └── s1: feat/notifications-assignment-events  ──► merge to main
      ├── s2: feat/notifications-incident-events  ──► merge to main (after s1)
      └── s3: feat/notifications-broadcast        ──► merge to main (after s1, parallel with s2)
```

---

## Review Workload Forecast

| Slice | Estimated LOC | 400-line risk |
|-------|--------------|---------------|
| s1 — Core + Assignment events | 200–240 | Low |
| s2 — Incident events | 130–165 | Low |
| s3 — Admin broadcast | 120–170 | Low |
| **Total** | **450–575** | **Low per PR** |

- **Chained PRs recommended:** Yes (total exceeds 400 LOC; each PR comfortably under 400)
- **Decision needed before apply:** No (stacked-to-main already confirmed)

---

## SLICE 1 — Core + Assignment Events

**Branch:** `feat/notifications-assignment-events`
**PR target:** `main`
**Depends on:** nothing
**Blocks:** Slice 2, Slice 3
**Spec requirements:** RF-452 (modified), RF-461, RF-462, RF-463, RF-464

### PR 1 Chain Context

| Field | Value |
|-------|-------|
| Start state | `notifyAssignees` legacy function in assignments.ts; no notify-events.ts |
| End state | Central notify-events.ts with emit(), getAdminUserIds(), 4 assignment event fns wired across 8 action sites |
| Out of scope | Incident events, broadcast UI |
| Follow-up | s2 (incident events), s3 (broadcast) |
| Rollback | Delete notify-events.ts; revert assignments.ts to notifyAssignees; revert index.ts export |

### Tasks

#### [x] T1.1 — Create `src/lib/notifications/notify-events.ts` (new file)

**Satisfies:** RF-461

- Internal `emit(userIds: string[], actorId: string, payload: NotificationPayload)`:
  - Deduplicate userIds via `new Set(userIds)`
  - Remove actorId from recipient set
  - Skip (return early) if resulting set is empty
  - Call `createNotificationsForUsers` in `try/catch`; never throw — log error only
- `getAdminUserIds(): Promise<string[]>`:
  - Query `prisma.user.findMany({ where: { active: true, role: { name: "ADMINISTRADOR" } }, select: { id: true } })`
  - Return `string[]` of IDs
- Public assignment functions (all accept `actorId: string` as last param):
  - `notifyAssignmentAssigned(assignmentId, incidentTitle, recipientIds, actorId)`:
    - type=ASSIGNMENT_ASSIGNED, priority=HIGH
    - title="Nueva asignación"
    - message="Se te ha asignado la asignación para: {incidentTitle}"
    - entityType="assignment", entityId=assignmentId
    - actionUrl=`/fsr/assignments/${assignmentId}`
  - `notifyAssignmentUpdated(assignmentId, incidentTitle, recipientIds, actorId)`:
    - type=ASSIGNMENT_UPDATED, priority=MEDIUM
    - title="Asignación actualizada"
    - message="Tu asignación ha sido actualizada: {incidentTitle}"
    - entityType="assignment", entityId=assignmentId
    - actionUrl=`/fsr/assignments/${assignmentId}`
  - `notifyAssignmentCompleted(assignmentId, incidentTitle, recipientIds, actorId)`:
    - type=ASSIGNMENT_COMPLETED, priority=HIGH
    - title="Asignación completada"
    - message="La asignación fue completada: {incidentTitle}"
    - entityType="assignment", entityId=assignmentId
    - actionUrl=`/fsr/assignments/${assignmentId}`
  - `notifyAssignmentReopened(assignmentId, incidentTitle, recipientIds, actorId)`:
    - type=ASSIGNMENT_REOPENED, priority=HIGH
    - title="Asignación reabierta"
    - message="La asignación fue reabierta: {incidentTitle}"
    - entityType="assignment", entityId=assignmentId
    - actionUrl=`/fsr/assignments/${assignmentId}`
- `notifyBroadcast` stub (minimal, returns void — fully implemented in s3):
  - Signature: `notifyBroadcast(type, recipientIds, title, message, actorId): Promise<void>`
  - Body: empty for now

#### [x] T1.2 — Export from `src/lib/notifications/index.ts` (modify)

**Satisfies:** RF-461

- Add: `export * from "./notify-events"`

#### [x] T1.3 — Wire assignment events in `src/lib/actions/assignments.ts` (modify)

**Satisfies:** RF-452, RF-462, RF-463, RF-464

- Remove `notifyAssignees` internal function (lines ~58–93)
- Add import of `notifyAssignmentAssigned`, `notifyAssignmentUpdated`, `notifyAssignmentCompleted`, `notifyAssignmentReopened` from `@/lib/notifications`
- Add import of `getAdminUserIds` from `@/lib/notifications`

**8 wiring sites (all POST-tx):**

| Action | Event fired | Recipients | Notes |
|--------|-------------|------------|-------|
| `createAssignment` | ASSIGNMENT_ASSIGNED | uniqueAssignees | Only when uniqueAssignees.length > 0 |
| `updateAssignment` | ASSIGNMENT_ASSIGNED | toAdd | Only new FSRs |
| `updateAssignment` | ASSIGNMENT_UPDATED | preExistingActiveIds | Active assignees NOT in toAdd (disjoint); thread from tx return |
| `markAssignmentSeen` | ASSIGNMENT_UPDATED | active assignees | Skip if noop |
| `startAssignmentWork` | ASSIGNMENT_UPDATED | active assignees | |
| `pauseAssignment` | ASSIGNMENT_UPDATED | active assignees | |
| `resumeAssignment` | ASSIGNMENT_UPDATED | active assignees | |
| `closeAssignment` | ASSIGNMENT_COMPLETED | assignees + admins | recipients = result.assignment.assignees.map(a => a.userId) + await getAdminUserIds() |
| `updateAssignmentStatus` | ASSIGNMENT_UPDATED | active assignees | Admin override |
| `reopenAssignment` | ASSIGNMENT_REOPENED | active assignees | |

- For `updateAssignment`, thread `preExisting` out of the transaction result (compute inside tx: existing active IDs - toRemove, filtered to exclude toAdd)
- For `closeAssignment`, thread `{ incidentBefore, incidentAfter }` from `syncIncidentState` return through the transaction result object. Add `// TODO(s2): wire INCIDENT_CLOSED here` comment
- `user.id` is available from `requirePermission` return in each action (already present)
- Active assignee IDs extracted from `result.assignment.assignees.map(a => a.userId)` (assigneesInclude already in each tx include)

#### [x] T1.4 — Manual verification (no test suite)

- `npm run build` passes with no TypeScript errors
- Create assignment with FSRs → FSRs receive ASSIGNMENT_ASSIGNED; actor does NOT receive it
- Update assignment (notes only, no new FSRs) → existing FSRs receive ASSIGNMENT_UPDATED
- Update assignment (add new FSR) → new FSR receives ASSIGNMENT_ASSIGNED; existing FSRs receive ASSIGNMENT_UPDATED (disjoint, no double-fire)
- Close assignment → assignees + all admins receive ASSIGNMENT_COMPLETED; actor excluded
- Reopen assignment → assignees receive ASSIGNMENT_REOPENED
- Simulate notification failure (break connection) → assignment change persists without error

---

## SLICE 2 — Incident Events

**Branch:** `feat/notifications-incident-events` (branched off main after s1 merges)
**PR target:** `main`
**Depends on:** Slice 1 (notify-events.ts, emit(), index.ts export)
**Blocks:** nothing (s3 is independent)
**Spec requirements:** RF-465, RF-466, RF-467, RF-468

### PR 2 Chain Context

| Field | Value |
|-------|-------|
| Start state | s1 merged; notify-events.ts exists without notifyIncident* fns; syncIncidentAssignees returns void |
| End state | 4 incident types wired; syncIncidentAssignees returns { toAdd }; INCIDENT_CLOSED gate live in closeAssignment |
| Out of scope | Broadcast UI |
| Rollback | Remove notifyIncident* from notify-events.ts; revert syncIncidentAssignees to void; remove incident event calls; revert closeAssignment INCIDENT_CLOSED wiring |

### Tasks

#### T2.1 — Add incident notification functions to `src/lib/notifications/notify-events.ts` (modify)

**Satisfies:** RF-465, RF-466, RF-467, RF-468

- `notifyIncidentCreated(incidentId: number, incidentTitle: string, actorId: string)`:
  - recipients = await getAdminUserIds()
  - type=INCIDENT_CREATED, priority=MEDIUM
  - title="Nuevo incidente reportado"
  - message="Se reportó un nuevo incidente: {incidentTitle}"
  - entityType="incident", entityId=String(incidentId)
  - actionUrl=`/admin/incidents/${incidentId}`

- `notifyIncidentUpdated(incidentId: number, incidentTitle: string, recipientIds: string[], actorId: string)`:
  - recipients = recipientIds (enabled FSR IDs, passed in)
  - Skips if empty (emit() handles it)
  - type=INCIDENT_UPDATED, priority=LOW
  - title="Incidente actualizado"
  - message="El incidente ha sido actualizado: {incidentTitle}"
  - entityType="incident", entityId=String(incidentId)
  - actionUrl=`/fsr/assignments` (no specific incident route for FSRs yet)

- `notifyIncidentClosed(incidentId: number, incidentTitle: string, reporterId: string | null, actorId: string)`:
  - recipients = [reporterId].filter(Boolean) + (await getAdminUserIds())
  - type=INCIDENT_CLOSED, priority=HIGH
  - title="Incidente cerrado"
  - message="El incidente fue cerrado: {incidentTitle}"
  - entityType="incident", entityId=String(incidentId)
  - actionUrl=`/admin/incidents/${incidentId}`

- `notifyIncidentAssigned(incidentId: number, incidentTitle: string, newFsrIds: string[], actorId: string)`:
  - recipients = newFsrIds (new/re-enabled FSRs)
  - type=INCIDENT_ASSIGNED, priority=MEDIUM
  - title="Asignado a incidente"
  - message="Se te ha asignado al incidente: {incidentTitle}"
  - entityType="incident", entityId=String(incidentId)
  - actionUrl=`/fsr/assignments`

#### T2.2 — `syncIncidentAssignees` return type change in `src/lib/actions/incidents.ts` (modify)

**Satisfies:** RF-468 (needed to isolate toAdd for INCIDENT_ASSIGNED)

- Change return type from `Promise<void>` to `Promise<{ toAdd: string[] }>`
- Add `return { toAdd }` at end of function (toAdd already computed locally)
- Update 3 call sites:
  - `updateIncident`: `const { toAdd } = await syncIncidentAssignees(id, data.assigneeIds)`
  - `updateIncidentFsrs`: `const { toAdd } = await syncIncidentAssignees(incidentId, fsrIds)`
  - Bulk import call site (line ~1681): `await syncIncidentAssignees(...)` — can discard result with `void syncIncidentAssignees(...)` or capture if notifications desired there (bulk import is out of scope for notification firing; ignore toAdd)

#### T2.3 — Wire incident events in `src/lib/actions/incidents.ts` (modify)

**Satisfies:** RF-465, RF-466, RF-467, RF-468

- Add import: `notifyIncidentCreated`, `notifyIncidentUpdated`, `notifyIncidentClosed`, `notifyIncidentAssigned` from `@/lib/notifications`

**Wiring sites:**

| Action | Event | Recipients | Trigger condition |
|--------|-------|------------|-------------------|
| `createIncident` | INCIDENT_CREATED | admins (via notifyIncidentCreated) | after prisma.incident.create |
| `createIncidentAsClient` | INCIDENT_CREATED | admins | after prisma.incident.create |
| `updateIncident` | INCIDENT_UPDATED | existing active IncidentAssignee IDs | query after syncIncidentAssignees; skip if empty |
| `updateIncident` | INCIDENT_ASSIGNED | toAdd (from syncIncidentAssignees) | only when toAdd.length > 0 |
| `updateIncidentFsrs` | INCIDENT_ASSIGNED | toAdd | only when toAdd.length > 0; add `title` to existing incident query |

- For `updateIncidentFsrs`: the existing query `prisma.incident.findUnique({ where: { id: incidentId }, select: { clienteId: true } })` must also include `title: true` to populate notification message

#### T2.4 — Wire INCIDENT_CLOSED in `src/lib/actions/assignments.ts` (modify)

**Satisfies:** RF-467

- Add import: `notifyIncidentClosed` from `@/lib/notifications`
- In `closeAssignment` POST-tx block, replace `// TODO(s2)` comment with:
  ```
  if (result.incidentBefore !== "CERRADO" && result.incidentAfter === "CERRADO") {
    const incidentData = await prisma.incident.findUnique({
      where: { id: result.incidentId },
      select: { reportedById: true, title: true },
    });
    await notifyIncidentClosed(
      result.incidentId,
      incidentData?.title ?? "",
      incidentData?.reportedById ?? null,
      user.id,
    );
  }
  ```
- `result.incidentBefore` and `result.incidentAfter` already threaded from s1 (syncIncidentState return)

#### T2.5 — Manual verification (no test suite)

- `npm run build` passes
- Create incident → all active ADMINISTRADOR users receive INCIDENT_CREATED notification
- Update incident (metadata) → enabled FSRs receive INCIDENT_UPDATED; actor excluded
- Update incident FSRs (add new FSR) → new FSR receives INCIDENT_ASSIGNED; existing FSRs receive INCIDENT_UPDATED
- updateIncidentFsrs (quick-edit) → new FSRs receive INCIDENT_ASSIGNED
- Close last assignment of incident (all assignments reach CERRADO) → reporter + admins receive INCIDENT_CLOSED
- Re-trigger syncIncidentState on already-closed incident → INCIDENT_CLOSED does NOT fire again
- entityId in notifications for incidents is a string (String(id)), not a number

---

## SLICE 3 — Admin Broadcast

**Branch:** `feat/notifications-broadcast` (branched off main after s1 merges)
**PR target:** `main`
**Depends on:** Slice 1 (notifyBroadcast stub in notify-events.ts + emit())
**Blocks:** nothing
**Parallel with:** Slice 2
**Spec requirements:** RF-469, RF-470

### PR 3 Chain Context

| Field | Value |
|-------|-------|
| Start state | s1 merged; notifyBroadcast is a no-op stub; no broadcast page |
| End state | notifyBroadcast fully implemented; /admin/notifications/broadcast page live; sendBroadcast action |
| Out of scope | Per-user notification preferences; non-admin broadcast |
| Rollback | Delete page.tsx, broadcast-form.tsx; remove sendBroadcast from notifications.ts; revert notifyBroadcast to stub |

### Tasks

#### T3.1 — Complete `notifyBroadcast` in `src/lib/notifications/notify-events.ts` (modify)

**Satisfies:** RF-469, RF-470

- Replace stub with full implementation
- Signature: `notifyBroadcast(type: "system" | "announcement", recipientIds: string[], title: string, message: string, actorId: string): Promise<void>`
- Map type:
  - "system" → NOTIFICATION_TYPES.SYSTEM, priority=MEDIUM
  - "announcement" → NOTIFICATION_TYPES.ANNOUNCEMENT, priority=LOW
- Call `emit(recipientIds, actorId, { title, message, type: mappedType, priority, entityType: null })`
- No entityType/entityId for broadcast (general notification)

#### T3.2 — Add `sendBroadcast` to `src/lib/actions/notifications.ts` (modify)

**Satisfies:** RF-469, RF-470

- Add `BroadcastInput` type:
  ```ts
  type BroadcastInput = {
    title: string;
    message: string;
    type: "system" | "announcement";
    audience: "all" | "by-role";
    roleId?: string;
  }
  ```
- Input validation (throw Error if invalid):
  - title: non-empty string
  - message: non-empty string
  - type: must be "system" or "announcement"
  - if audience === "by-role": roleId must be non-empty
- Auth: `const user = await requirePermission("notifications:read")` — route is /admin/* so ADMINISTRADOR auto-passes middleware; no new DB permission needed
- Resolve recipients:
  - audience === "all": `prisma.user.findMany({ where: { active: true }, select: { id: true } })`
  - audience === "by-role": `prisma.user.findMany({ where: { active: true, roleId: data.roleId }, select: { id: true } })`
  - Extract: `recipientIds = users.map(u => u.id)`
- Call: `await notifyBroadcast(data.type, recipientIds, data.title, data.message, user.id)`
- Return: `{ success: true, count: recipientIds.length }`
- Import `prisma` from `@/lib/database/prisma.singleton` (already needed) and `notifyBroadcast` from `@/lib/notifications`

#### T3.3 — Create `src/app/admin/notifications/broadcast/page.tsx` (new)

**Satisfies:** RF-469, RF-470

- Server Component (`async function`)
- `await requireRouteAccess("/admin/notifications/broadcast")` — ADMINISTRADOR auto-accesses all /admin/* (no seed/permission change needed)
- Fetch roles: `await prisma.role.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })`
- Render: page container, heading "Difusión de notificaciones", description "Envía una notificación a todos los usuarios o a un rol específico.", `<BroadcastForm roles={roles} />`
- Import `BroadcastForm` from `@/components/notifications/broadcast-form`

#### T3.4 — Create `src/components/notifications/broadcast-form.tsx` (new)

**Satisfies:** RF-469, RF-470

- `"use client"`
- Props: `{ roles: { id: string; name: string }[] }`
- State: `title`, `message`, `type` ("system" | "announcement"), `audience` ("all" | "by-role"), `roleId`, `status` (idle | loading | success | error), `count`, `errorMessage`
- Form fields (shadcn/ui components):
  - Input: label "Título" (required)
  - Textarea: label "Mensaje" (required)
  - Select: label "Tipo" — options: "Sistema" (value="system"), "Anuncio" (value="announcement")
  - RadioGroup or Select: label "Audiencia" — options: "Todos los usuarios activos" (value="all"), "Por rol" (value="by-role")
  - Select (conditional, shown when audience="by-role"): label "Rol" — options from roles prop
- Submit button: "Enviar notificación" (disabled while loading)
- Success message: "Notificación enviada a {count} usuarios"
- Error message: `errorMessage`
- On submit: call `sendBroadcast({ title, message, type, audience, roleId })`, handle success/error state
- Import `sendBroadcast` from `@/lib/actions/notifications`

#### T3.5 — Manual verification

- `npm run build` passes
- Navigate to /admin/notifications/broadcast as ADMINISTRADOR → page renders with form
- FSR/CLIENT/GUEST navigate to same path → redirected to /unauthorized
- Submit SYSTEM broadcast, audience=all → all active users except actor receive notification with type=system, priority=MEDIUM
- Submit ANNOUNCEMENT broadcast → all active users except actor receive notification with type=announcement, priority=LOW
- Submit SYSTEM broadcast, audience=by-role, role=FSR → only FSR role users receive notification
- Submit with empty title → client validation prevents submission
- Success counter shows correct number of intended recipients (excluding actor)

---

## Notification Titles and Messages (neutral Spanish)

| Event | Title | Message template |
|-------|-------|-----------------|
| ASSIGNMENT_ASSIGNED | Nueva asignación | Se te ha asignado la asignación para: {incidentTitle} |
| ASSIGNMENT_UPDATED | Asignación actualizada | Tu asignación ha sido actualizada: {incidentTitle} |
| ASSIGNMENT_COMPLETED | Asignación completada | La asignación fue completada: {incidentTitle} |
| ASSIGNMENT_REOPENED | Asignación reabierta | La asignación fue reabierta: {incidentTitle} |
| INCIDENT_CREATED | Nuevo incidente reportado | Se reportó un nuevo incidente: {incidentTitle} |
| INCIDENT_UPDATED | Incidente actualizado | El incidente ha sido actualizado: {incidentTitle} |
| INCIDENT_CLOSED | Incidente cerrado | El incidente fue cerrado: {incidentTitle} |
| INCIDENT_ASSIGNED | Asignado a incidente | Se te ha asignado al incidente: {incidentTitle} |
| SYSTEM (broadcast) | (user-provided) | (user-provided) |
| ANNOUNCEMENT (broadcast) | (user-provided) | (user-provided) |
