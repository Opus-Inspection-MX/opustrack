import { beforeAll, describe, expect, it } from "vitest";
import {
  getAllAssignmentActivities,
  getAssignmentActivities,
  getAssignmentActivityById,
} from "@/lib/actions/assignment-activities";
import { getAssignmentItems } from "@/lib/actions/assignment-items";
import { getAssignmentById, getAssignments } from "@/lib/actions/assignments";
import {
  getClientById,
  getClients,
  getClientsForSelect,
} from "@/lib/actions/clients";
import {
  getEquipmentById,
  getEquipments,
  getEquipmentsByLineId,
} from "@/lib/actions/equipments";
import {
  getIncidentProgramReport,
  getScheduleOptions,
} from "@/lib/actions/incident-program";
import {
  getIncidentById,
  getIncidents,
  getReporterIncidents,
} from "@/lib/actions/incidents";
import { getLineById, getLines, getLinesByClientId } from "@/lib/actions/lines";
import { getScheduleById, getSchedules } from "@/lib/actions/schedules";
import { getIncidentsForTracking } from "@/lib/actions/tracking";
import { getUserById, getUsers } from "@/lib/actions/users";
import {
  getAllVehicleTrips,
  getVehicleTripById,
} from "@/lib/actions/vehicle-trips";
import { getAuthenticatedUser } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { assertNoPasswordKey, capture, isDenial } from "./assertions";
import { MATRIX_SCOPE } from "./coverage";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Tenant scope matrix: every reader with tenant data, every tenant actor.
 *
 * - `fsrA` / `reporterA` / `guestA` see rows of A, never of B.
 * - `sinCliente` sees zero rows, including the `clientId: null` incident.
 * - `opsAll` (scope:all-clients) and `root` see A and B.
 * - No response carries a `password` key (H-01).
 *
 * Cases marked `it.fails` document live holes with their fix TODO: they
 * fail as expected today, and fixing the behavior without removing the
 * marker fails the suite on purpose.
 */

// Every MATRIX_SCOPE entry has a case in this file (checked below).
const COVERED = new Set([
  "incidents.ts :: getIncidents",
  "incidents.ts :: getIncidentById",
  "incidents.ts :: getReporterIncidents",
  "assignments.ts :: getAssignments",
  "assignments.ts :: getAssignmentById",
  "assignment-activities.ts :: getAllAssignmentActivities",
  "assignment-activities.ts :: getAssignmentActivities",
  "assignment-activities.ts :: getAssignmentActivityById",
  "assignment-items.ts :: getAssignmentItems",
  "clients.ts :: getClientsForSelect",
  "clients.ts :: getClients",
  "clients.ts :: getClientById",
  "lines.ts :: getLines",
  "lines.ts :: getLineById",
  "lines.ts :: getLinesByClientId",
  "equipments.ts :: getEquipments",
  "equipments.ts :: getEquipmentById",
  "equipments.ts :: getEquipmentsByLineId",
  "users.ts :: getUsers",
  "users.ts :: getUserById",
  "schedules.ts :: getSchedules",
  "schedules.ts :: getScheduleById",
  "incident-program.ts :: getScheduleOptions",
  "incident-program.ts :: getIncidentProgramReport",
  "tracking.ts :: getIncidentsForTracking",
  "vehicle-trips.ts :: getAllVehicleTrips",
  "vehicle-trips.ts :: getVehicleTripById",
]);

let world: IntWorld;
let userBId: string;
let trackingAId: string;

function todayRange(): { startDate: string; endDate: string } {
  const day = new Date().toISOString().slice(0, 10);
  return { startDate: day, endDate: day };
}

