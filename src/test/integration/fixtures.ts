import { prisma } from "@/lib/database/prisma.singleton";

/**
 * Per-file integration world.
 *
 * Every `*.int.test.ts` builds its own world with a unique suffix, so files
 * can run in any order (and re-runs start from the ephemeral seed): Clients
 * A and B, each with line / equipment / incident / assignment / activity /
 * item / schedule / vehicle / trip, one `clientId: null` incident, and the
 * people the matrices need:
 *
 * - `root` (ROOT, superuser, no Client)
 * - `opsAll` (ADMIN_OPERACION, `scope:all-clients`, no Client)
 * - `vacAdmin` (ADMIN_VACACIONES, no Client)
 * - `fsrA` (FSR, primary Client A, assignee of assignment A)
 * - `fsrA2` (FSR, primary Client A, NOT assigned to anything)
 * - `reporterA` (REPORTER, primary Client A, reported incident A + null)
 * - `guestA` (GUEST, primary Client A)
 * - `sinCliente` (GUEST, no Client assignment at all)
 *
 * Catalogs (roles, statuses, types, states) come from the ephemeral seed —
 * the world only adds tenant rows plus its own users. Assertions always
 * filter by the world's ids, never by global counts: the seed itself holds
 * demo Clients and users.
 */

export interface IntWorldUser {
  id: string;
  email: string;
}

export interface IntWorld {
  suffix: string;
  stateId: number;
  typeId: number;
  clientA: { id: string; code: string };
  clientB: { id: string; code: string };
  lineA: { id: number };
  equipmentA: { id: number };
  lineB: { id: number };
  equipmentB: { id: number };
  scheduleA: { id: string; title: string };
  scheduleB: { id: string; title: string };
  scheduleGlobal: { id: string; title: string };
  incidentA: { id: number };
  incidentB: { id: number };
  incidentNull: { id: number };
  assignmentA: { id: string };
  assignmentB: { id: string };
  activityA: { id: string };
  activityB: { id: string };
  itemA: { id: string };
  itemB: { id: string };
  vehicleA: { id: string };
  tripA: { id: string };
  vehicleB: { id: string };
  tripB: { id: string };
  root: IntWorldUser;
  opsAll: IntWorldUser;
  vacAdmin: IntWorldUser;
  fsrA: IntWorldUser;
  fsrA2: IntWorldUser;
  reporterA: IntWorldUser;
  guestA: IntWorldUser;
  sinCliente: IntWorldUser;
}

async function required<T>(label: string, p: Promise<T | null>): Promise<T> {
  const row = await p;
  if (!row)
    throw new Error(`Integration world: seed catalog "${label}" missing`);
  return row;
}

