import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Delete guards for the catalogs that own their action file.
 *
 * Same rule as the lookup catalogs: never soft-delete a parent that still has
 * active children, because nothing downstream re-validates the relation. These
 * are pinned separately because each lives in its own module with its own
 * child relation.
 */

const { prismaMock, requirePermission } = vi.hoisted(() => {
  const model = () => ({
    count: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
  });
  return {
    prismaMock: {
      cliente: model(),
      userClienteAssignment: model(),
      line: model(),
      equipment: model(),
      incident: model(),
      part: model(),
      workPart: model(),
      role: model(),
      user: model(),
      userRole: model(),
      vehicle: model(),
      vehicleTrip: model(),
      holiday: model(),
    },
    // ROOT: `deleteRole` is gated on `isSuperuser`, not on a permission, so a
    // caller without it is refused before the child-count rule is ever reached.
    requirePermission: vi.fn(async (_name: string) => ({
      id: "admin",
      isSuperuser: true,
      roles: [],
      permissions: new Set<string>(),
      resourceActions: new Set<string>(),
      routeGrants: { prefixes: [], exact: [] },
      defaultPath: "/admin",
    })),
  };
});

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const REDIRECT = "NEXT_REDIRECT";
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT}:${path}`);
  },
}));

import { deleteCliente } from "./clientes";
import { deleteEquipment } from "./equipments";
import { deleteHoliday } from "./holidays";
import { deleteLine } from "./lines";
import { deletePart } from "./parts";
import { deleteRole } from "./roles";
import { deleteVehicle } from "./vehicles";

type Model = (typeof prismaMock)[keyof typeof prismaMock];

/**
 * Catalogs that guard a child relation. `run` takes the id shape each action
 * expects (cuid for cliente, number for the rest).
 */
const GUARDED = [
  {
    name: "deleteCliente",
    permission: "clientes:delete",
    run: () => deleteCliente("c1"),
    child: () => prismaMock.userClienteAssignment,
    parent: () => prismaMock.cliente,
  },
  {
    name: "deleteLine",
    permission: "lines:delete",
    run: () => deleteLine(1),
    child: () => prismaMock.equipment,
    parent: () => prismaMock.line,
  },
  {
    name: "deleteEquipment",
    permission: "equipments:delete",
    run: () => deleteEquipment(1),
    child: () => prismaMock.incident,
    parent: () => prismaMock.equipment,
  },
  {
    name: "deletePart",
    permission: "parts:delete",
    run: () => deletePart("p1"),
    child: () => prismaMock.workPart,
    parent: () => prismaMock.part,
  },
  {
    name: "deleteRole",
    permission: "roles:delete",
    run: () => deleteRole(1),
    // Users reach a role through the join table now, so that is what gets
    // counted before the role may be retired.
    child: () => prismaMock.userRole,
    parent: () => prismaMock.role,
  },
  {
    name: "deleteVehicle",
    permission: "vehicles:delete",
    run: () => deleteVehicle("v1"),
    child: () => prismaMock.vehicleTrip,
    parent: () => prismaMock.vehicle,
  },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(prismaMock) as Model[]) {
    model.count.mockResolvedValue(0);
    model.update.mockResolvedValue({ id: 1 });
    model.findUnique.mockResolvedValue({ id: 1, lineId: 1 });
  }
});

describe.each(GUARDED)("$name", (catalog) => {
  it("exige su permiso", async () => {
    await catalog.run().catch(() => {});
    expect(requirePermission).toHaveBeenCalledWith(catalog.permission);
  });

  it("desactiva (soft delete) cuando no hay hijos activos", async () => {
    await catalog.run().catch(() => {});

    expect(catalog.parent().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active: false }),
      }),
    );
  });

  it("rechaza y NO escribe cuando quedan hijos activos", async () => {
    catalog.child().count.mockResolvedValue(2);

    // Returned, not thrown: Next strips the message of anything a Server Action
    // throws in a production build, and the count is what the user must read.
    const result = (await catalog.run()) as { success: false; error: string };

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/2/);
    expect(catalog.parent().update).not.toHaveBeenCalled();
  });
});

/**
 * Holidays are a leaf: no model points at them, so there is nothing to orphan
 * and no guard is expected. Pinned so a future guard is a deliberate decision.
 */
describe("deleteHoliday", () => {
  it("desactiva sin contar hijos, porque no tiene", async () => {
    await deleteHoliday(1).catch(() => {});

    expect(prismaMock.holiday.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ active: false }),
      }),
    );
  });
});
