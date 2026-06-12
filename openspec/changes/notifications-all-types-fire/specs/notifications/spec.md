# Delta for Notificaciones (Domain 08)

> Change: `notifications-all-types-fire` | RF range: RF-450–RF-499 | Spec file: spec/08-notificaciones.md

---

## MODIFIED Requirements

### Requirement: RF-452 · Trigger: nueva asignación o reasignación

When an assignment is created with FSRs, or when an assignment is updated and new FSRs are added, the system MUST notify each new FSR via `ASSIGNMENT_ASSIGNED`.

The notification helper MUST exclude the `actorId` from recipients. The `try/catch` wrapping MUST ensure a failure never reverts or interrupts the originating operation.

(Previously: only `ASSIGNMENT_ASSIGNED` fired, via `notifyAssignees` in `assignments.ts`, no actorId exclusion specified, `Promise.all` single-write pattern.)

**Rules:**

- Recipients: new FSRs only (not pre-existing, not removed).
- `actorId` MUST be excluded from recipients even if the actor is a new FSR.
- Type: `ASSIGNMENT_ASSIGNED`. Priority: `HIGH` (3).
- `entityType`: `"assignment"`, `entityId`: String assignment ID. `actionUrl`: `/fsr/assignments/{id}`.
- Notification is a POST-transaction side effect. Failure MUST NOT revert the assignment operation.
- `seenAt` and `seenById` MUST be reset to `null` on reassignment (existing rule — unchanged).

#### Scenario: New FSR added to existing assignment receives notification

- GIVEN an assignment with FSR-A already assigned
- WHEN an admin adds FSR-B to that assignment (actor = admin)
- THEN FSR-B receives `ASSIGNMENT_ASSIGNED` with `priority = 3` and `actionUrl = /fsr/assignments/{id}`
- AND FSR-A does NOT receive a new notification
- AND the admin (actor) does NOT receive a notification

#### Scenario: Notification failure does not break assignment operation

- GIVEN a bulk notification write fails with a database error
- WHEN the error is thrown during the notification side-effect
- THEN the assignment is still created/updated successfully
- AND the error is captured (e.g., `console.error`) without propagating

---

## ADDED Requirements

### Requirement: RF-461 · Central notification dispatch helper

The system MUST provide a central `notify-events.ts` module with one typed helper function per `NOTIFICATION_TYPE`. Each helper MUST accept an `actorId` parameter and exclude that user from the recipient list before calling `createNotificationsForUsers`. Each helper MUST be wrapped in `try/catch` so that any notification failure is silently captured and never propagates to the caller.

**Rules:**

- One `createMany` per event (no N+1). If resolved recipient list is empty, no DB call is made.
- `actorId` exclusion is applied after all recipient resolution logic.
- A `getAdminUserIds()` helper MUST return the IDs of all active users with role `ADMINISTRADOR`.
- Legacy `notifyAssignees` in `assignments.ts` MUST be replaced by the central helper calls.

#### Scenario: Actor excluded from notification recipients

- GIVEN FSR-X closes their own assignment (actor = FSR-X)
- WHEN `notifyAssignmentCompleted` is called with `actorId = FSR-X.id`
- THEN FSR-X does NOT receive the `ASSIGNMENT_COMPLETED` notification
- AND all other eligible recipients DO receive it

#### Scenario: Empty recipient list produces no DB write

- GIVEN an event where the only eligible recipient is the actor
- WHEN the helper resolves recipients after actorId exclusion
- THEN `createNotificationsForUsers` is NOT called
- AND no Notification records are created

---

### Requirement: RF-462 · Trigger: assignment status transitions and edits

The system MUST fire `ASSIGNMENT_UPDATED` after every assignment state transition (Visto, Iniciado, Pausado, Reanudado, admin status override) and after any metadata edit (notes, odtFolio edit). Recipients are the active assigned FSRs at the time of the event, excluding the actor.

**Rules:**

