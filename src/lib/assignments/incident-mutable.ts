/**
 * Shared edit gate for assignment children (Fase 3, H-08).
 *
 * `assignment-activities.ts` and `assignment-items.ts` carried identical
 * copies of `assertAssignmentEditable` comparing `status.name`. One helper,
 * resolving by stable `code` via `isIncidentTerminal`.
 */

import { businessRule } from "@/lib/actions/result";
import { codeOf, INCIDENT_STATE } from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";

type Client = typeof prisma | import("@prisma/client").Prisma.TransactionClient;

export async function assertIncidentEditable(
  client: Client,
  incidentId: number,
  allowClosed = false,
): Promise<void> {
  const incident = await client.incident.findUnique({
    where: { id: incidentId, active: true },
    select: { status: { select: { code: true, name: true } } },
  });
  if (!incident) businessRule("No encontrado.");
  const code = codeOf(incident.status);
  if (
    code === INCIDENT_STATE.CANCELADA ||
    (!allowClosed && code === INCIDENT_STATE.CERRADO)
  ) {
    businessRule(
      code === INCIDENT_STATE.CANCELADA
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}

/** Refuse changes once the parent incident is closed or cancelled. */
export async function assertAssignmentEditable(
  assignmentId: string,
  client: Client = prisma,
): Promise<void> {
  const row = await client.assignment.findUnique({
    where: { id: assignmentId, active: true, incident: { active: true } },
    select: {
      incident: { select: { status: { select: { code: true, name: true } } } },
    },
  });
  if (!row) businessRule("No encontrado.");
  const code = codeOf(row?.incident?.status);
  if (code === INCIDENT_STATE.CERRADO || code === INCIDENT_STATE.CANCELADA) {
    businessRule(
      code === INCIDENT_STATE.CANCELADA
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}
