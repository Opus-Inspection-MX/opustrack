"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { businessRule, guarded } from "./result";

/**
 * Admin CRUD for the vacation entitlement table and the grace window.
 *
 * These are the knobs that make the entitlement rules data instead of code:
 * if the LFT changes again, the days per year of service and how long they stay
 * usable are edited here rather than in a deploy.
 *
 * Both are gated by `settings:*`, matching the rest of the catalog management
 * under /admin/settings.
 */

export interface AccrualRuleFormData {
  minYears: number;
  maxYears: number | null;
  days: number;
}

export async function getAccrualRules() {
  await requirePermission("settings:read");

  return prisma.vacationAccrualRule.findMany({
    where: { active: true },
    orderBy: { minYears: "asc" },
  });
}

export async function getAccrualRuleById(id: number) {
  await requirePermission("settings:read");

  return prisma.vacationAccrualRule.findUnique({ where: { id } });
}

/**
 * Shared shape checks. Ranges are inclusive on both ends, and an open-ended
 * `maxYears` is what covers everyone past the last defined tier.
 */
function validateRule(data: AccrualRuleFormData): void {
  if (!Number.isInteger(data.minYears) || data.minYears < 1) {
    businessRule("El año inicial debe ser un número entero mayor o igual a 1.");
  }
  if (data.maxYears !== null) {
    if (!Number.isInteger(data.maxYears)) {
      businessRule("El año final debe ser un número entero.");
    }
    if (data.maxYears < data.minYears) {
      businessRule("El año final no puede ser menor que el año inicial.");
    }
  }
  if (!Number.isInteger(data.days) || data.days < 0) {
    businessRule("Los días deben ser un número entero positivo.");
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
  data: AccrualRuleFormData,
  excludeId?: number,
): Promise<void> {
  const others = await prisma.vacationAccrualRule.findMany({
    where: { active: true, ...(excludeId ? { id: { not: excludeId } } : {}) },
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

export async function createAccrualRule(data: AccrualRuleFormData) {
  await requirePermission("settings:create");

  return guarded(async () => {
    validateRule(data);
    await assertNoOverlap(data);

    const rule = await prisma.vacationAccrualRule.create({ data });

    revalidatePath("/admin/settings/vacation-accrual");
    return { data: rule };
  });
}

export async function updateAccrualRule(id: number, data: AccrualRuleFormData) {
  await requirePermission("settings:update");

  return guarded(async () => {
    validateRule(data);
    await assertNoOverlap(data, id);

    const rule = await prisma.vacationAccrualRule.update({
      where: { id },
      data,
    });

    revalidatePath("/admin/settings/vacation-accrual");
    return { data: rule };
  });
}

/**
 * Soft-delete a tier.
 *
 * Existing periods keep working: they snapshot `ruleDays` when created, so
 * removing a tier only affects periods generated from now on.
 */
export async function deleteAccrualRule(id: number) {
  await requirePermission("settings:delete");

  return guarded(async () => {
    await prisma.vacationAccrualRule.update({
      where: { id },
      data: { active: false },
    });

    revalidatePath("/admin/settings/vacation-accrual");
    return {};
  });
}

// ---------------------------------------------------------------------------
// Grace window
// ---------------------------------------------------------------------------

export async function getVacationSetting() {
  await requirePermission("settings:read");

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
  await requirePermission("settings:update");

  return guarded(async () => {
    if (!Number.isInteger(graceWindowMonths) || graceWindowMonths < 0) {
      businessRule(
        "La vigencia debe ser un número entero de meses mayor o igual a 0.",
      );
    }
    if (graceWindowMonths > 120) {
      businessRule("La vigencia no puede exceder 120 meses.");
    }

    const setting = await prisma.vacationSetting.upsert({
      where: { id: 1 },
      update: { graceWindowMonths },
      create: { id: 1, graceWindowMonths },
    });

    revalidatePath("/admin/settings/vacation-accrual");
    return { data: setting };
  });
}
