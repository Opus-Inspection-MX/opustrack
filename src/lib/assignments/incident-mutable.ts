/**
 * Shared edit gate for assignment children (Fase 3, H-08).
 *
 * `assignment-activities.ts` and `assignment-items.ts` carried identical
 * copies of `assertAssignmentEditable` comparing `status.name`. One helper,
 * resolving by stable `code` via `isIncidentTerminal`.
 */

import { businessRule } from "@/lib/actions/result";
import {
  codeOf,
  INCIDENT_STATE,
} from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";

/** Refuse changes once the parent incident is closed or cancelled. */
export async function assertAssignmentEditable(
  assignmentId: string,
): Promise<void> {
  const row = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      incident: { select: { status: { select: { code: true, name: true } } } },
    },
  });
  const code = codeOf(row?.incident?.status);
  if (code === INCIDENT_STATE.CERRADO || code === INCIDENT_STATE.CANCELADA) {
    businessRule(
      code === INCIDENT_STATE.CANCELADA
        ? "La incidencia está cancelada. No se pueden hacer cambios."
        : "La incidencia está cerrada. No se pueden hacer cambios.",
    );
  }
}
