import { prisma } from "@/lib/database/prisma.singleton";
import { logger } from "@/lib/observability/logger";
import { INCIDENT_STATE } from "@/lib/state-machine/incident-machine";
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
 * Recipients: reporter + the operations audience of the incident's Client +
 * the FSRs enabled on the incident, actor excluded.
 */
export async function notifyIncidentClosed(
  incidentId: number,
  incidentTitle: string | null | undefined,
  reporterIdOrNull: string | null | undefined,
  actorId: string | null,
  clientId: string | null | undefined,
): Promise<void> {
  const [adminIds, fsrIds] = await Promise.all([
    operationsAudience(clientId),
    activeIncidentFsrIds(incidentId),
  ]);
  await dispatch(NOTIFICATION_TYPES.INCIDENT_CLOSED, {
    recipients: [
      ...(reporterIdOrNull ? [reporterIdOrNull] : []),
      ...fsrIds,
      ...adminIds,
    ],
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
// Incident phase transitions (Phase 3: the after-commit collector records
// them in `syncIncidentState`, and the mapper below routes each transition
// to its event; regressions that are not a reopen stay silent).
// ---------------------------------------------------------------------------

/** Incident context captured at transition time for the deferred dispatch. */
export interface IncidentTransitionSnapshot {
  title: string | null | undefined;
  reporterId: string | null | undefined;
  clientId: string | null | undefined;
}

/** FSRs enabled on the incident. Fail closed, like every other audience. */
async function activeIncidentFsrIds(incidentId: number): Promise<string[]> {
  try {
    const rows = await prisma.incidentAssignee.findMany({
      where: { incidentId, active: true },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  } catch (error) {
    logger.error("[notify-events] Error resolving incident FSRs:", error);
    return [];
  }
}

const PHASE_EVENT = {
  [INCIDENT_STATE.ASIGNADO]: NOTIFICATION_TYPES.INCIDENT_PHASE_ASIGNADO,
  [INCIDENT_STATE.VISTO]: NOTIFICATION_TYPES.INCIDENT_PHASE_VISTO,
  [INCIDENT_STATE.INICIADO]: NOTIFICATION_TYPES.INCIDENT_PHASE_INICIADO,
  [INCIDENT_STATE.EN_PROGRESO]: NOTIFICATION_TYPES.INCIDENT_PHASE_EN_PROGRESO,
} as const;

/** Rank for forward-progress comparison. CANCELADA never flows through here. */
const PHASE_RANK: Record<string, number> = {
  [INCIDENT_STATE.ABIERTO]: 0,
  [INCIDENT_STATE.ASIGNADO]: 1,
  [INCIDENT_STATE.VISTO]: 2,
  [INCIDENT_STATE.INICIADO]: 3,
  [INCIDENT_STATE.EN_PROGRESO]: 4,
  [INCIDENT_STATE.CERRADO]: 5,
};

/**
 * Forward phase step (ASIGNADO / VISTO / INICIADO / EN_PROGRESO).
 * Recipients: whoever reported it + the operations audience, actor excluded.
 */
export async function notifyIncidentPhase(
  incidentId: number,
  phase: keyof typeof PHASE_EVENT,
  snapshot: IncidentTransitionSnapshot,
  actorId: string | null,
): Promise<void> {
  const adminIds = await operationsAudience(snapshot.clientId);
  await dispatch(PHASE_EVENT[phase], {
    recipients: [
      ...(snapshot.reporterId ? [snapshot.reporterId] : []),
      ...adminIds,
    ],
    actorId,
    ctx: { incidentId, incidentTitle: snapshot.title },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * Fires on CERRADO → EN_PROGRESO (any other exit from CERRADO too).
 * Recipients: reporter + operations + the assigned FSRs, actor excluded.
 */
export async function notifyIncidentReopened(
  incidentId: number,
  snapshot: IncidentTransitionSnapshot,
  actorId: string | null,
): Promise<void> {
  const [adminIds, fsrIds] = await Promise.all([
    operationsAudience(snapshot.clientId),
    activeIncidentFsrIds(incidentId),
  ]);
  await dispatch(NOTIFICATION_TYPES.INCIDENT_REOPENED, {
    recipients: [
      ...(snapshot.reporterId ? [snapshot.reporterId] : []),
      ...fsrIds,
      ...adminIds,
    ],
    actorId,
    ctx: { incidentId, incidentTitle: snapshot.title },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * Fires from `cancelIncident()`. CANCELADA is terminal and set directly, so
 * it never flows through `syncIncidentState` — this is called post-commit.
 * Recipients: reporter + assigned FSRs + operations, actor excluded.
 */
export async function notifyIncidentCancelled(
  incidentId: number,
  snapshot: IncidentTransitionSnapshot,
  actorId: string | null,
): Promise<void> {
  const [adminIds, fsrIds] = await Promise.all([
    operationsAudience(snapshot.clientId),
    activeIncidentFsrIds(incidentId),
  ]);
  await dispatch(NOTIFICATION_TYPES.INCIDENT_CANCELLED, {
    recipients: [
      ...(snapshot.reporterId ? [snapshot.reporterId] : []),
      ...fsrIds,
      ...adminIds,
    ],
    actorId,
    ctx: { incidentId, incidentTitle: snapshot.title },
    entity: { type: ENTITY_TYPES.INCIDENT, id: String(incidentId) },
  });
}

/**
 * Route one incident transition to its event.
 *
 * - Forward phase step → `incident_phase_*` (reporter + operations).
 * - Any step into CERRADO → `incident_closed` (reporter + operations + FSRs).
 * - Any exit from CERRADO → `incident_reopened` (reporter + operations + FSRs).
 * - Anything else (same-state, regressions like ASIGNADO → ABIERTO,
 *   CANCELADA) stays silent. `incident_updated` keeps its own caller.
 *
 * Never throws: a notification failure must not roll back the sync behind it.
 */
export async function notifyIncidentTransition(
  incidentId: number,
  before: string | null,
  after: string | null,
  actorId: string | null,
  snapshot: IncidentTransitionSnapshot,
): Promise<void> {
  try {
    if (!before || !after || before === after) return;
    if (after === INCIDENT_STATE.CANCELADA) return;
    if (before === INCIDENT_STATE.CERRADO && after !== INCIDENT_STATE.CERRADO) {
      await notifyIncidentReopened(incidentId, snapshot, actorId);
      return;
    }
    if (after === INCIDENT_STATE.CERRADO) {
      await notifyIncidentClosed(
        incidentId,
        snapshot.title,
        snapshot.reporterId,
        actorId,
        snapshot.clientId,
      );
      return;
    }
    if (!(after in PHASE_EVENT)) return;
    if ((PHASE_RANK[after] ?? -1) <= (PHASE_RANK[before] ?? -1)) return;
    await notifyIncidentPhase(
      incidentId,
      after as keyof typeof PHASE_EVENT,
      snapshot,
      actorId,
    );
  } catch (error) {
    logger.error("[notify-events] Error notifying incident transition:", error);
  }
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

/**
 * Fires from `deleteVacation` (soft-delete).
 *
 * The audience depends on who cancels: the requester cancelling their own
 * request notifies the approvers (`vacations:approve`); an admin cancelling
 * someone else's notifies the requester. The caller resolves the audience —
 * this only delivers. `requesterName` feeds the approver-facing copy.
 */
export async function notifyVacationCancelled(
  vacationId: string,
  requesterName: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  await dispatch(NOTIFICATION_TYPES.VACATION_CANCELLED, {
    recipients: recipientIds,
    actorId,
    ctx: { vacationId, requesterName },
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
