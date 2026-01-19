"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requirePermission } from "@/lib/auth/auth";
import { prisma } from "@/lib/database/prisma.singleton";
import { deleteFile, uploadFile } from "@/lib/storage/file-storage";

export type TripStartData = {
  vehicleId: string;
  workOrderId?: string | null;
  startOdometer: number;
  startPhotoFilename: string;
  startPhotoBase64: string;
  startPhotoMimetype: string;
  startLatitude?: number;
  startLongitude?: number;
  startAddress?: string;
  notes?: string;
};

export type TripEndData = {
  endOdometer: number;
  endPhotoFilename: string;
  endPhotoBase64: string;
  endPhotoMimetype: string;
  endLatitude?: number;
  endLongitude?: number;
  endAddress?: string;
  notes?: string;
};

/**
 * Get trips for current FSR
 */
export async function getMyVehicleTrips() {
  const user = await requirePermission("vehicle-trips:read");

  const trips = await prisma.vehicleTrip.findMany({
    where: {
      fsrId: user.id, // Only FSR's own trips
      active: true,
    },
    include: {
      vehicle: true,
      workOrder: {
        select: {
          id: true,
          folio: true,
          incident: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Serialize dates
  return trips.map((trip) => ({
    ...trip,
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString() || null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  }));
}

/**
 * Get all vehicle trips (admin only)
 */
export async function getAllVehicleTrips() {
  const user = await requirePermission("vehicle-trips:read");

  // Only admin can see all trips
  if (user.role.name !== "ADMINISTRADOR") {
    throw new Error("Only administrators can view all trips");
  }

  const trips = await prisma.vehicleTrip.findMany({
    where: { active: true },
    include: {
      vehicle: true,
      fsr: {
        select: { id: true, name: true, email: true },
      },
      workOrder: {
        select: {
          id: true,
          folio: true,
          incident: {
            select: { id: true, title: true },
          },
        },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Serialize dates
  return trips.map((trip) => ({
    ...trip,
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString() || null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  }));
}

/**
 * Get single trip (with access check)
 */
export async function getVehicleTripById(id: string) {
  const user = await requirePermission("vehicle-trips:read");

  const trip = await prisma.vehicleTrip.findUnique({
    where: { id },
    include: {
      vehicle: true,
      fsr: {
        select: { id: true, name: true, email: true },
      },
      workOrder: {
        select: {
          id: true,
          folio: true,
          incident: {
            select: { id: true, title: true },
          },
        },
      },
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // FSR can only access their own trips (unless admin)
  if (user.role.name !== "ADMINISTRADOR" && trip.fsrId !== user.id) {
    throw new Error("Access denied: You can only view your own trips");
  }

  // Serialize dates
  return {
    ...trip,
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString() || null,
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
    vehicle: {
      ...trip.vehicle,
      createdAt: trip.vehicle.createdAt.toISOString(),
      updatedAt: trip.vehicle.updatedAt.toISOString(),
    },
  };
}

/**
 * Start a trip
 */
export async function startVehicleTrip(data: TripStartData) {
  const user = await requirePermission("vehicle-trips:create");

  // Upload start photo
  const startPhotoResult = await uploadFile(
    data.startPhotoFilename,
    data.startPhotoBase64,
    data.startPhotoMimetype,
    { subfolder: "vehicle-trips" },
  );

  // Get the vehicle status for IN_USE
  const inUseStatus = await prisma.vehicleStatus.findUnique({
    where: { name: "IN_USE" },
  });
  if (!inUseStatus) throw new Error("Vehicle status IN_USE not found");

  // Get the trip status for IN_PROGRESS
  const inProgressStatus = await prisma.vehicleTripStatus.findUnique({
    where: { name: "IN_PROGRESS" },
  });
  if (!inProgressStatus) throw new Error("Trip status IN_PROGRESS not found");

  // Update vehicle status to IN_USE
  await prisma.vehicle.update({
    where: { id: data.vehicleId },
    data: { statusId: inUseStatus.id },
  });

  const trip = await prisma.vehicleTrip.create({
    data: {
      vehicleId: data.vehicleId,
      fsrId: user.id,
      workOrderId: data.workOrderId || null,
      startOdometer: data.startOdometer,
      startPhotoUrl: startPhotoResult.url,
      startPhotoProvider: startPhotoResult.provider,
      startLatitude: data.startLatitude || null,
      startLongitude: data.startLongitude || null,
      startAddress: data.startAddress || null,
      notes: data.notes || null,
      statusId: inProgressStatus.id,
    },
    include: {
      vehicle: true,
      workOrder: true,
    },
  });

  revalidatePath("/fsr/vehicle-trips");
  revalidatePath("/admin/vehicles");
  return { success: true, data: trip };
}

/**
 * End a trip
 */
export async function endVehicleTrip(id: string, data: TripEndData) {
  const user = await requirePermission("vehicle-trips:update");

  const trip = await prisma.vehicleTrip.findUnique({
    where: { id },
    select: {
      fsrId: true,
      vehicleId: true,
      startOdometer: true,
      status: { select: { name: true } },
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // FSR can only end their own trips
  if (user.role.name !== "ADMINISTRADOR" && trip.fsrId !== user.id) {
    throw new Error("Access denied: You can only end your own trips");
  }

  if (trip.status?.name !== "IN_PROGRESS") {
    throw new Error("Trip is already completed or cancelled");
  }

  // Validate odometer reading
  if (data.endOdometer < trip.startOdometer) {
    throw new Error("End odometer reading cannot be less than start reading");
  }

  // Get the statuses we need
  const completedStatus = await prisma.vehicleTripStatus.findUnique({
    where: { name: "COMPLETED" },
  });
  if (!completedStatus) throw new Error("Trip status COMPLETED not found");

  const availableStatus = await prisma.vehicleStatus.findUnique({
    where: { name: "AVAILABLE" },
  });
  if (!availableStatus) throw new Error("Vehicle status AVAILABLE not found");

  // Upload end photo
  const endPhotoResult = await uploadFile(
    data.endPhotoFilename,
    data.endPhotoBase64,
    data.endPhotoMimetype,
    { subfolder: "vehicle-trips" },
  );

  // Calculate kilometers driven
  const kmDriven = data.endOdometer - trip.startOdometer;

  const updatedTrip = await prisma.vehicleTrip.update({
    where: { id },
    data: {
      endOdometer: data.endOdometer,
      endPhotoUrl: endPhotoResult.url,
      endPhotoProvider: endPhotoResult.provider,
      endLatitude: data.endLatitude || null,
      endLongitude: data.endLongitude || null,
      endAddress: data.endAddress || null,
      endedAt: new Date(),
      kmDriven,
      statusId: completedStatus.id,
      notes: data.notes,
    },
    include: {
      vehicle: true,
      workOrder: true,
    },
  });

  // Update vehicle status back to AVAILABLE
  await prisma.vehicle.update({
    where: { id: trip.vehicleId },
    data: { statusId: availableStatus.id },
  });

  revalidatePath("/fsr/vehicle-trips");
  revalidatePath(`/fsr/vehicle-trips/${id}`);
  revalidatePath("/admin/vehicles");
  return { success: true, data: updatedTrip };
}

/**
 * Get available vehicles (status = AVAILABLE)
 */
export async function getAvailableVehicles() {
  await requirePermission("vehicles:read");

  const vehicles = await prisma.vehicle.findMany({
    where: {
      active: true,
      status: { name: "AVAILABLE" },
    },
    orderBy: { licensePlate: "asc" },
  });

  return vehicles;
}

/**
 * Get my assigned work orders (for trip linking)
 */
export async function getMyWorkOrdersForTrips() {
  const user = await requireAuth();

  const workOrders = await prisma.workOrder.findMany({
    where: {
      assignedToId: user.id,
      active: true,
      // Filter out completed/cancelled work orders using status relation
      status: {
        name: {
          notIn: ["COMPLETED", "CANCELLED", "COMPLETADA", "CANCELADA"],
        },
      },
    },
    include: {
      incident: {
        select: { id: true, title: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20, // Recent 20 active work orders
  });

  // Serialize dates
  return workOrders.map((wo) => ({
    id: wo.id,
    folio: wo.folio,
    incident: wo.incident,
    createdAt: wo.createdAt.toISOString(),
    updatedAt: wo.updatedAt.toISOString(),
    startedAt: wo.startedAt?.toISOString() || null,
    finishedAt: wo.finishedAt?.toISOString() || null,
  }));
}

/**
 * Update trip notes and addresses
 */
export async function updateVehicleTrip(
  id: string,
  data: {
    notes?: string;
    startAddress?: string;
    endAddress?: string;
  },
) {
  const user = await requirePermission("vehicle-trips:update");

  const trip = await prisma.vehicleTrip.findUnique({
    where: { id },
    select: { fsrId: true },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // FSR can only update their own trips
  if (user.role.name !== "ADMINISTRADOR" && trip.fsrId !== user.id) {
    throw new Error("Access denied: You can only update your own trips");
  }

  const updatedTrip = await prisma.vehicleTrip.update({
    where: { id },
    data: {
      notes: data.notes,
      startAddress: data.startAddress,
      endAddress: data.endAddress,
    },
  });

  revalidatePath("/fsr/vehicle-trips");
  revalidatePath(`/fsr/vehicle-trips/${id}`);
  return { success: true, data: updatedTrip };
}

/**
 * Delete trip (soft delete)
 */
export async function deleteVehicleTrip(id: string) {
  const user = await requirePermission("vehicle-trips:delete");

  const trip = await prisma.vehicleTrip.findUnique({
    where: { id },
    select: {
      fsrId: true,
      status: { select: { name: true } },
      startPhotoUrl: true,
      startPhotoProvider: true,
      endPhotoUrl: true,
      endPhotoProvider: true,
      vehicleId: true,
    },
  });

  if (!trip) {
    throw new Error("Trip not found");
  }

  // FSR can only delete their own trips
  if (user.role.name !== "ADMINISTRADOR" && trip.fsrId !== user.id) {
    throw new Error("Access denied: You can only delete your own trips");
  }

  // Soft delete
  await prisma.vehicleTrip.update({
    where: { id },
    data: { active: false },
  });

  // Delete photos from storage
  try {
    await deleteFile(
      trip.startPhotoUrl,
      trip.startPhotoProvider as "vercel-blob" | "filesystem",
    );
    if (trip.endPhotoUrl && trip.endPhotoProvider) {
      await deleteFile(
        trip.endPhotoUrl,
        trip.endPhotoProvider as "vercel-blob" | "filesystem",
      );
    }
  } catch (error) {
    console.error("Error deleting trip photos:", error);
    // Continue even if photo deletion fails
  }

  // If trip was IN_PROGRESS, set vehicle back to AVAILABLE
  if (trip.status?.name === "IN_PROGRESS") {
    const availableStatus = await prisma.vehicleStatus.findUnique({
      where: { name: "AVAILABLE" },
    });
    if (availableStatus) {
      await prisma.vehicle.update({
        where: { id: trip.vehicleId },
        data: { statusId: availableStatus.id },
      });
    }
  }

  revalidatePath("/fsr/vehicle-trips");
  redirect("/fsr/vehicle-trips");
}