- Type: `ASSIGNMENT_UPDATED`. Priority: `MEDIUM` (2).
- `entityType`: `"assignment"`, `entityId`: String assignment ID. `actionUrl`: `/fsr/assignments/{id}`.
- "Active assigned FSRs" means FSRs in `AssignmentAssignee` with `active: true` for that assignment.
- When a reassignment and an edit coincide in a single operation, new FSRs receive `ASSIGNMENT_ASSIGNED` only; `ASSIGNMENT_UPDATED` targets pre-existing FSRs to prevent double-fire.
- Notification is a POST-transaction side effect; failure MUST NOT revert the transition.

#### Scenario: FSR transitions assignment to Iniciado

- GIVEN an assignment with FSR-A and FSR-B assigned
- WHEN FSR-A transitions the assignment to status Iniciado (actor = FSR-A)
- THEN FSR-B receives `ASSIGNMENT_UPDATED` with `priority = 2`
- AND FSR-A (actor) does NOT receive the notification

---

### Requirement: RF-463 · Trigger: assignment closed

The system MUST fire `ASSIGNMENT_COMPLETED` when an assignment transitions to `CERRADO`. Recipients are all assigned FSRs + all active ADMINISTRADOR users, excluding the actor.

**Rules:**

- Type: `ASSIGNMENT_COMPLETED`. Priority: `HIGH` (3).
- `entityType`: `"assignment"`, `entityId`: String assignment ID.
- `getAdminUserIds()` provides admin IDs. The deduplication between FSRs and admins (if any user holds both) is handled by actorId exclusion only; no extra dedup required.
- Notification is POST-transaction; failure MUST NOT revert the close operation.

#### Scenario: FSR closes assignment

- GIVEN an assignment with FSR-A assigned, and two active ADMINISTRADOR accounts
- WHEN FSR-A closes the assignment (actor = FSR-A, status → CERRADO)
- THEN both admins receive `ASSIGNMENT_COMPLETED` with `priority = 3`
- AND FSR-A (actor) does NOT receive the notification

---

### Requirement: RF-464 · Trigger: assignment reopened

The system MUST fire `ASSIGNMENT_REOPENED` when an assignment transitions from `CERRADO` back to `EN_PROGRESO`. Recipients are the active assigned FSRs, excluding the actor.

**Rules:**

- Type: `ASSIGNMENT_REOPENED`. Priority: `HIGH` (3).
- `entityType`: `"assignment"`, `entityId`: String assignment ID.
- Notification is POST-transaction; failure MUST NOT revert the reopen operation.

#### Scenario: Admin reopens a closed assignment

- GIVEN a closed assignment with FSR-A assigned
- WHEN an admin reopens the assignment (actor = admin)
- THEN FSR-A receives `ASSIGNMENT_REOPENED` with `priority = 3`

---

### Requirement: RF-465 · Trigger: incident created

The system MUST fire `INCIDENT_CREATED` after a new incident is persisted. Recipients are all active ADMINISTRADOR users, excluding the actor.

**Rules:**

- Type: `INCIDENT_CREATED`. Priority: `MEDIUM` (2).
- `entityType`: `"incident"`, `entityId`: `String(incidentId)`. `actionUrl`: `/admin/incidents/{id}`.
- Notification is POST-transaction; failure MUST NOT revert the incident creation.

#### Scenario: CLIENT creates an incident

- GIVEN a CLIENT user submits a new incident form (actor = CLIENT user)
- WHEN the incident is persisted successfully
- THEN all active ADMINISTRADOR users receive `INCIDENT_CREATED` with `priority = 2`
- AND the CLIENT (actor) does NOT receive the notification

---

### Requirement: RF-466 · Trigger: incident metadata updated

The system MUST fire `INCIDENT_UPDATED` after an incident's metadata (title, description, type, etc.) is edited. Recipients are the enabled FSRs for that incident (active `IncidentAssignee` records), excluding the actor.

**Rules:**

- Type: `INCIDENT_UPDATED`. Priority: `LOW` (1).
- `entityType`: `"incident"`, `entityId`: `String(incidentId)`.
- "Enabled FSRs" means users linked via `IncidentAssignee` with `active: true`.
- If there are no enabled FSRs at the time of the edit, no notification is sent (no DB write).
- Notification is POST-transaction; failure MUST NOT revert the update.

