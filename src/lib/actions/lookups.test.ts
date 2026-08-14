import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Delete guards for the ten lookup catalogs.
 *
 * These catalogs sit under everything else — states hold clientes, statuses
 * drive the state machines, permissions define the RBAC. Soft-deleting one that
 * still has active children would leave those rows pointing at an inactive
 * parent, and nothing downstream re-validates that. The guard is the only thing
 * standing between an admin click and orphaned data, so it is pinned here.
 *
 * Prisma is mocked: the rule under test is the guard, not the query.
 */

// vi.mock is hoisted above every top-level statement, so the mocks it closes
// over have to be created with vi.hoisted().
const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    cliente: { count: vi.fn() },
    user: { count: vi.fn() },
    incident: { count: vi.fn() },
    assignment: { count: vi.fn() },
    line: { count: vi.fn() },
    equipment: { count: vi.fn() },
    vehicle: { count: vi.fn() },
    vehicleTrip: { count: vi.fn() },
    rolePermission: { count: vi.fn() },

    // deleteIncidentType also reads the row first, to protect the fallback type.
    state: { update: vi.fn() },
    userStatus: { update: vi.fn() },
    incidentType: { update: vi.fn(), findUnique: vi.fn() },
    incidentStatus: { update: vi.fn() },
    assignmentStatus: { update: vi.fn() },
    equipmentStatus: { update: vi.fn() },
    vehicleStatus: { update: vi.fn() },
    vehicleTripStatus: { update: vi.fn() },
    permission: { update: vi.fn() },
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "admin" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * `redirect()` works by throwing; Next catches it upstream. The mock keeps that
 * shape so a successful delete is distinguishable from a guard rejection.
 */
const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT}:${path}`);
  },
}));

import { FALLBACK_INCIDENT_TYPE_NAME } from "@/lib/constants/incident-type";
import * as lookups from "./lookups";

/** One row per catalog: the action, its permission, the child it counts. */
const CATALOGS = [
  {
    action: "deleteState",
    permission: "states:delete",
    child: "cliente",
    model: "state",
  },
  {
    action: "deleteUserStatus",
    permission: "user-status:delete",
    child: "user",
    model: "userStatus",
  },
  {
    action: "deleteIncidentType",
    permission: "incident-types:delete",
    child: "incident",
    model: "incidentType",
  },
  {
    action: "deleteIncidentStatus",
    permission: "incident-status:delete",
    child: "incident",
    model: "incidentStatus",
  },
  {
    action: "deleteAssignmentStatus",
    permission: "assignment-status:delete",
    child: "assignment",
    model: "assignmentStatus",
  },
  {
    action: "deleteEquipmentStatus",
    permission: "settings:delete",
    child: "equipment",
    model: "equipmentStatus",
  },
  {
    action: "deleteVehicleStatus",
    permission: "settings:delete",
    child: "vehicle",
    model: "vehicleStatus",
  },
  {
    action: "deleteVehicleTripStatus",
    permission: "settings:delete",
    child: "vehicleTrip",
    model: "vehicleTripStatus",
  },
  {
    action: "deletePermission",
    permission: "permissions:manage",
    child: "rolePermission",
    model: "permission",
  },
] as const;

type Catalog = (typeof CATALOGS)[number];

const call = (name: Catalog["action"]) =>
  (lookups as unknown as Record<string, (id: number) => Promise<unknown>>)[
    name
  ](1);

const childCount = (c: Catalog) =>
  (
    prismaMock as unknown as Record<string, { count: ReturnType<typeof vi.fn> }>
  )[c.child].count;

const modelUpdate = (c: Catalog) =>
  (
    prismaMock as unknown as Record<
      string,
      { update: ReturnType<typeof vi.fn> }
    >
  )[c.model].update;

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(prismaMock)) {
    if ("count" in model) model.count.mockResolvedValue(0);
    if ("update" in model) model.update.mockResolvedValue({ id: 1 });
    if ("findUnique" in model)
      model.findUnique.mockResolvedValue({ name: "Otro" });
  }
});

describe.each(CATALOGS)("$action", (catalog) => {
  it("exige su permiso antes de tocar la base", async () => {
    await expect(call(catalog.action)).rejects.toThrow(REDIRECT);
    expect(requirePermission).toHaveBeenCalledWith(catalog.permission);
  });

  it("desactiva el registro cuando no hay hijos activos", async () => {
    childCount(catalog).mockResolvedValue(0);

    // Success ends in redirect(), which throws by design.
    await expect(call(catalog.action)).rejects.toThrow(REDIRECT);

    expect(modelUpdate(catalog)).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { active: false },
    });
  });

  it("rechaza y NO escribe cuando quedan hijos activos", async () => {
    childCount(catalog).mockResolvedValue(3);

    // Returned, not thrown: a production build of Next strips the message of
    // anything a Server Action throws, and this count is precisely what the
    // user needs to read to understand the refusal.
    const result = await call(catalog.action);

    expect(result).toMatchObject({ success: false });
    expect((result as { error: string }).error).toMatch(/3/);
    // The important half: nothing was written.
    expect(modelUpdate(catalog)).not.toHaveBeenCalled();
  });

  it("solo cuenta hijos activos", async () => {
    await call(catalog.action).catch(() => {});

    expect(childCount(catalog)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ active: true }),
      }),
    );
  });
});

/**
 * `deleteIncidentType` carries one rule the others do not: the fallback type is
 * what every unclassified incident points at, so removing it would break
 * classification for the whole system.
 */
describe("deleteIncidentType · tipo de sistema", () => {
  it("no permite eliminar el tipo de respaldo", async () => {
    prismaMock.incidentType.findUnique.mockResolvedValue({
      name: FALLBACK_INCIDENT_TYPE_NAME,
    });

    const result = (await lookups.deleteIncidentType(1)) as { error: string };

    expect(result.error).toContain(FALLBACK_INCIDENT_TYPE_NAME);
    expect(prismaMock.incidentType.update).not.toHaveBeenCalled();
    // Rejected before even counting incidents.
    expect(prismaMock.incident.count).not.toHaveBeenCalled();
  });

  it("permite eliminar cualquier otro tipo sin incidentes", async () => {
    prismaMock.incidentType.findUnique.mockResolvedValue({
      name: "Falla de Red",
    });

    await expect(lookups.deleteIncidentType(1)).rejects.toThrow(REDIRECT);
    expect(prismaMock.incidentType.update).toHaveBeenCalled();
  });
});
