import { beforeAll, describe, expect, it } from "vitest";
import { updateUser, updateUserEmployment } from "@/lib/actions/users";
import { getVacationBalanceData } from "@/lib/actions/vacations";
import { prisma } from "@/lib/database/prisma.singleton";
import { capture, isDenial } from "./assertions";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Hire-date capture (Parte B), end to end at the action layer.
 *
 * - ADMIN_VACACIONES captures a missing hire date and the periods appear.
 * - An FSR is denied before any write.
 * - ROOT keeps working through the full user form (shared helper).
 */

let world: IntWorld;

beforeAll(async () => {
  world = await createWorld("employment");
});

describe("ADMIN_VACACIONES captura la fecha de ingreso", () => {
  it("la captura genera períodos y el saldo ya tiene fecha", async () => {
    actAs(world.vacAdmin.id);

    const before = await prisma.user.findUniqueOrThrow({
      where: { id: world.fsrA2.id },
      select: { hireDate: true },
    });
    expect(before.hireDate).toBeNull();

    const result = await updateUserEmployment(world.fsrA2.id, {
      hireDate: "2020-03-15",
    });
    expect(result).toEqual({ success: true });

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: world.fsrA2.id },
      select: { hireDate: true },
    });
    expect(stored.hireDate).not.toBeNull();

    const periods = await prisma.vacationPeriod.count({
      where: { userId: world.fsrA2.id },
    });
    expect(periods).toBeGreaterThan(0);

    const balance = await getVacationBalanceData(world.fsrA2.id);
    expect(balance.success).toBe(true);
    if (balance.success === true) {
      expect(balance.hasHireDate).toBe(true);
      expect(balance.periods.length).toBeGreaterThan(0);
    }

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "USER", entityId: world.fsrA2.id },
    });
    expect(audit).not.toBeNull();
  });

  it("una fecha futura se devuelve en español sin escribir", async () => {
    actAs(world.vacAdmin.id);

    const future = new Date(Date.now() + 24 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const result = await updateUserEmployment(world.fsrA.id, {
      hireDate: future,
    });

    expect(result).toEqual({
      success: false,
      error: "La fecha de contratación no puede ser futura.",
    });
    const untouched = await prisma.user.findUniqueOrThrow({
      where: { id: world.fsrA.id },
      select: { hireDate: true },
    });
    expect(untouched.hireDate).toBeNull();
  });
});

describe("un FSR no puede capturar fechas", () => {
  it("se rechaza antes de escribir", async () => {
    actAs(world.fsrA.id);

    const outcome = await capture(() =>
      updateUserEmployment(world.fsrA2.id, { hireDate: "2021-01-01" }),
    );
    expect(isDenial(outcome)).toBe(true);
  });
});

describe("ROOT sigue por el formulario de usuario", () => {
  it("updateUser con fecha genera períodos (helper compartido)", async () => {
    actAs(world.root.id);

    const [fsrRole, activo] = await Promise.all([
      prisma.role.findUniqueOrThrow({ where: { name: "FSR" } }),
      prisma.userStatus.findUniqueOrThrow({ where: { name: "ACTIVO" } }),
    ]);

    const result = await updateUser(world.fsrA.id, {
      name: "int-employment-fsr-a",
      email: world.fsrA.email,
      roleIds: [fsrRole.id],
      userStatusId: activo.id,
      clientId: world.clientA.id,
      hireDate: "2021-06-01",
    });
    expect(result.success).toBe(true);

    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: world.fsrA.id },
      select: { hireDate: true },
    });
    expect(stored.hireDate).not.toBeNull();

    const periods = await prisma.vacationPeriod.count({
      where: { userId: world.fsrA.id },
    });
    expect(periods).toBeGreaterThan(0);
  });
});