#### Scenario: Admin edits incident description

- GIVEN an incident with two enabled FSRs (FSR-A, FSR-B)
- WHEN an admin updates the incident description (actor = admin)
- THEN FSR-A and FSR-B each receive `INCIDENT_UPDATED` with `priority = 1`
- AND the admin (actor) does NOT receive the notification

---

### Requirement: RF-467 · Trigger: incident auto-close

The system MUST fire `INCIDENT_CLOSED` only when `syncIncidentState` produces a transition where `before !== CERRADO && after === CERRADO`. Recipients are the incident's reporter (`reportedById`) + all active ADMINISTRADOR users, excluding the actor. The `before`/`after` state values MUST be surfaced from `syncIncidentState` to the calling action so the condition can be evaluated post-transaction.

**Rules:**

- Type: `INCIDENT_CLOSED`. Priority: `HIGH` (3).
- `entityType`: `"incident"`, `entityId`: `String(incidentId)`. `actionUrl`: determined by recipient role (`/client/incidents/{id}` for reporter, `/admin/incidents/{id}` for admins) — a single `actionUrl` value per notification record is acceptable.
- `INCIDENT_CLOSED` MUST NOT fire on intermediate assignment closures when the incident does not yet reach `CERRADO`.
- `INCIDENT_CLOSED` MUST NOT fire when an already-CERRADO incident is re-evaluated without a state change.
- Notification is POST-transaction; failure MUST NOT revert any operation.

#### Scenario: Last assignment closes — incident auto-closes

- GIVEN an incident with two assignments, both currently CERRADO (this close is the last one)
- WHEN `syncIncidentState` transitions the incident `before = EN_PROGRESO → after = CERRADO`
- THEN the incident reporter receives `INCIDENT_CLOSED` with `priority = 3`
- AND all active ADMINISTRADOR users receive `INCIDENT_CLOSED` with `priority = 3`

#### Scenario: Intermediate assignment close does not fire INCIDENT_CLOSED

- GIVEN an incident with two assignments: one CERRADO, one still open
- WHEN the first assignment is closed (`syncIncidentState` returns `before = EN_PROGRESO, after = EN_PROGRESO`)
- THEN `INCIDENT_CLOSED` is NOT fired
- AND no `INCIDENT_CLOSED` Notification records are created

#### Scenario: Re-evaluation of already-closed incident

- GIVEN an incident already in `CERRADO` state
- WHEN `syncIncidentState` is called and returns `before = CERRADO, after = CERRADO`
- THEN `INCIDENT_CLOSED` is NOT fired

---

### Requirement: RF-468 · Trigger: FSR enabled on incident

The system MUST fire `INCIDENT_ASSIGNED` when an `IncidentAssignee` record is created (FSR enabled on an incident). Recipients are the newly enabled FSRs, excluding the actor.

**Rules:**

- Type: `INCIDENT_ASSIGNED`. Priority: `MEDIUM` (2).
- `entityType`: `"incident"`, `entityId`: `String(incidentId)`. `actionUrl`: `/fsr/incidents/{id}` or equivalent FSR incident detail route.
- Notification is POST-transaction; failure MUST NOT revert the enablement.

#### Scenario: Admin enables FSR on incident

- GIVEN an incident with no enabled FSRs
- WHEN an admin enables FSR-A on the incident (actor = admin)
- THEN FSR-A receives `INCIDENT_ASSIGNED` with `priority = 2`

---

### Requirement: RF-469 · Admin broadcast — SYSTEM notification

An ADMINISTRADOR MUST be able to compose and send a `SYSTEM` notification to a chosen audience segment (all active users, or active users filtered by role). The broadcast is initiated via an admin UI page and dispatched via a server action.

**Rules:**

- Type: `SYSTEM`. Priority: `MEDIUM` (2).
- Audience options: all active users OR active users of a specific role.
- The actor (the admin composing the broadcast) is excluded from recipients.
- `entityType`/`entityId`/`actionUrl` are optional; the admin may provide a link.
- `createNotificationsForUsers` MUST be used (one `createMany`).
- Requires `notifications:create` permission (or equivalent admin-only permission gate).

