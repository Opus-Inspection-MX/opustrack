import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { businessRule } from "@/lib/actions/result";
import { requireAuth } from "@/lib/auth/auth";
import { ROLE } from "@/lib/authz/roles";
import { whereHasRole } from "@/lib/authz/user-queries";
import { codeOf } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  notifyAssignmentAssigned,
  notifyIncidentAssigned,
  transactionWithNotifications,
} from "@/lib/notifications";
import { deferAfterCommit } from "@/lib/notifications/after-commit";
import {
  ASSIGNMENT_STATE,
  type AssignmentState,
} from "@/lib/state-machine/assignment-machine";
import { syncIncidentState } from "@/lib/state-machine/sync";
import { isFsrUnavailable } from "@/lib/utils/availability";
import { assertIncidentEditable } from "./incident-mutable";

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
 * Resolve an AssignmentStatus id by stable code within a transaction (or
 * default client). Throws if the catalog row is missing — state-machine code
 * requires the seed to be present.
 */
export async function resolveAssignmentStatusId(
  client: TxClient,
  code: AssignmentState,
): Promise<number> {
  const row = await client.assignmentStatus.findUnique({
    where: { code },
    select: { id: true },
  });
  if (!row) {
    throw new Error(`AssignmentStatus '${code}' no existe en el catálogo`);
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
  client?: Prisma.TransactionClient,
): Promise<void> {
  fsrIds = [...new Set(fsrIds)];
  if (fsrIds.length === 0) return;

  // The actor is who is signed in, not who the caller claims. Accepting it as
  // a parameter would let any caller forge attribution on the notification.
  const actor = await requireAuth();

  const mutate = async (tx: Prisma.TransactionClient) => {
    await assertIncidentEditable(tx, incidentId);
    const fsrs = await tx.user.findMany({
      where: { id: { in: fsrIds }, active: true, ...whereHasRole(ROLE.FSR) },
      select: { id: true },
    });
    if (fsrs.length !== new Set(fsrIds).size)
      businessRule("Uno o más FSR no existen o no tienen rol FSR");
    const existingAssignment = await tx.assignment.findFirst({
      where: {
        incidentId,
        active: true,
        NOT: { status: { code: ASSIGNMENT_STATE.CERRADO } },
      },
      select: {
        id: true,
        scheduledDate: true,
        status: { select: { code: true, name: true } },
      },
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
      toAdd = [...new Set(fsrIds)].filter((u) => !existingIds.has(u));

      if (existingAssignment.scheduledDate) {
        for (const userId of toAdd) {
          if (
            await isFsrUnavailable(userId, existingAssignment.scheduledDate, tx)
          ) {
            businessRule(
              "Uno o más técnicos no están disponibles en la fecha programada (día festivo o vacaciones aprobadas).",
            );
          }
        }
      }

      for (const userId of toAdd) {
        await tx.assignmentAssignee.upsert({
          where: { assignmentId_userId: { assignmentId, userId } },
          create: { assignmentId, userId, active: true },
          update: { active: true, assignedAt: new Date() },
        });
      }

      if (toAdd.length > 0) {
        const statusId =
          codeOf(existingAssignment.status) ===
          ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION
            ? await resolveAssignmentStatusId(tx, ASSIGNMENT_STATE.ASIGNADO)
            : undefined;
        await tx.assignment.update({
          where: { id: assignmentId },
          data: {
            statusId,
            assignedAt: new Date(),
            seenAt: null,
            seenById: null,
          },
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
          assignees: {
            create: [...new Set(fsrIds)].map((userId) => ({ userId })),
          },
        },
        select: { id: true },
      });
      assignmentId = created.id;
      toAdd = fsrIds;
    }

    await syncIncidentState(incidentId, tx);

    return { assignmentId, toAdd };
  };
  const result = client
    ? await mutate(client)
    : await transactionWithNotifications(mutate);

  if (result.toAdd.length === 0) return;

  const notify = async () => {
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
  };
  if (client) deferAfterCommit(notify);
  else await notify();

  revalidatePath("/admin/assignments");
  revalidatePath(`/admin/assignments/${result.assignmentId}`);
  revalidatePath("/fsr/assignments");
  revalidatePath(`/fsr/assignments/${result.assignmentId}`);
  revalidatePath(`/admin/incidents/${incidentId}`);
}
