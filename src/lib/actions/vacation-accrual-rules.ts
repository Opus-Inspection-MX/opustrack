"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import { businessRule, guarded } from "./result";

/**
 * Admin CRUD for the vacation entitlement table and the grace window.
 *
 * These are the knobs that make the entitlement rules data instead of code:
 * if the LFT changes again, the days per year of service and how long they stay
 * usable are edited here rather than in a deploy.
 *
 * Both are gated by `vacations:manage`, so the vacation administrator
 * (ADMIN_VACACIONES) configures them without holding `settings:*` — which
 * would also hand over the vehicle and equipment status catalogs.
 */

export interface AccrualRuleFormData {
  minYears: number;
  maxYears: number | null;
  days: number;
}

const DATABASE_INT_MAX = 2_147_483_647;

function isDatabaseInt(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= DATABASE_INT_MAX;
}

function validateRuleId(id: number): void {
  if (!isDatabaseInt(id) || id < 1) {
    businessRule(
      "El identificador de la regla debe ser un entero válido mayor que cero.",
    );
  }
}

export async function getAccrualRules() {
  await requirePermission("vacations:manage");

  return prisma.vacationAccrualRule.findMany({
    where: { active: true },
    orderBy: { minYears: "asc" },
  });
}

export async function getAccrualRuleById(id: number) {
  await requirePermission("vacations:manage");

  if (!isDatabaseInt(id) || id < 1) return null;
  return prisma.vacationAccrualRule.findFirst({ where: { id, active: true } });
}

/**
 * Shared shape checks. Ranges are inclusive on both ends, and an open-ended
 * `maxYears` is what covers everyone past the last defined tier.
 */
function validateRule(data: AccrualRuleFormData): void {
  if (!isDatabaseInt(data.minYears) || data.minYears < 1) {
    businessRule("El año inicial debe ser un entero entre 1 y 2147483647.");
  }
  if (data.maxYears !== null) {
    if (!isDatabaseInt(data.maxYears) || data.maxYears < 1) {
      businessRule("El año final debe ser un entero entre 1 y 2147483647.");
    }
    if (data.maxYears < data.minYears) {
      businessRule("El año final no puede ser menor que el año inicial.");
    }
  }
  if (!isDatabaseInt(data.days)) {
    businessRule("Los días deben ser un número entero mayor o igual a cero.");
  }
  if (data.days > 365) {
    businessRule("Los días no pueden exceder 365.");
  }
}

/**
 * Reject tiers that overlap an existing one: two rules covering the same year
 * of service would make the entitlement depend on query order.
 */
async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  data: AccrualRuleFormData,
  excludeId?: number,
): Promise<void> {
  const others = await tx.vacationAccrualRule.findMany({
    where: {
      active: true,
      ...(excludeId !== undefined ? { id: { not: excludeId } } : {}),
    },
  });

  const newMax = data.maxYears ?? Number.MAX_SAFE_INTEGER;

  const clash = others.find((rule) => {
    const ruleMax = rule.maxYears ?? Number.MAX_SAFE_INTEGER;
    return data.minYears <= ruleMax && newMax >= rule.minYears;
  });

  if (clash) {
    const clashLabel =
      clash.maxYears === null
        ? `${clash.minYears}+`
        : `${clash.minYears}-${clash.maxYears}`;
    businessRule(
      `El rango se traslapa con la regla existente de ${clashLabel} años. Ajusta los límites para que no se encimen.`,
    );
  }
}

/** minYears remains unique even after soft deletion; return a usable rule error. */
function rejectDuplicateStart(error: unknown): never {
  const target = (error as { meta?: { target?: unknown } } | null)?.meta
    ?.target;
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002" &&
    Array.isArray(target) &&
    target.includes("minYears")
  ) {
    businessRule(
      "Ya existe una regla con ese año inicial, incluso si fue dada de baja. Selecciona un año inicial distinto.",
    );
  }
  throw error;
}

