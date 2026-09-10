import { getVacationApprovers, operationsAudience } from "./audiences";
import { dispatch } from "./dispatch";
import { ENTITY_TYPES, NOTIFICATION_TYPES } from "./notification-types";

// ---------------------------------------------------------------------------
// Thin facade: every helper below resolves its audience and delegates to
// `dispatch`, which renders the copy from the catalog, consults the channel
// policy and never throws. The public names and signatures are unchanged, so
// the ~20 call sites in actions/ and assignments/ do not move.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Assignment notification helpers (RF-452, RF-461–RF-464)
// ---------------------------------------------------------------------------

/**
 * RF-452: Fires when new FSRs are added to an assignment.
 * Recipients: newRecipientIds (actor always excluded by dispatch).
 */
export async function notifyAssignmentAssigned(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED, {
    recipients: recipientIds,
    actorId,
    ctx: { assignmentId, incidentTitle },
    entity: { type: ENTITY_TYPES.ASSIGNMENT, id: assignmentId },
  });
}

/**
 * RF-462: Fires on every assignment transition. Recipients: existing active
 * FSRs, actor excluded. New FSRs added at the same time get ASSIGNED.
 */
export async function notifyAssignmentUpdated(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_UPDATED, {
    recipients: recipientIds,
    actorId,
    ctx: { assignmentId, incidentTitle },
    entity: { type: ENTITY_TYPES.ASSIGNMENT, id: assignmentId },
  });
}

/**
 * RF-463: Fires when assignment transitions to CERRADO.
 * Recipients: active assigned FSRs + the operations audience, actor excluded.
 */
export async function notifyAssignmentCompleted(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED, {
    recipients: recipientIds,
    actorId,
    ctx: { assignmentId, incidentTitle },
    entity: { type: ENTITY_TYPES.ASSIGNMENT, id: assignmentId },
  });
}

/**
 * RF-464: Fires when assignment is reopened (CERRADO → EN_PROGRESO).
 * Recipients: active assigned FSRs, actor excluded.
 */
export async function notifyAssignmentReopened(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.ASSIGNMENT_REOPENED, {
    recipients: recipientIds,
    actorId,
    ctx: { assignmentId, incidentTitle },
    entity: { type: ENTITY_TYPES.ASSIGNMENT, id: assignmentId },
  });
}

// ---------------------------------------------------------------------------
// Incident notification helpers (RF-465, RF-466, RF-467, RF-468)
// ---------------------------------------------------------------------------

/**
 * RF-465: Fires after a new incident is persisted.
 * Recipients: the operations audience of the incident's Client, actor excluded.
 */
export async function notifyIncidentCreated(
  incidentId: number,
  incidentTitle: string | null | undefined,
  actorId: string,
  clientId: string | null | undefined,
): Promise<void> {
  const adminIds = await operationsAudience(clientId);
  await dispatch(NOTIFICATION_TYPES.INCIDENT_CREATED, {
    recipients: adminIds,
    actorId,
    ctx: { incidentId, incidentTitle },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * RF-466: Fires after incident metadata is updated.
 * Recipients: enabled FSRs (active IncidentAssignee), actor excluded.
 */
export async function notifyIncidentUpdated(
  incidentId: number,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.INCIDENT_UPDATED, {
    recipients: recipientIds,
    actorId,
    ctx: { incidentId, incidentTitle },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * RF-467: Fires ONLY when the incident transitions to CERRADO (auto-close gate).
 * Recipients: reporter + the operations audience of the incident's Client.
 */
export async function notifyIncidentClosed(
  incidentId: number,
  incidentTitle: string | null | undefined,
  reporterIdOrNull: string | null | undefined,
  actorId: string,
  clientId: string | null | undefined,
): Promise<void> {
  const adminIds = await operationsAudience(clientId);
  await dispatch(NOTIFICATION_TYPES.INCIDENT_CLOSED, {
    recipients: [...(reporterIdOrNull ? [reporterIdOrNull] : []), ...adminIds],
    actorId,
    ctx: { incidentId, incidentTitle },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * RF-468: Fires when new FSRs are enabled on an incident.
 * Recipients: new FSR IDs, actor excluded.
 */
export async function notifyIncidentAssigned(
  incidentId: number,
  incidentTitle: string | null | undefined,
  newFsrIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.INCIDENT_ASSIGNED, {
    recipients: newFsrIds,
    actorId,
    ctx: { incidentId, incidentTitle },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

// ---------------------------------------------------------------------------
// Vacation notification helpers
// ---------------------------------------------------------------------------

/**
 * Fires when a vacation request is created.
 * Recipients: whoever can approve it (`vacations:approve`), actor excluded.
 */
export async function notifyVacationRequested(
  vacationId: string,
  requesterName: string | null | undefined,
  actorId: string,
): Promise<void> {
  const adminIds = await getVacationApprovers();
  await dispatch(NOTIFICATION_TYPES.VACATION_REQUESTED, {
    recipients: adminIds,
    actorId,
    ctx: { vacationId, requesterName },
    entity: { type: ENTITY_TYPES.VACATION, id: vacationId },
  });
}

/**
 * Fires when a vacation request is approved.
 * Recipients: the requester (actor excluded, so self-approval stays silent).
 */
export async function notifyVacationApproved(
  vacationId: string,
  requesterId: string,
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.VACATION_APPROVED, {
    recipients: [requesterId],
    actorId,
    ctx: { vacationId },
    entity: { type: ENTITY_TYPES.VACATION, id: vacationId },
  });
}

/**
 * Fires when a vacation request is rejected.
 * Recipients: the requester (actor excluded).
 */
export async function notifyVacationRejected(
  vacationId: string,
  requesterId: string,
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.VACATION_REJECTED, {
    recipients: [requesterId],
    actorId,
    ctx: { vacationId },
    entity: { type: ENTITY_TYPES.VACATION, id: vacationId },
  });
}

// ---------------------------------------------------------------------------
// Broadcast helpers (RF-469, RF-470)
// ---------------------------------------------------------------------------

/**
 * RF-469 / RF-470: Admin broadcast notification.
 * Recipients are pre-resolved by the caller (sendBroadcast server action).
 * entityType/entityId are null for broadcast messages.
 */
export async function notifyBroadcast(
  type: "system" | "announcement",
  recipientIds: string[],
  title: string,
  message: string,
  actorId: string,
): Promise<void> {
  await dispatch(
    type === "system"
      ? NOTIFICATION_TYPES.SYSTEM
      : NOTIFICATION_TYPES.ANNOUNCEMENT,
    { recipients: recipientIds, actorId, ctx: { title, message } },
  );
}
