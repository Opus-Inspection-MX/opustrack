import { prisma } from "@/lib/database/prisma.singleton";
import { createNotificationsForUsers } from "./notification-service";
import {
  type EntityType,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_TYPES,
  type NotificationPriority,
  type NotificationType,
} from "./notification-types";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface NotificationPayload {
  title: string;
  message: string;
  type: NotificationType;
  entityType?: EntityType;
  entityId?: string;
  actionUrl?: string;
  priority?: NotificationPriority;
}

/**
 * Internal dispatch: dedup recipients, remove actor, call createMany once.
 * Never throws — failures are logged and swallowed so the caller's business
 * operation is never rolled back by a notification error.
 */
async function emit(
  userIds: string[],
  actorId: string,
  payload: NotificationPayload,
): Promise<void> {
  const dedupedIds = Array.from(new Set(userIds)).filter(
    (id) => id !== actorId,
  );
  if (dedupedIds.length === 0) return;

  try {
    await createNotificationsForUsers(dedupedIds, {
      title: payload.title,
      message: payload.message,
      type: payload.type,
      entityType: payload.entityType,
      entityId: payload.entityId,
      actionUrl: payload.actionUrl,
      priority: payload.priority ?? NOTIFICATION_PRIORITY.LOW,
    });
  } catch (error) {
    console.error("[notify-events] Error dispatching notifications:", error);
  }
}

/**
 * Return IDs of all active ADMINISTRADOR users.
 */
export async function getAdminUserIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({
    where: {
      active: true,
      role: { name: "ADMINISTRADOR" },
    },
    select: { id: true },
  });
  return admins.map((u) => u.id);
}

// ---------------------------------------------------------------------------
// Assignment notification helpers (RF-452, RF-461–RF-464)
// ---------------------------------------------------------------------------

/**
 * RF-452: Fires when new FSRs are added to an assignment.
 * Recipients: newRecipientIds (actor always excluded by emit).
 * Priority: HIGH.
 */