beforeAll(async () => {
  world = await createWorld("scope");
  // Canary for the user readers: assigned to B, must stay invisible to A.
  const fsrRole = await prisma.role.findUniqueOrThrow({
    where: { name: "FSR" },
  });
  const activo = await prisma.userStatus.findUniqueOrThrow({
    where: { name: "ACTIVO" },
  });
  const userB = await prisma.user.create({
    data: {
      name: "int-scope-user-b",
      email: "int-scope-user-b@test.local",
      password: "int-test-dummy-hash-scope",
      userStatusId: activo.id,
      userRoles: { create: [{ roleId: fsrRole.id }] },
    },
  });
  await prisma.userClientAssignment.create({
    data: { userId: userB.id, clientId: world.clientB.id, isPrimary: true },
  });
  userBId = userB.id;

  // No seed role pairs tracking:read with a tenant scope (ADMIN_OPERACION
  // holds scope:all-clients), so the tracking where-builder's tenant path
  // would otherwise go unexercised. A minimal inline role proves it.
  const trackingRead = await prisma.permission.findUniqueOrThrow({
    where: { name: "tracking:read" },
  });
  const trackingRole = await prisma.role.create({
    data: {
      name: "INT-scope-tracking",
      description: "integration canary: tenant tracking reader",
      defaultPath: "/inicio",
      priority: 5,
      rolePermission: { create: [{ permissionId: trackingRead.id }] },
    },
  });
  const trackingA = await prisma.user.create({
    data: {
      name: "int-scope-tracking-a",
      email: "int-scope-tracking-a@test.local",
      password: "int-test-dummy-hash-scope",
      userStatusId: activo.id,
      userRoles: { create: [{ roleId: trackingRole.id }] },
    },
  });
  await prisma.userClientAssignment.create({
    data: {
      userId: trackingA.id,
      clientId: world.clientA.id,
      isPrimary: true,
    },
  });
  trackingAId = trackingA.id;
});

describe("integration setup", () => {
  it("registers every MATRIX_SCOPE action in this file", () => {
    const missing = [...MATRIX_SCOPE].filter((key) => !COVERED.has(key));
    expect(missing, "MATRIX_SCOPE entries without a case here").toEqual([]);
  });

  it("actAs switches identity between calls (React cache() passthrough)", async () => {
    actAs(world.fsrA.id);
    const first = await getAuthenticatedUser();
    actAs(world.reporterA.id);
    const second = await getAuthenticatedUser();
    actAs(null);
    const none = await getAuthenticatedUser();
    expect(first?.id).toBe(world.fsrA.id);
    expect(second?.id).toBe(world.reporterA.id);
    expect(none).toBeNull();
  });
});

describe("incidents", () => {
  it("fsrA/reporterA/guestA see A, never B nor the null-client incident", async () => {
    for (const reader of [world.fsrA, world.reporterA, world.guestA]) {
      actAs(reader.id);
      const { data } = await getIncidents({ limit: 100 });
      const ids = data.map((row) => row.id);
      expect(ids).toContain(world.incidentA.id);
      expect(ids).not.toContain(world.incidentB.id);
      expect(ids).not.toContain(world.incidentNull.id);
      assertNoPasswordKey(data);
    }
  });

  it("sinCliente sees zero rows", async () => {
    actAs(world.sinCliente.id);
    const { data } = await getIncidents({ limit: 100 });
    expect(data).toEqual([]);
  });

  it("opsAll and root see A, B and the null-client incident", async () => {
    for (const reader of [world.opsAll, world.root]) {
      actAs(reader.id);
      const { data } = await getIncidents({ limit: 100 });
      const ids = data.map((row) => row.id);
      expect(ids).toContain(world.incidentA.id);
      expect(ids).toContain(world.incidentB.id);
      expect(ids).toContain(world.incidentNull.id);
      assertNoPasswordKey(data);
    }
  });

  it("getIncidentById: A readable, B denied, null-client denied for fsrA", async () => {
    actAs(world.fsrA.id);
    const own = await getIncidentById(world.incidentA.id);
    expect(own.id).toBe(world.incidentA.id);
    assertNoPasswordKey(own);

    expect(
      isDenial(await capture(() => getIncidentById(world.incidentB.id))),
    ).toBe(true);
    expect(
      isDenial(await capture(() => getIncidentById(world.incidentNull.id))),
    ).toBe(true);
  });

  // TODO(0c/H-05): the null check is skipped for clientId null, so a user
  // with no Client can open it by id while listings hide it. Fail closed.
  it.fails(
    "getIncidentById: sinCliente cannot open the null-client incident",
    async () => {
      actAs(world.sinCliente.id);
      expect(
        isDenial(await capture(() => getIncidentById(world.incidentNull.id))),
      ).toBe(true);
    },
  );

  it("getReporterIncidents: reporterA sees only their own A incident", async () => {
    actAs(world.reporterA.id);
    const rows = await getReporterIncidents();
    const ids = rows
      .filter((row) => row.title.startsWith("Int scope"))
      .map((row) => row.id);
    expect(ids).toEqual([world.incidentA.id]);
    assertNoPasswordKey(rows);
  });
});