async function makeUser(
  suffix: string,
  key: string,
  roleId: number,
  clientId: string | null,
): Promise<IntWorldUser> {
  const email = `int-${suffix}-${key}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: `int-${suffix}-${key}`,
      email,
      // Dummy hash, never used for login (tests act instead of signing
      // in). H-01 asserts even this never leaves the server in a response.
      password: `int-test-dummy-hash-${suffix}`,
      userStatusId: (
        await required(
          "UserStatus ACTIVO",
          prisma.userStatus.findUnique({ where: { name: "ACTIVO" } }),
        )
      ).id,
      userRoles: { create: [{ roleId }] },
    },
    select: { id: true, email: true },
  });
  if (clientId) {
    await prisma.userClientAssignment.create({
      data: { userId: user.id, clientId, isPrimary: true },
    });
  }
  return user;
}

export async function createWorld(suffix: string): Promise<IntWorld> {
  const state = await required(
    "State",
    prisma.state.findFirst({ where: { active: true } }),
  );
  const roleIdByName = async (name: string) =>
    (
      await required(
        `Role ${name}`,
        prisma.role.findUnique({ where: { name } }),
      )
    ).id;
  const roles = {
    ROOT: await roleIdByName("ROOT"),
    ADMIN_OPERACION: await roleIdByName("ADMIN_OPERACION"),
    ADMIN_VACACIONES: await roleIdByName("ADMIN_VACACIONES"),
    FSR: await roleIdByName("FSR"),
    REPORTER: await roleIdByName("REPORTER"),
    GUEST: await roleIdByName("GUEST"),
  };
  const typeId = (
    await required(
      "IncidentType",
      prisma.incidentType.findFirst({ where: { active: true } }),
    )
  ).id;
  const incidentAbierto = await required(
    "IncidentStatus ABIERTO",
    prisma.incidentStatus.findUnique({ where: { name: "ABIERTO" } }),
  );
  const assignmentAsignado = await required(
    "AssignmentStatus ASIGNADO",
    prisma.assignmentStatus.findUnique({ where: { name: "ASIGNADO" } }),
  );
  const assignmentPendiente = await required(
    "AssignmentStatus PENDIENTE_DE_ASIGNACION",
    prisma.assignmentStatus.findUnique({
      where: { name: "PENDIENTE_DE_ASIGNACION" },
    }),
  );
  const vehicleAvailable = await required(
    "VehicleStatus AVAILABLE",
    prisma.vehicleStatus.findUnique({ where: { name: "AVAILABLE" } }),
  );
  const tripEnCurso = await required(
    "VehicleTripStatus EN_CURSO",
    prisma.vehicleTripStatus.findUnique({ where: { name: "EN_CURSO" } }),
  );
  const scheduleConfirmado = await required(
    "ScheduleStatus CONFIRMADO",
    prisma.scheduleStatus.findUnique({ where: { name: "CONFIRMADO" } }),
  );
  const equipmentOperativo = await required(
    "EquipmentStatus OPERATIVO",
    prisma.equipmentStatus.findUnique({ where: { name: "OPERATIVO" } }),
  );

  const clientA = await prisma.client.create({
    data: {
      code: `INT-${suffix}-A`,
      name: `Int ${suffix} Client A`,
      stateId: state.id,
    },
    select: { id: true, code: true },
  });
  const clientB = await prisma.client.create({
    data: {
      code: `INT-${suffix}-B`,
      name: `Int ${suffix} Client B`,
      stateId: state.id,
    },
    select: { id: true, code: true },
  });

  const lineA = await prisma.line.create({
    data: { name: `Line A ${suffix}`, clientId: clientA.id },
  });
  const equipmentA = await prisma.equipment.create({
    data: {
      name: `Equipment A ${suffix}`,
      lineId: lineA.id,
      statusId: equipmentOperativo.id,
    },
  });
  const lineB = await prisma.line.create({
    data: { name: `Line B ${suffix}`, clientId: clientB.id },
  });
  const equipmentB = await prisma.equipment.create({
    data: {
      name: `Equipment B ${suffix}`,
      lineId: lineB.id,
      statusId: equipmentOperativo.id,
    },
  });

  const scheduleTitle = (key: string) => `Int ${suffix} schedule ${key}`;
  const scheduleA = await prisma.schedule.create({
    data: {
      title: scheduleTitle("A"),
      scheduledAt: new Date(Date.now() + 24 * 3600_000),
      endDate: new Date(Date.now() + 48 * 3600_000),
      statusId: scheduleConfirmado.id,
      clients: { create: [{ clientId: clientA.id }] },
    },
  });
  const scheduleB = await prisma.schedule.create({
    data: {
      title: scheduleTitle("B"),
      scheduledAt: new Date(Date.now() + 24 * 3600_000),
      endDate: new Date(Date.now() + 48 * 3600_000),
      statusId: scheduleConfirmado.id,
      clients: { create: [{ clientId: clientB.id }] },
    },
  });
  const scheduleGlobal = await prisma.schedule.create({
    data: {
      title: scheduleTitle("global"),
      scheduledAt: new Date(Date.now() + 24 * 3600_000),
      endDate: new Date(Date.now() + 48 * 3600_000),
      statusId: scheduleConfirmado.id,
    },
  });

  // People first: incidents point at the reporter.
  const root = await makeUser(suffix, "root", roles.ROOT, null);
  const opsAll = await makeUser(suffix, "ops", roles.ADMIN_OPERACION, null);
  const vacAdmin = await makeUser(suffix, "vac", roles.ADMIN_VACACIONES, null);
  const fsrA = await makeUser(suffix, "fsr-a", roles.FSR, clientA.id);
  const fsrA2 = await makeUser(suffix, "fsr-a2", roles.FSR, clientA.id);
  const reporterA = await makeUser(
    suffix,
    "reporter-a",
    roles.REPORTER,
    clientA.id,
  );
  const guestA = await makeUser(suffix, "guest-a", roles.GUEST, clientA.id);
  const sinCliente = await makeUser(suffix, "sin-cliente", roles.GUEST, null);

  const incidentA = await prisma.incident.create({
    data: {
      title: `Int ${suffix} incident A`,
      description: "world A",
      typeId,
      statusId: incidentAbierto.id,
      clientId: clientA.id,
      reportedById: reporterA.id,
      reporterName: "Int A reporter",
      lineId: lineA.id,
      equipmentId: equipmentA.id,
      scheduleId: scheduleA.id,
    },
  });
  const incidentB = await prisma.incident.create({
    data: {
      title: `Int ${suffix} incident B`,
      description: "world B",
      typeId,
      statusId: incidentAbierto.id,
      clientId: clientB.id,
      reportedById: reporterA.id,
      reporterName: "Int B reporter",
      lineId: lineB.id,
      equipmentId: equipmentB.id,
      scheduleId: scheduleB.id,
    },
  });
  const incidentNull = await prisma.incident.create({
    data: {
      title: `Int ${suffix} incident without client`,
      description: "world null",
      typeId,
      statusId: incidentAbierto.id,
      clientId: null,
      reportedById: reporterA.id,
      reporterName: "Int null reporter",
    },
  });

  const assignmentA = await prisma.assignment.create({
    data: {
      incidentId: incidentA.id,
      statusId: assignmentAsignado.id,
      notes: `Int ${suffix} assignment A`,
      assignees: { create: [{ userId: fsrA.id }] },
    },
  });
  // B deliberately has no assignees: fsrA2 stays "Client A, not assigned
  // to anything", and the IDOR suite drives B through opsAll.
  const assignmentB = await prisma.assignment.create({
    data: {
      incidentId: incidentB.id,
      statusId: assignmentPendiente.id,
      notes: `Int ${suffix} assignment B`,
    },
  });

  const activityA = await prisma.assignmentActivity.create({
    data: {
      assignmentId: assignmentA.id,
      description: `Int ${suffix} activity A`,
    },
  });
  const activityB = await prisma.assignmentActivity.create({
    data: {
      assignmentId: assignmentB.id,
      description: `Int ${suffix} activity B`,
    },
  });
  const itemA = await prisma.assignmentItem.create({
    data: {
      assignmentId: assignmentA.id,
      name: `Int ${suffix} item A`,
      quantity: 1,
      unitPrice: 10,
    },
  });
  const itemB = await prisma.assignmentItem.create({
    data: {
      assignmentId: assignmentB.id,
      name: `Int ${suffix} item B`,
      quantity: 2,
      unitPrice: 20,
    },
  });

  const vehicleA = await prisma.vehicle.create({
    data: {
      make: "Int",
      model: `V-A-${suffix}`,
      year: 2024,
      licensePlate: `INT-${suffix}-VA`,
      statusId: vehicleAvailable.id,
      assignedFsrId: fsrA.id,
    },
  });
  const tripA = await prisma.vehicleTrip.create({
    data: {
      vehicleId: vehicleA.id,
      fsrId: fsrA.id,
      assignmentId: assignmentA.id,
      startOdometer: 1000,
      startPhotoUrl: `test://${suffix}/a.jpg`,
      statusId: tripEnCurso.id,
    },
  });
  const vehicleB = await prisma.vehicle.create({
    data: {
      make: "Int",
      model: `V-B-${suffix}`,
      year: 2024,
      licensePlate: `INT-${suffix}-VB`,
      statusId: vehicleAvailable.id,
    },
  });
  const tripB = await prisma.vehicleTrip.create({
    data: {
      vehicleId: vehicleB.id,
      fsrId: fsrA.id,
      assignmentId: assignmentB.id,
      startOdometer: 2000,
      startPhotoUrl: `test://${suffix}/b.jpg`,
      statusId: tripEnCurso.id,
    },
  });

  return {
    suffix,
    stateId: state.id,
    typeId,
    clientA: { id: clientA.id, code: clientA.code },
    clientB: { id: clientB.id, code: clientB.code },
    lineA: { id: lineA.id },
    equipmentA: { id: equipmentA.id },
    lineB: { id: lineB.id },
    equipmentB: { id: equipmentB.id },
    scheduleA: { id: scheduleA.id, title: scheduleA.title },
    scheduleB: { id: scheduleB.id, title: scheduleB.title },
    scheduleGlobal: { id: scheduleGlobal.id, title: scheduleGlobal.title },
    incidentA: { id: incidentA.id },
    incidentB: { id: incidentB.id },
    incidentNull: { id: incidentNull.id },
    assignmentA: { id: assignmentA.id },
    assignmentB: { id: assignmentB.id },
    activityA: { id: activityA.id },
    activityB: { id: activityB.id },
    itemA: { id: itemA.id },
    itemB: { id: itemB.id },
    vehicleA: { id: vehicleA.id },
    tripA: { id: tripA.id },
    vehicleB: { id: vehicleB.id },
    tripB: { id: tripB.id },
    root,
    opsAll,
    vacAdmin,
    fsrA,
    fsrA2,
    reporterA,
    guestA,
    sinCliente,
  };
}
