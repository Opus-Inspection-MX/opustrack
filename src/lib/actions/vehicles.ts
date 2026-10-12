"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/auth";
import { userHasPermission } from "@/lib/authz/authz";
import { ROLE } from "@/lib/authz/roles";
import { whereHasRole } from "@/lib/authz/user-queries";
import {
  VEHICLE_STATUS,
  VEHICLE_TRIP_STATUS,
} from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import { businessRule, guarded } from "./result";

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
 * Get all vehicles (no Client filtering - company-wide fleet)
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
  const user = await requirePermission("vehicles:read");
  const tripScope = userHasPermission(user, "vehicle-trips:manage-all")
    ? {}
    : { fsrId: user.id };

  const vehicle = await prisma.vehicle.findUnique({
    where: { id, active: true },
    include: {
      status: true,
      assignedFsr: {
        select: { id: true, name: true, email: true },
      },
      trips: {
        where: { active: true, ...tripScope },
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
        select: { trips: { where: { active: true, ...tripScope } } },
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
  const user = await requirePermission("vehicles:create");
  return guarded(async () => {
    const vehicle = await serializableTransaction(async (tx) => {
      const status = await validateVehicleWrite(
        tx,
        data.status,
        data.assignedFsrId,
      );
      return tx.vehicle.create({
        data: {
          make: data.make,
          model: data.model,
          year: data.year,
          licensePlate: data.licensePlate,
          vin: data.vin || null,
          color: data.color || null,
          statusId: status.id,
          operationalStatusCode: data.status,
          createdById: user.id,
          assignedFsrId: data.assignedFsrId || null,
          notes: data.notes || null,
        },
      });
    });

    revalidatePath("/admin/vehicles");
    // No `/fsr/vehicles` route exists: the FSR vehicle surface is the trips
    // list, which embeds each trip's vehicle.
    revalidatePath("/fsr/vehicle-trips");
    return { data: vehicle };
  });
}

/**
 * Update vehicle
 */
export async function updateVehicle(id: string, data: VehicleFormData) {
  const user = await requirePermission("vehicles:update");
  return guarded(async () => {
    const vehicle = await serializableTransaction(async (tx) => {
      const status = await validateVehicleWrite(
        tx,
        data.status,
        data.assignedFsrId,
      );
      const displayStatusId = await vehicleDisplayStatusId(
        tx,
        id,
        status.id,
        data.status,
      );
      return tx.vehicle.update({
        where: { id },
        data: {
          make: data.make,
          model: data.model,
          year: data.year,
          licensePlate: data.licensePlate,
          vin: data.vin || null,
          color: data.color || null,
          statusId: displayStatusId,
          operationalStatusCode: data.status,
          updatedById: user.id,
          assignedFsrId: data.assignedFsrId || null,
          notes: data.notes || null,
        },
      });
    });

    revalidatePath("/admin/vehicles");
    revalidatePath(`/admin/vehicles/${id}`);
    // No `/fsr/vehicles` route exists: the FSR vehicle surface is the trips
    // list, which embeds each trip's vehicle.
    revalidatePath("/fsr/vehicle-trips");
    return { data: vehicle };
  });
}

/**
 * Soft delete vehicle
 */
export async function deleteVehicle(id: string) {
  const user = await requirePermission("vehicles:delete");
  return guarded(async () => {
    await serializableTransaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id, active: true },
      });
      if (!vehicle) businessRule("Vehículo no encontrado o inactivo.");
      const activeTripCount = await tx.vehicleTrip.count({
        where: {
          vehicleId: id,
          status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
          active: true,
        },
      });

      if (activeTripCount > 0) {
        businessRule(
          `No se puede eliminar: ${activeTripCount} viaje(s) en curso usan este vehículo.`,
        );
      }

      await tx.vehicle.update({
        where: { id },
        data: {
          active: false,
          deactivatedAt: new Date(),
          deactivatedById: user.id,
          updatedById: user.id,
        },
      });
    });

    revalidatePath("/admin/vehicles");
    redirect("/admin/vehicles");
  });
}

/**
 * Update vehicle status
 */
export async function updateVehicleStatus(id: string, statusCode: string) {
  const user = await requirePermission("vehicles:update");
  return guarded(async () => {
    await serializableTransaction(async (tx) => {
      const status = await validateVehicleWrite(tx, statusCode);
      const statusId = await vehicleDisplayStatusId(
        tx,
        id,
        status.id,
        statusCode,
      );
      await tx.vehicle.update({
        where: { id },
        data: {
          statusId,
          operationalStatusCode: statusCode,
          updatedById: user.id,
        },
      });
    });

    revalidatePath("/admin/vehicles");
    revalidatePath(`/admin/vehicles/${id}`);
    revalidatePath("/fsr/vehicle-trips");
    return {};
  });
}