describe("assignments", () => {
  it("fsrA/reporterA/guestA see assignment A, never B", async () => {
    for (const reader of [world.fsrA, world.reporterA, world.guestA]) {
      actAs(reader.id);
      const rows = await getAssignments();
      const ids = rows.map((row) => row.id);
      expect(ids).toContain(world.assignmentA.id);
      expect(ids).not.toContain(world.assignmentB.id);
      assertNoPasswordKey(rows);
    }
  });

  it("sinCliente sees zero assignments; opsAll and root see both", async () => {
    actAs(world.sinCliente.id);
    expect(await getAssignments()).toEqual([]);

    for (const reader of [world.opsAll, world.root]) {
      actAs(reader.id);
      const ids = (await getAssignments()).map((row) => row.id);
      expect(ids).toContain(world.assignmentA.id);
      expect(ids).toContain(world.assignmentB.id);
    }
  });

  it("getAssignmentById: A readable, B denied for fsrA", async () => {
    actAs(world.fsrA.id);
    const own = await getAssignmentById(world.assignmentA.id);
    expect(own?.id).toBe(world.assignmentA.id);

    expect(
      isDenial(await capture(() => getAssignmentById(world.assignmentB.id))),
    ).toBe(true);
  });

  // TODO(0a/H-01): incident.reportedBy travels with `include`, hash included.
  it.fails(
    "getAssignmentById: no response carries a password key",
    async () => {
      actAs(world.fsrA.id);
      assertNoPasswordKey(await getAssignmentById(world.assignmentA.id));
    },
  );
});

describe("tracking", () => {
  it("getIncidentsForTracking: tenant reader sees A, never B nor null", async () => {
    actAs(trackingAId);
    const { data } = await getIncidentsForTracking();
    const ids = data.map((row) => row.id);
    expect(ids).toContain(world.incidentA.id);
    expect(ids).not.toContain(world.incidentB.id);
    expect(ids).not.toContain(world.incidentNull.id);
    assertNoPasswordKey(data);
  });

  it("getIncidentsForTracking: clientId filter narrows inside the scope", async () => {
    actAs(trackingAId);
    const { data: own } = await getIncidentsForTracking({
      clientId: world.clientA.id,
    });
    expect(own.map((row) => row.id)).toContain(world.incidentA.id);

    const { data: foreign } = await getIncidentsForTracking({
      clientId: world.clientB.id,
    });
    expect(foreign).toEqual([]);
  });

  it("getIncidentsForTracking: roles without tracking:read are denied", async () => {
    for (const reader of [
      world.fsrA,
      world.reporterA,
      world.guestA,
      world.sinCliente,
    ]) {
      actAs(reader.id);
      await expect(getIncidentsForTracking()).rejects.toThrow(
        "Failed to fetch incidents",
      );
    }
  });

  it("getIncidentsForTracking: opsAll sees A+B", async () => {
    actAs(world.opsAll.id);
    const { data } = await getIncidentsForTracking();
    const ids = data.map((row) => row.id);
    expect(ids).toContain(world.incidentA.id);
    expect(ids).toContain(world.incidentB.id);
  });
});