function ruleValues(data: AccrualRuleFormData): AccrualRuleFormData {
  return { minYears: data.minYears, maxYears: data.maxYears, days: data.days };
}

export async function createAccrualRule(data: AccrualRuleFormData) {
  const caller = await requirePermission("vacations:manage");

  const result = await guarded(async () => {
    validateRule(data);
    try {
      const rule = await serializableTransaction(async (tx) => {
        await assertNoOverlap(tx, data);
        return tx.vacationAccrualRule.create({
          data: {
            ...ruleValues(data),
            active: true,
            createdById: caller.id,
            updatedById: caller.id,
          },
        });
      });
      return { data: rule };
    } catch (error) {
      rejectDuplicateStart(error);
    }
  });
  if (result.success) revalidatePath("/admin/settings/vacation-accrual");
  return result;
}

export async function updateAccrualRule(id: number, data: AccrualRuleFormData) {
  const caller = await requirePermission("vacations:manage");

  const result = await guarded(async () => {
    validateRuleId(id);
    validateRule(data);
    try {
      const rule = await serializableTransaction(async (tx) => {
        const existing = await tx.vacationAccrualRule.findFirst({
          where: { id, active: true },
        });
        if (!existing)
          businessRule("La regla de acumulación no existe o está inactiva.");
        await assertNoOverlap(tx, data, id);
        return tx.vacationAccrualRule.update({
          where: { id, active: true },
          data: { ...ruleValues(data), updatedById: caller.id },
        });
      });
      return { data: rule };
    } catch (error) {
      rejectDuplicateStart(error);
    }
  });
  if (result.success) revalidatePath("/admin/settings/vacation-accrual");
  return result;
}

/**
 * Soft-delete a tier.
 *
 * Existing periods keep working: they snapshot `ruleDays` when created, so
 * removing a tier only affects periods generated from now on.
 */
export async function deleteAccrualRule(id: number) {
  const caller = await requirePermission("vacations:manage");

  const result = await guarded(async () => {
    validateRuleId(id);
    await serializableTransaction(async (tx) => {
      const changed = await tx.vacationAccrualRule.updateMany({
        where: { id, active: true },
        data: {
          active: false,
          updatedById: caller.id,
          deactivatedById: caller.id,
          deactivatedAt: new Date(),
        },
      });
      if (changed.count !== 1)
        businessRule("La regla de acumulación no existe o está inactiva.");
    });
    return {};
  });
  if (result.success) revalidatePath("/admin/settings/vacation-accrual");
  return result;
}

// ---------------------------------------------------------------------------
// Grace window
// ---------------------------------------------------------------------------

export async function getVacationSetting() {
  await requirePermission("vacations:manage");

  const setting = await prisma.vacationSetting.findUnique({ where: { id: 1 } });
  return setting ?? { id: 1, graceWindowMonths: 12, updatedAt: new Date() };
}

/**
 * Change how long earned days stay usable after their accrual year closes.
 *
 * Only affects periods created afterwards — existing ones keep the window they
 * were created with, so shortening this can never retroactively expire days
 * somebody still had a claim on.
 */
export async function updateVacationSetting(graceWindowMonths: number) {
  await requirePermission("vacations:manage");

  const result = await guarded(async () => {
    if (!isDatabaseInt(graceWindowMonths)) {
      businessRule(
        "La vigencia debe ser un número entero de meses mayor o igual a 0.",
      );
    }
    if (graceWindowMonths > 120) {
      businessRule("La vigencia no puede exceder 120 meses.");
    }

    const setting = await serializableTransaction((tx) =>
      tx.vacationSetting.upsert({
        where: { id: 1 },
        update: { graceWindowMonths },
        create: { id: 1, graceWindowMonths },
      }),
    );
    return { data: setting };
  });
  if (result.success) revalidatePath("/admin/settings/vacation-accrual");
  return result;
}
