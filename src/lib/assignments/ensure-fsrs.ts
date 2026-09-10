import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  notifyAssignmentAssigned,
  notifyIncidentAssigned,
  transactionWithNotifications,
} from "@/lib/notifications";
import {
  ASSIGNMENT_STATE,
  type AssignmentState,
} from "@/lib/state-machine/assignment-machine";
import { syncIncidentState } from "@/lib/state-machine/sync";

/**
 * Shared assignment helpers. Plain module — deliberately NOT `"use server"`.
 *
 * Everything exported from a `"use server"` module becomes a publicly callable
 * Server Action. `ensureFsrsAssignedToIncident` used to live in
 * `actions/assignments.ts`, which meant any client could invoke it directly
 * with an arbitrary `actorId` and send notifications impersonating another
 * user, with no permission check of its own. Here it is only reachable
 * through the permission-checked actions that import it, and the actor comes
 * from the session, not from a parameter.
 */

type TxClient =
  | typeof prisma
  | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Resolve an AssignmentStatus id by name within a transaction (or default client).
 * Throws if the catalog row is missing — state-machine code requires the seed
 * to be present.
 */
export async function resolveAssignmentStatusId(
  client: TxClient,
  name: AssignmentState,
): Promise<number> {
  const row = await client.assignmentStatus.findUnique({
    where: { name },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`AssignmentStatus '${name}' no existe en el catálogo`);
  }
  return row.id;
}

/**
 * Ensure the given FSRs have a real, visible Assignment on this incident.
 *
 * Incident-level "assign FSR" UI (quick-edit popover, incident edit form,
 * bulk actions) only used to grant IncidentAssignee eligibility and notify —
 * without ever creating the Assignment the FSR actually sees in
 * /fsr/assignments. Callers pass the newly-added FSR ids here right after
 * granting eligibility so the notification's promise is backed by real work.
 *
 * Reuses the incident's current active Assignment if one exists (adding
 * assignees and reviving it to ASIGNADO if it was PENDIENTE_DE_ASIGNACION),
 * or creates one. No-op if fsrIds is empty.
 */
export async function ensureFsrsAssignedToIncident(
  incidentId: number,
  fsrIds: string[],
): Promise<void> {
  if (fsrIds.length === 0) return;

  // The actor is who is signed in, not who the caller claims. Accepting it as
  // a parameter would let any caller forge attribution on the notification.
  const actor = await requireAuth();

  const result = await transactionWithNotifications(async (tx) => {
    const existingAssignment = await tx.assignment.findFirst({
      where: { incidentId, active: true },
      select: { id: true, status: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    let assignmentId: string;
    let toAdd: string[];

    if (existingAssignment) {
      assignmentId = existingAssignment.id;
      const existingAssignees = await tx.assignmentAssignee.findMany({
        where: { assignmentId, active: true },
        select: { userId: true },
      });
      const existingIds = new Set(existingAssignees.map((a) => a.userId));
      toAdd = fsrIds.filter((u) => !existingIds.has(u));

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId, userId } },
          create: { assignmentId, userId, active: true },
          update: { active: true, assignedAt: new Date() },
        });
      }

      if (
        toAdd.length > 0 &&
        existingAssignment.status?.name ===
          ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION
      ) {
        const statusId = await resolveAssignmentStatusId(
          tx,
          ASSIGNMENT_STATE.ASIGNADO,
        );
        await tx.assignment.update({
          where: { id: assignmentId },
          data: { statusId, assignedAt: new Date() },
        });
      }
    } else {
      const statusId = await resolveAssignmentStatusId(
        tx,
        ASSIGNMENT_STATE.ASIGNADO,
      );
      const created = await tx.assignment.create({
        data: {
          incidentId,
          statusId,
          assignedAt: new Date(),
          assignees: { create: fsrIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      assignmentId = created.id;
      toAdd = fsrIds;
    }

    await syncIncidentState(incidentId, tx);

    return { assignmentId, toAdd };
  });

  if (result.toAdd.length === 0) return;

  const incident = await prisma.incident.findUnique({
    where: { id: incidentId },
    select: { title: true },
  });

  await notifyAssignmentAssigned(
    result.assignmentId,
    incident?.title,
    result.toAdd,
    actor.id,
  );
  await notifyIncidentAssigned(
    incidentId,
    incident?.title,
    result.toAdd,
    actor.id,
  );

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${result.assignmentId}`);
  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${result.assignmentId}`);
  revalidatePath(`/admin/incidents/${incidentId}`);
}