export async function notifyAssignmentAssigned(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  const title = "Nueva asignación";
  const message = incidentTitle
    ? `Se te ha asignado la asignación para: ${incidentTitle}`
    : "Se te ha asignado una nueva asignación";

  await emit(recipientIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED,
    entityType: "assignment",
    entityId: assignmentId,
    actionUrl: `/fsr/assignments/${assignmentId}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

/**
 * RF-462: Fires on every assignment transition (status update, notes, folio
 * edit, seen, start, pause, resume). Recipients: existing active FSRs, actor excluded.
 * Priority: MEDIUM. New FSRs added at the same time get ASSIGNED (not UPDATED).
 */
export async function notifyAssignmentUpdated(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  const title = "Asignación actualizada";
  const message = incidentTitle
    ? `Tu asignación ha sido actualizada: ${incidentTitle}`
    : "Tu asignación ha sido actualizada";

  await emit(recipientIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.ASSIGNMENT_UPDATED,
    entityType: "assignment",
    entityId: assignmentId,
    actionUrl: `/fsr/assignments/${assignmentId}`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
  });
}

/**
 * RF-463: Fires when assignment transitions to CERRADO.
 * Recipients: active assigned FSRs + all ADMINISTRADOR users, actor excluded.
 * Priority: HIGH.
 */
export async function notifyAssignmentCompleted(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  const title = "Asignación completada";
  const message = incidentTitle
    ? `La asignación fue completada: ${incidentTitle}`
    : "La asignación fue completada";

  await emit(recipientIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
    entityType: "assignment",
    entityId: assignmentId,
    actionUrl: `/fsr/assignments/${assignmentId}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

/**
 * RF-464: Fires when assignment is reopened (CERRADO → EN_PROGRESO).
 * Recipients: active assigned FSRs, actor excluded.
 * Priority: HIGH.
 */
export async function notifyAssignmentReopened(
  assignmentId: string,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  const title = "Asignación reabierta";
  const message = incidentTitle
    ? `La asignación fue reabierta: ${incidentTitle}`
    : "La asignación fue reabierta";

  await emit(recipientIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.ASSIGNMENT_REOPENED,
    entityType: "assignment",
    entityId: assignmentId,
    actionUrl: `/fsr/assignments/${assignmentId}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

// ---------------------------------------------------------------------------
// Incident notification helpers (RF-465, RF-466, RF-467, RF-468)
// ---------------------------------------------------------------------------

/**
 * RF-465: Fires after a new incident is persisted.
 * Recipients: all active ADMINISTRADOR users, actor excluded.
 * Priority: MEDIUM.
 */
export async function notifyIncidentCreated(
  incidentId: number,
  incidentTitle: string | null | undefined,
  actorId: string,
): Promise<void> {
  const adminIds = await getAdminUserIds();
  const title = "Nuevo incidente reportado";
  const message = incidentTitle
    ? `Se reportó un nuevo incidente: ${incidentTitle}`
    : "Se reportó un nuevo incidente";

  await emit(adminIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.INCIDENT_CREATED,
    entityType: "incident",
    entityId: String(incidentId),
    actionUrl: `/admin/incidents/${incidentId}`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
  });
}

/**
 * RF-466: Fires after incident metadata is updated.
 * Recipients: enabled FSRs (active IncidentAssignee), actor excluded.
 * Priority: LOW. No write if recipientIds is empty.
 */
export async function notifyIncidentUpdated(
  incidentId: number,
  incidentTitle: string | null | undefined,
  recipientIds: string[],
  actorId: string,
): Promise<void> {
  if (recipientIds.length === 0) return;
  const title = "Incidente actualizado";
  const message = incidentTitle
    ? `El incidente ha sido actualizado: ${incidentTitle}`
    : "El incidente ha sido actualizado";

  await emit(recipientIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.INCIDENT_UPDATED,
    entityType: "incident",
    entityId: String(incidentId),
    actionUrl: `/fsr/assignments`,
    priority: NOTIFICATION_PRIORITY.LOW,
  });
}

/**
 * RF-467: Fires ONLY when the incident transitions to CERRADO (auto-close gate).
 * Recipients: reporter (reporterIdOrNull) + all active ADMINISTRADOR users, actor excluded.
 * Priority: HIGH.
 */
export async function notifyIncidentClosed(
  incidentId: number,
  incidentTitle: string | null | undefined,
  reporterIdOrNull: string | null | undefined,
  actorId: string,
): Promise<void> {
  const adminIds = await getAdminUserIds();
  const recipients = [
    ...(reporterIdOrNull ? [reporterIdOrNull] : []),
    ...adminIds,
  ];
  const title = "Incidente cerrado";
  const message = incidentTitle
    ? `El incidente fue cerrado: ${incidentTitle}`
    : "El incidente fue cerrado";

  await emit(recipients, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.INCIDENT_CLOSED,
    entityType: "incident",
    entityId: String(incidentId),
    actionUrl: `/admin/incidents/${incidentId}`,
    priority: NOTIFICATION_PRIORITY.HIGH,
  });
}

/**
 * RF-468: Fires when new FSRs are enabled on an incident (IncidentAssignee created).
 * Recipients: new FSR IDs, actor excluded.
 * Priority: MEDIUM.
 */
export async function notifyIncidentAssigned(
  incidentId: number,
  incidentTitle: string | null | undefined,
  newFsrIds: string[],
  actorId: string,
): Promise<void> {
  if (newFsrIds.length === 0) return;
  const title = "Asignado a incidente";
  const message = incidentTitle
    ? `Se te ha asignado al incidente: ${incidentTitle}`
    : "Se te ha asignado a un incidente";

  await emit(newFsrIds, actorId, {
    title,
    message,
    type: NOTIFICATION_TYPES.INCIDENT_ASSIGNED,
    entityType: "incident",
    entityId: String(incidentId),
    actionUrl: `/fsr/assignments`,
    priority: NOTIFICATION_PRIORITY.MEDIUM,
  });
}

// ---------------------------------------------------------------------------
// Broadcast helpers (RF-469, RF-470)
// ---------------------------------------------------------------------------

/**
 * RF-469 / RF-470: Admin broadcast notification.
 * Dispatches a SYSTEM or ANNOUNCEMENT notification to the provided recipients.
 * Recipients are pre-resolved by the caller (sendBroadcast server action).
 * Actor is excluded by emit().
 * Priority: SYSTEM → MEDIUM; ANNOUNCEMENT → LOW.
 * entityType/entityId are null for broadcast messages.
 */
export async function notifyBroadcast(
  type: "system" | "announcement",
  recipientIds: string[],
  title: string,
  message: string,
  actorId: string,
): Promise<void> {
  const notificationType =
    type === "system"
      ? NOTIFICATION_TYPES.SYSTEM
      : NOTIFICATION_TYPES.ANNOUNCEMENT;
  const priority =
    type === "system"
      ? NOTIFICATION_PRIORITY.MEDIUM
      : NOTIFICATION_PRIORITY.LOW;

  await emit(recipientIds, actorId, {
    title,
    message,
    type: notificationType,
    priority,
  });
}