describe("schedules", () => {
  it("fsrA sees A + global, never B; sinCliente sees nothing", async () => {
    actAs(world.fsrA.id);
    const { data } = await getSchedules({ limit: 100 });
    const ids = data.map((row) => row.id);
    expect(ids).toContain(world.scheduleA.id);
    expect(ids).toContain(world.scheduleGlobal.id);
    expect(ids).not.toContain(world.scheduleB.id);
    assertNoPasswordKey(data);

    actAs(world.sinCliente.id);
    const { data: empty } = await getSchedules({ limit: 100 });
    expect(empty).toEqual([]);
  });

  it("opsAll and root see A, B and global", async () => {
    for (const reader of [world.opsAll, world.root]) {
      actAs(reader.id);
      const ids = (await getSchedules({ limit: 100 })).data.map(
        (row) => row.id,
      );
      expect(ids).toContain(world.scheduleA.id);
      expect(ids).toContain(world.scheduleB.id);
      expect(ids).toContain(world.scheduleGlobal.id);
    }
  });

  // TODO(0c): getScheduleById checks the permission but never the scope.
  it.fails("getScheduleById: fsrA cannot open schedule B", async () => {
    actAs(world.fsrA.id);
    expect(
      isDenial(await capture(() => getScheduleById(world.scheduleB.id))),
    ).toBe(true);
  });
});

describe("incident program report", () => {
  it("default filters: fsrA sees their program", async () => {
    actAs(world.fsrA.id);
    const report = await getIncidentProgramReport(todayRange());
    expect(report.incidentCount).toBeGreaterThan(0);
    assertNoPasswordKey(report);

    const options = await getScheduleOptions(todayRange());
    const optionCodes = options.flatMap((option) => option.clientCodes);
    expect(optionCodes).toContain(world.clientA.code);
    expect(optionCodes).not.toContain(world.clientB.code);
  });

  it("reporterA, guestA and sinCliente are denied (no reports:view)", async () => {
    for (const reader of [world.reporterA, world.guestA, world.sinCliente]) {
      actAs(reader.id);
      expect(
        isDenial(await capture(() => getIncidentProgramReport(todayRange()))),
      ).toBe(true);
    }
  });
});

describe("vehicle trips", () => {
  it("getAllVehicleTrips: opsAll sees both worlds, fsrA is denied", async () => {
    actAs(world.opsAll.id);
    const ids = (await getAllVehicleTrips()).map((row) => row.id);
    expect(ids).toContain(world.tripA.id);
    expect(ids).toContain(world.tripB.id);

    actAs(world.fsrA.id);
    // No manage-all gate here: a plain Error throw, pinned as is.
    await expect(getAllVehicleTrips()).rejects.toThrow("Only administrators");
  });

  it("getVehicleTripById: fsrA opens their own trip, fsrA2 is denied", async () => {
    actAs(world.fsrA.id);
    const own = await getVehicleTripById(world.tripA.id);
    expect(own.id).toBe(world.tripA.id);
    assertNoPasswordKey(own);

    actAs(world.fsrA2.id);
    // Ownership check throws a plain Error, pinned as is.
    await expect(getVehicleTripById(world.tripB.id)).rejects.toThrow(
      "Access denied",
    );
  });
});

