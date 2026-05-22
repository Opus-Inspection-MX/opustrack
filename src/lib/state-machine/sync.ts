import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import { ASSIGNMENT_STATE, type AssignmentState } from "./assignment-machine";
import { INCIDENT_STATE, type IncidentState } from "./incident-machine";

/**
 * Map a single assignment state to the incident state it contributes.
 */
function assignmentToIncidentContribution(
  assignment: AssignmentState,
): IncidentState {
  switch (assignment) {
    case ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION:
      return INCIDENT_STATE.ABIERTO;
    case ASSIGNMENT_STATE.ASIGNADO:
      return INCIDENT_STATE.ASIGNADO;
    case ASSIGNMENT_STATE.VISTO:
      return INCIDENT_STATE.VISTO;
    case ASSIGNMENT_STATE.INICIADO:
      return INCIDENT_STATE.INICIADO;
    case ASSIGNMENT_STATE.EN_PROGRESO:
      return INCIDENT_STATE.EN_PROGRESO;
    case ASSIGNMENT_STATE.CERRADO:
      return INCIDENT_STATE.CERRADO;
  }
}

const RANK: Record<IncidentState, number> = {
  [INCIDENT_STATE.ABIERTO]: 0,
  [INCIDENT_STATE.ASIGNADO]: 1,
  [INCIDENT_STATE.VISTO]: 2,
  [INCIDENT_STATE.INICIADO]: 3,
  [INCIDENT_STATE.EN_PROGRESO]: 4,
  [INCIDENT_STATE.CERRADO]: 5,
  [INCIDENT_STATE.CANCELADA]: 6,
};

export function computeIncidentStateFromAssignmentStates(
  assignmentStates: AssignmentState[],
): IncidentState {
  if (assignmentStates.length === 0) return INCIDENT_STATE.ABIERTO;
  if (assignmentStates.every((s) => s === ASSIGNMENT_STATE.CERRADO)) {
    return INCIDENT_STATE.CERRADO;
  }
  // Of the non-closed assignments, pick the most advanced contribution.
  // (A single CERRADO sibling alongside open ones does not close the incident.)
  const contributions = assignmentStates
    .filter((s) => s !== ASSIGNMENT_STATE.CERRADO)
    .map(assignmentToIncidentContribution);
  if (contributions.length === 0) return INCIDENT_STATE.CERRADO;
  return contributions.reduce((acc, c) => (RANK[c] > RANK[acc] ? c : acc));
}

type TxClient = Prisma.TransactionClient | typeof prisma;

/**
 * Recompute the incident's status from its active assignments and persist if
 * different. Safe to call after any assignment status mutation. Idempotent.
 *
 * Short-circuits when the incident is in CANCELADA — that terminal state is
 * set directly by admin and must never be overwritten by sync.
 */
export async function syncIncidentState(
  incidentId: number,
  client: TxClient = prisma,
): Promise<{ before: string | null; after: IncidentState | null }> {
  const incident = await client.incident.findUnique({
    where: { id: incidentId },
    select: { status: { select: { name: true } } },
  });
  const before = incident?.status?.name ?? null;

  if (before === INCIDENT_STATE.CANCELADA) {
    return { before, after: INCIDENT_STATE.CANCELADA };
  }

  const assignments = await client.assignment.findMany({
    where: { incidentId, active: true },
    select: { status: { select: { name: true } } },
  });

  const states = assignments
    .map((a) => a.status?.name)
    .filter((n): n is AssignmentState => Boolean(n)) as AssignmentState[];

  const target = computeIncidentStateFromAssignmentStates(states);

  if (before === target) return { before, after: target };

  const status = await client.incidentStatus.findUnique({
    where: { name: target },
    select: { id: true },
  });
  if (!status) {
    throw new Error(`IncidentStatus '${target}' no existe en el catálogo`);
  }

  await client.incident.update({
    where: { id: incidentId },
    data: {
      statusId: status.id,
      resolvedAt: target === INCIDENT_STATE.CERRADO ? new Date() : null,
    },
  });

  return { before, after: target };
}
