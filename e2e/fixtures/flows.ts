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
  /** Enabled on the incident (IncidentAssignee) from the start. */
  enabledFsrId: string;
  enabledFsrName: string;
  enabledFsrEmail: string;
  /**
   * Active FSR who is neither enabled on the incident nor assigned to its
   * Cliente — the subject of the auto-enablement rule.
   */
  outsiderFsrId: string;
  outsiderFsrName: string;
  outsiderFsrEmail: string;
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
    where: {
      active: true,
      userRoles: { some: { active: true, role: { name: "FSR" } } },
    },
    orderBy: { email: "asc" },
    select: { id: true, name: true, email: true },
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
 * The outsider is a real, active FSR who is neither enabled on the incident nor
 * assigned to its Cliente. That used to make him the subject of a rejection;
 * now he is the subject of RF-514's auto-enablement, and of the proof that the
 * Cliente link no longer filters the picker.
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

  // Only `enabled` covers this Cliente. The outsider is deliberately left
  // unlinked: the picker must still offer him, because the Cliente link is a
  // hint the UI badges, not a filter it applies.
  await prisma.userClienteAssignment.upsert({
    where: { userId_clienteId: { userId: enabled.id, clienteId: cliente.id } },
    update: { active: true },
    create: { userId: enabled.id, clienteId: cliente.id },
  });
  await prisma.userClienteAssignment.updateMany({
    where: { userId: outsider.id, clienteId: cliente.id },
    data: { active: false },
  });

  const incidentTitle = `E2E Seguimiento ${suffix}`;

  const incident = await prisma.incident.create({
    data: {
      title: incidentTitle,
      description: "Incidente preparado por la suite e2e de seguimiento.",
      typeId: type.id,
      statusId: incidentStatus.id,
      clienteId: cliente.id,
      // The outsider is deliberately left out so the auto-enablement path has
      // a subject that starts without the row.
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
    enabledFsrEmail: enabled.email,
    outsiderFsrId: outsider.id,
    outsiderFsrName: outsider.name,
    outsiderFsrEmail: outsider.email,
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
