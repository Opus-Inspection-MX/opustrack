"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";

export type VehicleFormData = {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  color?: string;
  status: string;
  notes?: string;
};

/**
 * Get all vehicles (no VIC filtering - company-wide fleet)
 */
export async function getVehicles() {
  await requirePermission("vehicles:read");

  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    include: {
      _count: {
        select: { trips: true },
      },
    },
    orderBy: { licensePlate: "asc" },
  });

  // Serialize dates
  return vehicles.map((vehicle) => ({
    ...vehicle,
    createdAt: vehicle.createdAt.toISOString(),
    updatedAt: vehicle.updatedAt.toISOString(),
  }));
}

/**
 * Get single vehicle
 */
export async function getVehicleById(id: string) {
  await requirePermission("vehicles:read");

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      trips: {
        where: { active: true },
        include: {
          fsr: {
            select: { id: true, name: true, email: true },
          },
          workOrder: {
            select: { id: true, folio: true },
          },
        },
        orderBy: { startedAt: "desc" },
        take: 10, // Recent 10 trips
      },
      _count: {
        select: { trips: true },
      },
    },
  });

  if (!vehicle) {
    throw new Error("Vehicle not found");
  }

  return vehicle;
}

/**
 * Create vehicle (admin only)
 */
export async function createVehicle(data: VehicleFormData) {
  await requirePermission("vehicles:create");

  const vehicle = await prisma.vehicle.create({
    data: {
      make: data.make,
      model: data.model,
      year: data.year,
      licensePlate: data.licensePlate,
      vin: data.vin || null,
      color: data.color || null,
      status: data.status,
      notes: data.notes || null,
    },
  });

  revalidatePath("/admin/vehicles");
  return { success: true, data: vehicle };
}

/**
 * Update vehicle
 */
export async function updateVehicle(id: string, data: VehicleFormData) {
  await requirePermission("vehicles:update");

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      make: data.make,
      model: data.model,
      year: data.year,
      licensePlate: data.licensePlate,
      vin: data.vin || null,
      color: data.color || null,
      status: data.status,
      notes: data.notes || null,
    },
  });

  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${id}`);
  return { success: true, data: vehicle };
}

/**
 * Soft delete vehicle
 */
export async function deleteVehicle(id: string) {
  await requirePermission("vehicles:delete");

  // Check for active trips
  const activeTripCount = await prisma.vehicleTrip.count({
    where: { vehicleId: id, status: "IN_PROGRESS", active: true },
  });

  if (activeTripCount > 0) {
    throw new Error(
      `Cannot delete vehicle. ${activeTripCount} trip(s) are in progress.`,
    );
  }

  await prisma.vehicle.update({
    where: { id },
    data: { active: false },
  });

  revalidatePath("/admin/vehicles");
  redirect("/admin/vehicles");
}

/**
 * Update vehicle status
 */
export async function updateVehicleStatus(id: string, status: string) {
  await requirePermission("vehicles:update");

  await prisma.vehicle.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${id}`);
  return { success: true };
}
