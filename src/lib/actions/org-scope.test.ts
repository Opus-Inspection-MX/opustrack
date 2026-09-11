import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Scope wiring of the organization reads and writes (Fase 0c, H-03/H-04).
 *
 * Same door, same answer: `getClients*` now scope exactly like
 * GET /api/clients, and every line/equipment read or write proves the Client
 * — the loader logic itself is pinned in `auth/access.test.ts`.
 */

const { prismaMock, getUserClientIds, userBox } = vi.hoisted(() => {
  const model = () => ({
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  });
  return {
    prismaMock: {
      line: model(),
      equipment: model(),
      client: model(),
      role: { findFirst: vi.fn() },
    },
    getUserClientIds: vi.fn(async (_userId: string) => [] as string[]),
    userBox: { user: { id: "admin", isSuperuser: true } as never },
  };
});

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (_name: string) => Promise.resolve(userBox.user),
}));
vi.mock("@/lib/utils/client-assignments", () => ({ getUserClientIds }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getClientById, getClients, getClientsForSelect } from "./clients";
import { createEquipment, getEquipmentById, getEquipments } from "./equipments";
import { createLine, getLineById, getLines, getLinesByClientId } from "./lines";

const SCOPED = "c100000001";

function asScopedUser() {
  userBox.user = {
    id: "u1",
    isSuperuser: false,
    permissions: new Set<string>(),
  } as never;
  getUserClientIds.mockResolvedValue([SCOPED]);
}

function asSuperuser() {
  userBox.user = { id: "admin", isSuperuser: true } as never;
  getUserClientIds.mockResolvedValue([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  asSuperuser();
  prismaMock.line.findMany.mockResolvedValue([]);
  prismaMock.line.count.mockResolvedValue(0);
  prismaMock.equipment.findMany.mockResolvedValue([]);
  prismaMock.equipment.count.mockResolvedValue(0);
  prismaMock.client.findMany.mockResolvedValue([]);
  prismaMock.client.count.mockResolvedValue(0);
  prismaMock.role.findFirst.mockResolvedValue(null);
});

describe("lines scope (H-03/H-04)", () => {
  it("getLines filtra por los Clientes del usuario", async () => {
    asScopedUser();
    await getLines();
    expect(prismaMock.line.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: { in: [SCOPED] },
        }),
      }),
    );
  });

  it("getLines no filtra a un superusuario", async () => {
    await getLines();
    const where = prismaMock.line.findMany.mock.calls[0][0].where;
    expect(where.clientId).toBeUndefined();
  });

  it("getLinesByClientId rechaza un Cliente fuera del alcance", async () => {
    asScopedUser();
    await expect(getLinesByClientId("otro")).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
    expect(prismaMock.line.findMany).not.toHaveBeenCalled();
  });

  it("getLineById rechaza la línea de otro Cliente", async () => {
    asScopedUser();
    prismaMock.line.findFirst.mockResolvedValue({
      id: 3,
      clientId: "otro",
    });
    await expect(getLineById(3)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
    expect(prismaMock.line.findUnique).not.toHaveBeenCalled();
  });

  it("createLine no escribe fuera del alcance", async () => {
    asScopedUser();
    const result = await createLine({ name: "L1", clientId: "otro" });
    expect(result).toEqual({
      success: false,
      error: "Sin acceso a los datos de este Cliente.",
    });
    expect(prismaMock.line.create).not.toHaveBeenCalled();
  });
});

describe("equipments scope (H-03/H-04)", () => {
  it("getEquipments filtra por la línea del alcance", async () => {
    asScopedUser();
    await getEquipments();
    expect(prismaMock.equipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          line: { clientId: { in: [SCOPED] } },
        }),
      }),
    );
  });

  it("getEquipmentById rechaza el equipo de otro Cliente", async () => {
    asScopedUser();
    prismaMock.equipment.findFirst.mockResolvedValue({
      id: 5,
      lineId: 3,
      line: { clientId: "otro" },
    });
    await expect(getEquipmentById(5)).rejects.toThrow(
      "Sin acceso a los datos de este Cliente.",
    );
    expect(prismaMock.equipment.findUnique).not.toHaveBeenCalled();
  });

  it("createEquipment no escribe en una línea fuera del alcance", async () => {
    asScopedUser();
    prismaMock.line.findFirst.mockResolvedValue({
      id: 3,
      clientId: "otro",
    });
    const result = await createEquipment({ name: "E1", lineId: 3 });
    expect(result).toEqual({
      success: false,
      error: "Sin acceso a los datos de este Cliente.",
    });
    expect(prismaMock.equipment.create).not.toHaveBeenCalled();
  });
});

describe("clients scope (H-03)", () => {
  it("getClients filtra como GET /api/clients", async () => {
    asScopedUser();
    await getClients();
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [SCOPED] } }),
      }),
    );
  });

  it("getClientsForSelect filtra como GET /api/clients", async () => {
    asScopedUser();
    await getClientsForSelect();
    expect(prismaMock.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [SCOPED] } }),
      }),
    );
  });

  it("getClientById responde null fuera del alcance (notFound, sin filtrar)", async () => {
    asScopedUser();
    prismaMock.client.findUnique.mockResolvedValue({ id: "otro" });
    await expect(getClientById("otro")).resolves.toBeNull();
  });
});