async function validateVehicleWrite(
  tx: Prisma.TransactionClient,
  statusCode: string,
  assignedFsrId?: string | null,
) {
  if (
    ![
      VEHICLE_STATUS.AVAILABLE,
      VEHICLE_STATUS.MAINTENANCE,
      VEHICLE_STATUS.INACTIVE,
    ].some((code) => code === statusCode)
  )
    businessRule(
      "Estado operacional inválido. En uso se determina por los viajes.",
    );
  const status = await tx.vehicleStatus.findUnique({
    where: { code: statusCode, active: true },
  });
  if (!status) businessRule("Estado de vehículo inválido o inactivo.");
  if (assignedFsrId) {
    const fsr = await tx.user.findFirst({
      where: { id: assignedFsrId, active: true, ...whereHasRole(ROLE.FSR) },
      select: { id: true },
    });
    if (!fsr) businessRule("El responsable debe ser un FSR activo.");
  }
  return status;
}

async function vehicleDisplayStatusId(
  tx: Prisma.TransactionClient,
  id: string,
  operationalStatusId: number,
  statusCode: string,
) {
  const vehicle = await tx.vehicle.findUnique({ where: { id, active: true } });
  if (!vehicle) businessRule("Vehículo no encontrado o inactivo.");
  const open = await tx.vehicleTrip.count({
    where: {
      vehicleId: id,
      active: true,
      status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
    },
  });
  if (!open) return operationalStatusId;
  if (statusCode === VEHICLE_STATUS.AVAILABLE)
    businessRule(
      "No se puede marcar disponible un vehículo con un viaje en curso.",
    );
  const occupied = await tx.vehicleStatus.findUnique({
    where: { code: VEHICLE_STATUS.IN_USE, active: true },
  });
  if (!occupied) throw new Error("Vehicle status IN_USE not found");
  return occupied.id;
}

/** Establish a new physical odometer epoch without rewriting trip evidence. */
export async function correctVehicleOdometer(
  vehicleId: string,
  reading: number,
  reason: string,
) {
  const user = await requirePermission("vehicles:update");
  await requirePermission("vehicle-trips:manage-all");
  return guarded(async () => {
    if (!Number.isInteger(reading) || reading < 0 || reading > 2147483647)
      businessRule("El odómetro debe ser un entero entre 0 y 2147483647.");
    const correctionReason = reason?.trim();
    if (!correctionReason)
      businessRule("El motivo de corrección es requerido.");
    const correction = await serializableTransaction(async (tx) => {
      const vehicle = await tx.vehicle.findUnique({
        where: { id: vehicleId, active: true },
      });
      if (!vehicle) businessRule("Vehículo no encontrado o inactivo.");
      const open = await tx.vehicleTrip.count({
        where: {
          vehicleId,
          active: true,
          status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
        },
      });
      if (open)
        businessRule("No se puede corregir el odómetro con un viaje en curso.");
      const baselineAt = new Date();
      await tx.vehicle.update({
        where: { id: vehicleId },
        data: {
          odometerBaseline: reading,
          odometerBaselineAt: baselineAt,
          updatedById: user.id,
        },
      });
      return tx.businessCorrection.create({
        data: {
          entityType: "Vehicle",
          entityId: vehicleId,
          actorId: user.id,
          reason: correctionReason,
          before: {
            odometerBaseline: vehicle.odometerBaseline,
            odometerBaselineAt:
              vehicle.odometerBaselineAt?.toISOString() ?? null,
          },
          after: {
            odometerBaseline: reading,
            odometerBaselineAt: baselineAt.toISOString(),
          },
        },
      });
    });
    revalidatePath("/admin/vehicles");
    revalidatePath(`/admin/vehicles/${vehicleId}`);
    revalidatePath("/fsr/vehicle-trips");
    return { data: correction };
  });
}

/**
 * Get all vehicle statuses
 */
export async function getVehicleStatuses() {
  await requirePermission("vehicles:read");

  return prisma.vehicleStatus.findMany({
    where: { active: true, code: { not: VEHICLE_STATUS.IN_USE } },
    orderBy: { id: "asc" },
  });
}

/**
 * Get FSR users for vehicle assignment dropdown
 */
export async function getFsrUsersForAssignment() {
  await requirePermission("vehicles:read");

  return prisma.user.findMany({
    where: {
      ...whereHasRole(ROLE.FSR),
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
