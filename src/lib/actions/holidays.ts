"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  type HolidayFormData,
  validateHolidayXOR,
} from "@/lib/validations/holidays";

/**
 * Get all active holidays ordered by month and day.
 */
export async function getHolidays() {
  await requirePermission("holidays:read");

  const holidays = await prisma.holiday.findMany({
    where: { active: true },
    orderBy: [{ month: "asc" }, { day: "asc" }, { nthMonday: "asc" }],
  });

  return holidays;
}

/**
 * Get a single holiday by ID.
 */
export async function getHolidayById(id: number) {
  await requirePermission("holidays:read");

  const holiday = await prisma.holiday.findUnique({
    where: { id },
  });

  return holiday;
}

/**
 * Create a new holiday rule.
 */
export async function createHoliday(data: HolidayFormData) {
  await requirePermission("holidays:create");

  validateHolidayXOR(data);

  const holiday = await prisma.holiday.create({
    data: {
      name: data.name,
      month: data.month,
      day: data.day ?? null,
      nthMonday: data.nthMonday ?? null,
      isRecurring: data.isRecurring,
      year: data.year ?? null,
    },
  });

  revalidatePath("/admin/holidays");
  return { success: true, data: holiday };
}

/**
 * Update an existing holiday rule.
 */
export async function updateHoliday(id: number, data: HolidayFormData) {
  await requirePermission("holidays:update");

  validateHolidayXOR(data);

  const holiday = await prisma.holiday.update({
    where: { id },
    data: {
      name: data.name,
      month: data.month,
      day: data.day ?? null,
      nthMonday: data.nthMonday ?? null,
      isRecurring: data.isRecurring,
      year: data.year ?? null,
    },
  });

  revalidatePath("/admin/holidays");
  revalidatePath(`/admin/holidays/${id}/edit`);
  return { success: true, data: holiday };
}

/**
 * Soft-delete a holiday rule (sets active: false).
 */
export async function deleteHoliday(id: number) {
  await requirePermission("holidays:delete");

  await prisma.holiday.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/holidays");
  redirect("/admin/holidays");
}
