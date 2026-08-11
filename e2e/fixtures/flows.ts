import { db, uniqueSuffix } from "./db";

/**
 * Data the programación and tracking specs need but do not test.
 *
 * The e2e seed ships catalogs and users, no operational rows: no incidents, no
 * assignments, no `IncidentAssignee`. Creating them through the UI would make
 * these specs fail whenever an unrelated screen changes, so they are set up
 * directly — the same split the incident lifecycle spec uses.
 */

export interface TrackingFixture {
  suffix: string;
  clienteId: string;
  clienteCode: string;
  clienteName: string;
  incidentId: number;
  incidentTitle: string;
  assignmentId: string;
  assignmentFolio: number;
  /** Enabled on the incident (IncidentAssignee) — may be assigned. */
  enabledFsrId: string;
  enabledFsrName: string;
  /** Active FSR of the same Cliente but NOT enabled — must be rejected. */
  outsiderFsrId: string;
  outsiderFsrName: string;
}

/** Any active Cliente that is not the placeholder. */
async function pickCliente() {
  return db().cliente.findFirstOrThrow({
    where: { active: true, NOT: { code: "SIN-CENTRO" } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });
}

async function pickTwoFsrs() {
  const fsrs = await db().user.findMany({
    where: { active: true, role: { name: "FSR" } },
    orderBy: { email: "asc" },
    select: { id: true, name: true },
    take: 2,
  });
  if (fsrs.length < 2) {
    throw new Error(
      "Se necesitan al menos 2 FSR activos para las pruebas de seguimiento.",
    );
  }
  return fsrs;
}

/**
 * An incident with one assignment, one enabled FSR and one outsider.
 *
 * The outsider is what makes RF-514's rejection testable: a real, active FSR
 * that simply was never enabled on this incident.
 */
export async function createTrackingFixture(): Promise<TrackingFixture> {
  const prisma = db();
  const suffix = uniqueSuffix();

  const cliente = await pickCliente();
  const [enabled, outsider] = await pickTwoFsrs();

  const type = await prisma.incidentType.findFirstOrThrow({
    where: { active: true },
    select: { id: true },
  });
  const incidentStatus = await prisma.incidentStatus.findFirstOrThrow({
    where: { active: true, name: "ABIERTO" },
    select: { id: true },
  });
  const assignmentStatus = await prisma.assignmentStatus.findFirstOrThrow({
    where: { active: true, name: "ASIGNADO" },
    select: { id: true },
  });

  // Both FSRs must belong to the Cliente: the tracking table lists candidates
  // from `getFSRsByClienteId`, so an FSR without a Cliente assignment never
  // appears in the dropdown and the rejection path would be untestable.
  for (const fsr of [enabled, outsider]) {
    await prisma.userClienteAssignment.upsert({
      where: { userId_clienteId: { userId: fsr.id, clienteId: cliente.id } },
      update: { active: true },
      create: { userId: fsr.id, clienteId: cliente.id },
    });
  }

  const incidentTitle = `E2E Seguimiento ${suffix}`;

  const incident = await prisma.incident.create({
    data: {
      title: incidentTitle,
      description: "Incidente preparado por la suite e2e de seguimiento.",
      typeId: type.id,
      statusId: incidentStatus.id,
      clienteId: cliente.id,
      // Both FSRs must be enabled targets for the *update* flow; the outsider
      // is deliberately left out so the rejection path has a subject.
      assignees: { create: [{ userId: enabled.id }] },
    },
    select: { id: true },
  });

  const assignment = await prisma.assignment.create({
    data: {
      incidentId: incident.id,
      statusId: assignmentStatus.id,
      assignedAt: new Date(),
    },
    select: { id: true, folio: true },
  });

  return {
    suffix,
    clienteId: cliente.id,
    clienteCode: cliente.code,
    clienteName: cliente.name,
    incidentId: incident.id,
    incidentTitle,
    assignmentId: assignment.id,
    assignmentFolio: assignment.folio,
    enabledFsrId: enabled.id,
    enabledFsrName: enabled.name,
    outsiderFsrId: outsider.id,
    outsiderFsrName: outsider.name,
  };
}

export interface ScheduleFixture {
  suffix: string;
  clienteId: string;
  clienteCode: string;
  clienteName: string;
}

/** A Cliente to attach a programación to. */
export async function createScheduleFixture(): Promise<ScheduleFixture> {
  const cliente = await db().cliente.findFirstOrThrow({
    where: { active: true, NOT: { code: "SIN-CENTRO" } },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true },
  });

  return {
    suffix: uniqueSuffix(),
    clienteId: cliente.id,
    clienteCode: cliente.code,
    clienteName: cliente.name,
  };
}
