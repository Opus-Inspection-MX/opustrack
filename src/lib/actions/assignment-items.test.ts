import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, requirePermission } = vi.hoisted(() => ({
  prismaMock: {
    assignment: { findUnique: vi.fn() },
    assignmentItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "u1" })),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createAssignmentItem, deleteAssignmentItem } from "./assignment-items";

/**
 * Parts and equipment recorded on an assignment.
 *
 * The list carries prices, so it is what gets billed and audited. Two rules
 * matter: it stops moving once the incident is closed, and the numbers on it
 * have to make sense.
 */

const OPEN = { incident: { status: { name: "EN_PROGRESO" } } };
const CLOSED = { incident: { status: { name: "CERRADO" } } };
const CANCELLED = { incident: { status: { name: "CANCELADA" } } };

const valid = {
  assignmentId: "a1",
  name: "Sensor de proximidad",
  quantity: 2,
  unitPrice: 150.5,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.assignment.findUnique.mockResolvedValue(OPEN);
  prismaMock.assignmentItem.create.mockResolvedValue({ id: "i1" });
  prismaMock.assignmentItem.findUnique.mockResolvedValue({
    assignmentId: "a1",
  });
  prismaMock.assignmentItem.update.mockResolvedValue({ assignmentId: "a1" });
});

describe("createAssignmentItem", () => {
  it("exige el permiso assignments:update, que el FSR tiene", async () => {
    await createAssignmentItem(valid);
    expect(requirePermission).toHaveBeenCalledWith("assignments:update");
  });

  it("guarda el nombre recortado con su cantidad y precio", async () => {
    await createAssignmentItem({ ...valid, name: "  Manguera  " });

    expect(prismaMock.assignmentItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Manguera",
          quantity: 2,
          unitPrice: 150.5,
        }),
      }),
    );
  });

  it("rechaza una incidencia CERRADA", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(CLOSED);

    // The finished work record is what gets billed; it must stop moving.
    const result = await createAssignmentItem(valid);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cerrada/),
    });
    expect(prismaMock.assignmentItem.create).not.toHaveBeenCalled();
  });

  it("rechaza una incidencia CANCELADA", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(CANCELLED);

    const result = await createAssignmentItem(valid);

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cancelada/),
    });
    expect(prismaMock.assignmentItem.create).not.toHaveBeenCalled();
  });

  it("exige nombre", async () => {
    const result = await createAssignmentItem({ ...valid, name: "   " });
    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/nombre/),
    });
  });

  it("exige cantidad mayor que cero", async () => {
    for (const quantity of [0, -3, Number.NaN]) {
      const result = await createAssignmentItem({ ...valid, quantity });
      expect(result, String(quantity)).toEqual({
        success: false,
        error: expect.stringMatching(/cantidad/),
      });
    }
  });

  it("rechaza un precio negativo pero acepta cero", async () => {
    // Zero is legitimate: something taken from the van at no charge.
    expect(await createAssignmentItem({ ...valid, unitPrice: -1 })).toEqual({
      success: false,
      error: expect.stringMatching(/negativo/),
    });

    prismaMock.assignmentItem.create.mockClear();
    await createAssignmentItem({ ...valid, unitPrice: 0 });
    expect(prismaMock.assignmentItem.create).toHaveBeenCalled();
  });
});

describe("deleteAssignmentItem", () => {
  it("desactiva en vez de borrar", async () => {
    await deleteAssignmentItem("i1");

    // The line was part of the work record; removing it should not erase that
    // it was ever there.
    expect(prismaMock.assignmentItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "i1" },
        data: { active: false },
      }),
    );
  });

  it("no deja quitar líneas de una incidencia cerrada", async () => {
    prismaMock.assignment.findUnique.mockResolvedValue(CLOSED);

    const result = await deleteAssignmentItem("i1");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/cerrada/),
    });
    expect(prismaMock.assignmentItem.update).not.toHaveBeenCalled();
  });
});
