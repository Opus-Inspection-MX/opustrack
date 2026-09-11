import { beforeEach, describe, expect, it, vi } from "vitest";

const { requirePermission, revalidatePath } = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    vacationPeriod: { count: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/services/vacation-periods", () => ({
  ensurePeriodsUpToNow: vi.fn(),
  recomputePeriodsForNewHireDate: vi.fn(),
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  ensurePeriodsUpToNow,
  recomputePeriodsForNewHireDate,
} from "@/lib/services/vacation-periods";
import { updateUserEmployment } from "./users";

/**
 * Hire-date capture (Parte B): the vacation administrator sets the date that
 * drives accrual, without holding full user administration.
 */

const VAC_ADMIN = { id: "vac-admin-1" };

function tomorrowISO(): string {
  return new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePermission.mockResolvedValue(VAC_ADMIN);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    hireDate: null,
    active: true,
  } as never);
  vi.mocked(prisma.user.update).mockResolvedValue({} as never);
  vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
});

describe("updateUserEmployment: permiso", () => {
  it("exige users:manage-employment, no users:update", async () => {
    await updateUserEmployment("u1", { hireDate: "2020-03-15" });

    expect(requirePermission).toHaveBeenCalledWith("users:manage-employment");
    expect(requirePermission).not.toHaveBeenCalledWith("users:update");
  });

  it("un rol sin el permiso no llega a la validación (el check lanza)", async () => {
    requirePermission.mockRejectedValue(new Error("Access denied"));

    await expect(
      updateUserEmployment("u1", { hireDate: "2020-03-15" }),
    ).rejects.toThrow("Access denied");
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("updateUserEmployment: validación de fecha", () => {
  it.each([
    ["ausente", "", "La fecha de contratación es obligatoria."],
    ["inválida", "no-es-fecha", "La fecha de contratación no es válida."],
    ["futura", tomorrowISO(), "La fecha de contratación no puede ser futura."],
    [
      "anterior a 1950",
      "1949-12-31",
      "La fecha de contratación no puede ser anterior a 1950.",
    ],
  ])("rechaza la fecha %s en español", async (_label, hireDate, error) => {
    const result = await updateUserEmployment("u1", { hireDate });

    expect(result).toEqual({ success: false, error });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rechaza al usuario inexistente o inactivo sin revelar cuál", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const result = await updateUserEmployment("u1", {
      hireDate: "2020-03-15",
    });

    expect(result).toEqual({ success: false, error: "No encontrado." });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("updateUserEmployment: escritura", () => {
  it("primera captura: escribe, genera períodos, audita y revalida", async () => {
    const result = await updateUserEmployment("u1", {
      hireDate: "2020-03-15",
    });

    expect(result.success).toBe(true);
    // First capture has nothing to recompute.
    expect(recomputePeriodsForNewHireDate).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { hireDate: expect.any(Date) },
    });
    expect(ensurePeriodsUpToNow).toHaveBeenCalledWith("u1");
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "vac-admin-1",
        entity: "USER",
        entityId: "u1",
        action: "UPDATE",
      }),
    });
    for (const path of ["/admin/vacations", "/vacations", "/admin/users/u1"]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("corrección: reutiliza el recálculo compartido en vez de duplicarlo", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      hireDate: new Date("2019-01-01T06:00:00.000Z"),
      active: true,
    } as never);

    const result = await updateUserEmployment("u1", {
      hireDate: "2020-03-15",
    });

    expect(result.success).toBe(true);
    expect(recomputePeriodsForNewHireDate).toHaveBeenCalledWith(
      "u1",
      expect.any(Date),
    );
    expect(ensurePeriodsUpToNow).toHaveBeenCalledWith("u1");
  });

  it("fecha sin cambios: éxito sin escribir ni auditar", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      hireDate: new Date("2020-03-15T06:00:00.000Z"),
      active: true,
    } as never);

    const result = await updateUserEmployment("u1", {
      hireDate: "2020-03-15",
    });

    expect(result.success).toBe(true);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });
});
