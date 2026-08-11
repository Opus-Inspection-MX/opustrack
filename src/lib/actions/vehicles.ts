"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { rejected } from "./result";

export type VehicleFormData = {
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  vin?: string;
  color?: string;
  status: string;
  notes?: string;
  assignedFsrId?: string | null;
};

/**
 * Get all vehicles (no Cliente filtering - company-wide fleet)
 */
export async function getVehicles() {
  await requirePermission("vehicles:read");

  const vehicles = await prisma.vehicle.findMany({
    where: { active: true },
    include: {
      status: true,
      assignedFsr: {
        select: { id: true, name: true, email: true },
      },
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
      status: true,
      assignedFsr: {
        select: { id: true, name: true, email: true },
      },
      trips: {
        where: { active: true },
        include: {
          fsr: {
            select: { id: true, name: true, email: true },
          },
          assignment: {
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

  // Get status ID from status name
  const status = await prisma.vehicleStatus.findFirst({
    where: { name: data.status },
  });

  const vehicle = await prisma.vehicle.create({
    data: {
      make: data.make,
      model: data.model,
      year: data.year,
      licensePlate: data.licensePlate,
      vin: data.vin || null,
      color: data.color || null,
      statusId: status?.id ?? 1,
      assignedFsrId: data.assignedFsrId || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/admin/vehicles");
  revalidatePath("/fsr/vehicles");
  return { success: true, data: vehicle };
}

/**
 * Update vehicle
 */
export async function updateVehicle(id: string, data: VehicleFormData) {
  await requirePermission("vehicles:update");

  // Get status ID from status name
  const status = await prisma.vehicleStatus.findFirst({
    where: { name: data.status },
  });

  const vehicle = await prisma.vehicle.update({
    where: { id },
    data: {
      make: data.make,
      model: data.model,
      year: data.year,
      licensePlate: data.licensePlate,
      vin: data.vin || null,
      color: data.color || null,
      statusId: status?.id ?? 1,
      assignedFsrId: data.assignedFsrId || null,
      notes: data.notes || null,
    },
  });

  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${id}`);
  revalidatePath("/fsr/vehicles");
  return { success: true, data: vehicle };
}

/**
 * Soft delete vehicle
 */
export async function deleteVehicle(id: string) {
  await requirePermission("vehicles:delete");

  // Check for active trips
  const activeTripCount = await prisma.vehicleTrip.count({
    where: { vehicleId: id, status: { name: "IN_PROGRESS" }, active: true },
  });

  if (activeTripCount > 0) {
    return rejected(
      `No se puede eliminar: ${activeTripCount} viaje(s) en curso usan este vehículo.`,
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
export async function updateVehicleStatus(id: string, statusName: string) {
  await requirePermission("vehicles:update");

  const status = await prisma.vehicleStatus.findFirst({
    where: { name: statusName },
  });

  if (!status) {
    throw new Error("Invalid status");
  }

  await prisma.vehicle.update({
    where: { id },
    data: { statusId: status.id },
  });

  revalidatePath("/admin/vehicles");
  revalidatePath(`/admin/vehicles/${id}`);
  return { success: true };
}

/**
 * Get all vehicle statuses
 */
export async function getVehicleStatuses() {
  await requirePermission("vehicles:read");

  return prisma.vehicleStatus.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });
}

/**
 * Get FSR users for vehicle assignment dropdown
 */
export async function getFsrUsersForAssignment() {
  await requirePermission("vehicles:read");

  // Get the FSR role
  const fsrRole = await prisma.role.findFirst({
    where: { name: "FSR", active: true },
  });

  if (!fsrRole) {
    return [];
  }

  return prisma.user.findMany({
    where: {
      roleId: fsrRole.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });
}