#### Scenario: Admin broadcasts SYSTEM notification to all FSR users

- GIVEN an admin opens the broadcast page and selects audience = FSR role
- WHEN the admin submits with a title and message
- THEN all active FSR users receive a `SYSTEM` notification with `priority = 2`
- AND the admin (actor) does NOT receive the notification

---

### Requirement: RF-470 · Admin broadcast — ANNOUNCEMENT notification

An ADMINISTRADOR MUST be able to compose and send an `ANNOUNCEMENT` notification to ALL active users. The broadcast is initiated via the same admin UI used for SYSTEM and dispatched via a server action.

**Rules:**

- Type: `ANNOUNCEMENT`. Priority: `LOW` (1).
- Audience: all active users (no filtering by role).
- The actor (the admin composing the broadcast) is excluded from recipients.
- `createNotificationsForUsers` MUST be used (one `createMany`).
- Requires `notifications:create` permission (or equivalent admin-only permission gate).

#### Scenario: Admin broadcasts ANNOUNCEMENT to all active users

- GIVEN an admin composes an ANNOUNCEMENT with title and message
- WHEN the admin submits the broadcast
- THEN every active user except the admin (actor) receives an `ANNOUNCEMENT` notification with `priority = 1`

---

## Cross-Cutting Rules (additions to RF-450 transverse section)

The following rules MUST be added to the transversal rules section of spec/08:

1. **Actor exclusion is mandatory.** Every notification dispatch MUST accept `actorId` and exclude that user ID from the recipient list before writing. No notification type is exempt.

2. **Post-transaction isolation.** All notification helpers are called AFTER the DB transaction that produced the event commits. A notification write failure MUST be caught internally and MUST NOT propagate or cause a rollback of the originating operation.

3. **No N+1 writes.** Every multi-recipient event MUST use a single `createMany` via `createNotificationsForUsers`. Looping individual `createNotification` calls is prohibited for multi-recipient events.

4. **Incident `entityId` is String.** Because `Notification.entityId` is `String?`, incident IDs (Int) MUST be cast with `String(incidentId)` before passing to notification helpers.

5. **INCIDENT_CLOSED gate.** The state values `before` and `after` returned by `syncIncidentState` MUST be threaded to the calling action. `INCIDENT_CLOSED` MUST fire if and only if `before !== CERRADO && after === CERRADO`.

---

## RF Mapping Summary

| RF | Status | Title |
|----|--------|-------|
| RF-452 | **MODIFIED** | Trigger: nueva asignación — adds actorId exclusion, replaces `notifyAssignees`, full failure-isolation contract |
| RF-461 | **ADDED** | Central notification dispatch helper (`notify-events.ts`, `getAdminUserIds`, actorId exclusion, try/catch isolation) |
| RF-462 | **ADDED** | Trigger: assignment status transitions and metadata edits (`ASSIGNMENT_UPDATED`) |
| RF-463 | **ADDED** | Trigger: assignment closed (`ASSIGNMENT_COMPLETED`, FSRs + admins) |
| RF-464 | **ADDED** | Trigger: assignment reopened (`ASSIGNMENT_REOPENED`) |
| RF-465 | **ADDED** | Trigger: incident created (`INCIDENT_CREATED`, admins only) |
| RF-466 | **ADDED** | Trigger: incident metadata updated (`INCIDENT_UPDATED`, enabled FSRs) |
| RF-467 | **ADDED** | Trigger: incident auto-close (`INCIDENT_CLOSED`, reporter + admins, before/after gate) |
| RF-468 | **ADDED** | Trigger: FSR enabled on incident (`INCIDENT_ASSIGNED`) |
| RF-469 | **ADDED** | Admin broadcast — SYSTEM (audience-scoped) |
| RF-470 | **ADDED** | Admin broadcast — ANNOUNCEMENT (all active) |

**RF-450, RF-451, RF-453–RF-460 are UNCHANGED** — existing creation, bulk-write, query, read, mark-read, delete, browser-notification, and REST API requirements remain in effect without modification.
