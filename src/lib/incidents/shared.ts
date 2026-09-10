import { IncidentEventType } from "@prisma/client";
import { businessRule } from "@/lib/actions/result";
import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import { prisma } from "@/lib/database/prisma.singleton";
import { logIncidentEvent } from "@/lib/state-machine/incident-events";

/**
 * Helpers shared by the single-incident actions (`actions/incidents.ts`) and
 * the bulk subsystem (`actions/incidents-bulk.ts`). Plain module —
 * deliberately NOT `"use server"`: everything exported from a `"use server"`
 * module becomes a publicly callable Server Action, and these run inside
 * permission-checked transactions owned by their callers.
 */

/**
 * Resolve `typeId` ensuring there is always a non-null value. Falls back to
 * the system `Desconocido` type so incidents always satisfy `typeId NOT NULL`.
 */
export async function resolveTypeIdOrFallback(
  typeId: number | null | undefined,
): Promise<number> {
  if (typeId) return typeId;
  const fallback = await prisma.incidentType.findUnique({
    where: { name: FALLBACK_INCIDENT_TYPE_NAME },
    select: { id: true },
  });
  if (!fallback) {
    throw new Error(
      `Falta el tipo de incidente "${FALLBACK_INCIDENT_TYPE_NAME}" en el catálogo. Corre el seed.`,
    );
  }
  return fallback.id;
}

/**
 * Reconcile the active set of IncidentAssignee rows for an incident.
 * Throws if removing an FSR that is currently active on an Assignment of
 * this incident (would orphan the work order).
 *
 * Every add/remove appends an audit event (RF-219) attributed to the acting
 * user. Bulk imports skip this helper and log a single BULK_IMPORTED row
 * instead, so a 500-row load does not fan out into thousands of events.
 */
export async function syncIncidentAssignees(
  incidentId: number,
  desiredIds: string[],
  options?: { actorId?: string | null },
): Promise<{ toAdd: string[] }> {
  const desired = new Set(desiredIds);
  const current = await prisma.incidentAssignee.findMany({
    where: { incidentId, active: true },
    select: { userId: true },
  });
  const currentSet = new Set(current.map((c) => c.userId));

  const toRemove = [...currentSet].filter((u) => !desired.has(u));
  const toAdd = [...desired].filter((u) => !currentSet.has(u));

  const actorId = options?.actorId ?? null;

  if (toRemove.length) {
    const inUse = await prisma.assignmentAssignee.findMany({
      where: {
        userId: { in: toRemove },
        active: true,
        assignment: { incidentId, active: true },
      },
      select: { userId: true },
    });
    if (inUse.length) {
      const blocked = [...new Set(inUse.map((a) => a.userId))];
      businessRule(
        `No se puede retirar a FSR(s) asignado(s) a una asignación activa: ${blocked.join(", ")}`,
      );
    }
    await prisma.incidentAssignee.updateMany({
      where: { incidentId, userId: { in: toRemove }, active: true },
      data: { active: false },
    });
    for (const userId of toRemove) {
      await logIncidentEvent(prisma, {
        incidentId,
        eventType: IncidentEventType.ASSIGNEE_REMOVED,
        actorId,
        payload: { userId },
      });
    }
  }

  if (toAdd.length) {
    await prisma.incidentAssignee.createMany({
      data: toAdd.map((userId) => ({ incidentId, userId })),
      skipDuplicates: true,
    });
    await prisma.incidentAssignee.updateMany({
      where: { incidentId, userId: { in: toAdd } },
      data: { active: true },
    });
    for (const userId of toAdd) {
      await logIncidentEvent(prisma, {
        incidentId,
        eventType: IncidentEventType.ASSIGNEE_ADDED,
        actorId,
        payload: { userId },
      });
    }
  }

  return { toAdd };
}
