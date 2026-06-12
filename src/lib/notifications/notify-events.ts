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
// Broadcast stub — completed in Slice 3
// ---------------------------------------------------------------------------

/**
 * Admin broadcast notification.
 * TODO(s3): implement full body — resolve all/by-role recipients, call emit().
 */
export async function notifyBroadcast(
  _type: "system" | "announcement",
  _recipientIds: string[],
  _title: string,
  _message: string,
  _actorId: string,
): Promise<void> {
  // Stub — implemented in Slice 3 (feat/notifications-broadcast)
}