describe("unscoped readers (H-03)", () => {
  // TODO(0c): none of these filter by scope — tenant B rows (and users with
  // no Client) are visible to any holder of the read permission.
  it.fails("getClients: fsrA sees only A", async () => {
    actAs(world.fsrA.id);
    const ids = (await getClients({ limit: 100 })).data.map((row) => row.id);
    expect(ids).toContain(world.clientA.id);
    expect(ids).not.toContain(world.clientB.id);
  });

  it.fails("getClientsForSelect: fsrA sees only A", async () => {
    actAs(world.fsrA.id);
    const ids = (await getClientsForSelect()).map((row) => row.id);
    expect(ids).toContain(world.clientA.id);
    expect(ids).not.toContain(world.clientB.id);
  });

  it.fails("getClientById: fsrA cannot open client B", async () => {
    actAs(world.fsrA.id);
    expect(isDenial(await capture(() => getClientById(world.clientB.id)))).toBe(
      true,
    );
  });

  // TODO(0a/H-01): userAssignments.user travels with `include`, hash included.
  it.fails("getClientById: no response carries a password key", async () => {
    actAs(world.opsAll.id);
    assertNoPasswordKey(await getClientById(world.clientA.id));
  });

  it.fails("getLines: fsrA sees only A lines", async () => {
    actAs(world.fsrA.id);
    const ids = (await getLines({ limit: 100 })).data.map((row) => row.id);
    expect(ids).toContain(world.lineA.id);
    expect(ids).not.toContain(world.lineB.id);
  });

  it.fails("getLineById: fsrA cannot open line B", async () => {
    actAs(world.fsrA.id);
    expect(isDenial(await capture(() => getLineById(world.lineB.id)))).toBe(
      true,
    );
  });

  it.fails("getLinesByClientId: fsrA cannot list client B lines", async () => {
    actAs(world.fsrA.id);
    expect(await getLinesByClientId(world.clientB.id)).toEqual([]);
  });

  it.fails("getEquipments: fsrA sees only A equipment", async () => {
    actAs(world.fsrA.id);
    const ids = (await getEquipments({ limit: 100 })).data.map((row) => row.id);
    expect(ids).toContain(world.equipmentA.id);
    expect(ids).not.toContain(world.equipmentB.id);
  });

  it.fails("getEquipmentById: fsrA cannot open equipment B", async () => {
    actAs(world.fsrA.id);
    expect(
      isDenial(await capture(() => getEquipmentById(world.equipmentB.id))),
    ).toBe(true);
  });

  it.fails(
    "getEquipmentsByLineId: fsrA cannot list line B equipment",
    async () => {
      actAs(world.fsrA.id);
      expect(await getEquipmentsByLineId(world.lineB.id)).toEqual([]);
    },
  );

  it.fails("getAllAssignmentActivities: fsrA sees only A", async () => {
    actAs(world.fsrA.id);
    const ids = (await getAllAssignmentActivities()).map((row) => row.id);
    expect(ids).toContain(world.activityA.id);
    expect(ids).not.toContain(world.activityB.id);
  });

  it.fails(
    "getAssignmentActivities: fsrA cannot list assignment B",
    async () => {
      actAs(world.fsrA.id);
      expect(await getAssignmentActivities(world.assignmentB.id)).toEqual([]);
    },
  );

  it.fails(
    "getAssignmentActivityById: fsrA cannot open activity B",
    async () => {
      actAs(world.fsrA.id);
      expect(
        isDenial(
          await capture(() => getAssignmentActivityById(world.activityB.id)),
        ),
      ).toBe(true);
    },
  );

  // TODO(0a/H-01): assignees.user travels with `user: true`, hash included.
  it.fails(
    "getAssignmentActivityById: no response carries a password key",
    async () => {
      actAs(world.opsAll.id);
      assertNoPasswordKey(await getAssignmentActivityById(world.activityA.id));
    },
  );

  it.fails(
    "getAssignmentItems: fsrA cannot list assignment B items",
    async () => {
      actAs(world.fsrA.id);
      expect(await getAssignmentItems(world.assignmentB.id)).toEqual([]);
    },
  );

  // users:read scoping is product decision #1 (pending): no contract for
  // WHAT a scoped reader sees, only that B-only users must stay invisible.
  it.fails("getUsers: fsrA never sees the B canary", async () => {
    actAs(world.fsrA.id);
    const ids = (await getUsers({ limit: 100 })).data.map((row) => row.id);
    expect(ids).not.toContain(userBId);
  });

  it.fails("getUserById: fsrA cannot open the B canary", async () => {
    actAs(world.fsrA.id);
    expect(isDenial(await capture(() => getUserById(userBId)))).toBe(true);
  });

  // TODO(0a/H-01): user rows travel with `include`, hash included.
  it.fails("getUsers: no response carries a password key", async () => {
    actAs(world.opsAll.id);
    assertNoPasswordKey(await getUsers({ limit: 5 }));
  });

  it.fails("getUserById: no response carries a password key", async () => {
    actAs(world.opsAll.id);
    assertNoPasswordKey(await getUserById(world.fsrA.id));
  });
});
