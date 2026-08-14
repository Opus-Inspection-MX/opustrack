"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requirePermission } from "@/lib/auth/auth";
import { userHasPermission } from "@/lib/authz/authz";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  assertAllowedUpload,
  deleteFile,
  uploadFileFromBuffer,
} from "@/lib/storage/file-storage";
import { businessRule, guarded } from "./result";

function getString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== "string") return undefined;
  const trimmed = v.trim();
  return trimmed === "" ? undefined : trimmed;
}

function getNumber(formData: FormData, key: string): number | undefined {
  const v = getString(formData, key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function requireInt(formData: FormData, key: string, label: string): number {
  const n = getNumber(formData, key);
  if (n === undefined || !Number.isInteger(n)) {
    businessRule(`${label} es requerido`);
  }
  return n;
}

function requireFile(formData: FormData, key: string, label: string): File {
  const f = formData.get(key);
  if (!(f instanceof File) || f.size === 0) {
    businessRule(`${label} es requerida`);
  }
  return f;
}

/**
 * Get trips for current FSR. Optional date range filters by startedAt.
 */
export async function getMyVehicleTrips(range?: {
  startDate?: string;
  endDate?: string;
}) {
  const user = await requirePermission("vehicle-trips:read");

  const startedAtFilter: { gte?: Date; lte?: Date } = {};
  if (range?.startDate) {
    startedAtFilter.gte = new Date(`${range.startDate}T00:00:00`);
  }
  if (range?.endDate) {
    startedAtFilter.lte = new Date(`${range.endDate}T23:59:59.999`);
  }

  const trips = await prisma.vehicleTrip.findMany({
    where: {
      fsrId: user.id, // Only FSR's own trips
      active: true,
      ...(Object.keys(startedAtFilter).length > 0
        ? { startedAt: startedAtFilter }
        : {}),
    },
    include: {
      vehicle: true,
      assignment: {
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
  if (!userHasPermission(user, "vehicle-trips:manage-all")) {
    throw new Error("Only administrators can view all trips");
  }

  const trips = await prisma.vehicleTrip.findMany({
    where: { active: true },
    include: {
      vehicle: true,
      fsr: {
        select: { id: true, name: true, email: true },
      },
      assignment: {
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
      assignment: {
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
  if (
    !userHasPermission(user, "vehicle-trips:manage-all") &&
    trip.fsrId !== user.id
  ) {
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
 * Start a trip (multipart FormData).
 *
 * Expected FormData fields:
 *  - vehicleId: string (required)
 *  - assignmentId: string (optional)
 *  - startOdometer: integer (required)
 *  - photo: File (required) — odometer photo
 *  - photoMimetype: string (optional; client-normalized override)
 *  - startLatitude / startLongitude / startAddress / notes (optional)
 */
export async function startVehicleTrip(formData: FormData) {
  const user = await requirePermission("vehicle-trips:create");

  return guarded(async () => {
    const vehicleId = getString(formData, "vehicleId");
    if (!vehicleId) throw new Error("vehicleId requerido");
    const assignmentId = getString(formData, "assignmentId") ?? null;
    const startOdometer = requireInt(
      formData,
      "startOdometer",
      "startOdometer",
    );
    const photo = requireFile(formData, "photo", "Foto del odómetro");
    const photoMimetype =
      getString(formData, "photoMimetype") ||
      photo.type ||
      "application/octet-stream";

    assertAllowedUpload(photoMimetype, photo.size);

    // Validate vehicle exists and is selectable. If the user is not admin, the
    // vehicle must be currently AVAILABLE (the same constraint exposed by
    // getAvailableVehicles).
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { id: true, status: { select: { name: true } } },
    });
    if (!vehicle) throw new Error("Vehículo no encontrado");
    if (
      !userHasPermission(user, "vehicle-trips:manage-all") &&
      vehicle.status?.name !== "AVAILABLE"
    ) {
      businessRule("El vehículo no está disponible.");
    }

    // If linked to an assignment, ensure the caller is actually an assignee
    // (an FSR shouldn't be able to start a trip against someone else's work).
    if (assignmentId && !userHasPermission(user, "vehicle-trips:manage-all")) {
      const isAssignee = await prisma.assignmentAssignee.findFirst({
        where: { assignmentId, userId: user.id, active: true },
        select: { id: true },
      });
      if (!isAssignee) {
        businessRule("No estás asignado a esta asignación.");
      }
    }

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const startPhotoResult = await uploadFileFromBuffer(
      photo.name,
      buffer,
      photoMimetype,
      { subfolder: "vehicle-trips" },
    );

    const inUseStatus = await prisma.vehicleStatus.findUnique({
      where: { name: "IN_USE" },
    });
    if (!inUseStatus) throw new Error("Vehicle status IN_USE not found");

    const inProgressStatus = await prisma.vehicleTripStatus.findUnique({
      where: { name: "IN_PROGRESS" },
    });
    if (!inProgressStatus) throw new Error("Trip status IN_PROGRESS not found");

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: { statusId: inUseStatus.id },
    });

    const trip = await prisma.vehicleTrip.create({
      data: {
        vehicleId,
        fsrId: user.id,
        assignmentId,
        startOdometer,
        startPhotoUrl: startPhotoResult.url,
        startPhotoProvider: startPhotoResult.provider,
        startLatitude: getNumber(formData, "startLatitude") ?? null,
        startLongitude: getNumber(formData, "startLongitude") ?? null,
        startAddress: getString(formData, "startAddress") ?? null,
        notes: getString(formData, "notes") ?? null,
        statusId: inProgressStatus.id,
      },
      include: {
        vehicle: true,
        assignment: true,
      },
    });

    revalidatePath("/fsr/vehicle-trips");
    revalidatePath("/admin/vehicles");
    return { data: trip };
  });
}

/**
 * End a trip (multipart FormData).
 *
 * Expected FormData fields:
 *  - tripId: string (required) — the trip to end
 *  - endOdometer: integer (required)
 *  - photo: File (required) — odometer photo
 *  - photoMimetype: string (optional)
 *  - endLatitude / endLongitude / endAddress / notes (optional)
 */
export async function endVehicleTrip(formData: FormData) {
  const user = await requirePermission("vehicle-trips:update");

  return guarded(async () => {
    const id = getString(formData, "tripId");
    if (!id) throw new Error("tripId requerido");
    const endOdometer = requireInt(formData, "endOdometer", "endOdometer");
    const photo = requireFile(formData, "photo", "Foto del odómetro");
    const photoMimetype =
      getString(formData, "photoMimetype") ||
      photo.type ||
      "application/octet-stream";

    assertAllowedUpload(photoMimetype, photo.size);

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
    if (
      !userHasPermission(user, "vehicle-trips:manage-all") &&
      trip.fsrId !== user.id
    ) {
      businessRule("Solo puedes finalizar tus propios viajes.");
    }

    if (trip.status?.name !== "IN_PROGRESS") {
      businessRule("El viaje ya está finalizado o cancelado.");
    }

    if (endOdometer < trip.startOdometer) {
      businessRule("El odómetro final no puede ser menor que el inicial.");
    }

    const completedStatus = await prisma.vehicleTripStatus.findUnique({
      where: { name: "COMPLETED" },
    });
    if (!completedStatus) throw new Error("Trip status COMPLETED not found");

    const availableStatus = await prisma.vehicleStatus.findUnique({
      where: { name: "AVAILABLE" },
    });
    if (!availableStatus) throw new Error("Vehicle status AVAILABLE not found");

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const endPhotoResult = await uploadFileFromBuffer(
      photo.name,
      buffer,
      photoMimetype,
      { subfolder: "vehicle-trips" },
    );

    const kmDriven = endOdometer - trip.startOdometer;

    const updatedTrip = await prisma.vehicleTrip.update({
      where: { id },
      data: {
        endOdometer,
        endPhotoUrl: endPhotoResult.url,
        endPhotoProvider: endPhotoResult.provider,
        endLatitude: getNumber(formData, "endLatitude") ?? null,
        endLongitude: getNumber(formData, "endLongitude") ?? null,
        endAddress: getString(formData, "endAddress") ?? null,
        endedAt: new Date(),
        kmDriven,
        statusId: completedStatus.id,
        notes: getString(formData, "notes") ?? null,
      },
      include: {
        vehicle: true,
        assignment: true,
      },
    });

    await prisma.vehicle.update({
      where: { id: trip.vehicleId },
      data: { statusId: availableStatus.id },
    });

    revalidatePath("/fsr/vehicle-trips");
    revalidatePath(`/fsr/vehicle-trips/${id}`);
    revalidatePath("/admin/vehicles");
    return { data: updatedTrip };
  });
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
 * Get my active assignments (for trip linking)
 */
export async function getMyAssignmentsForTrips() {
  const user = await requireAuth();

  const assignments = await prisma.assignment.findMany({
    where: {
      assignees: {
        some: { userId: user.id, active: true },
      },
      active: true,
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
    take: 20,
  });

  return assignments.map((a) => ({
    id: a.id,
    folio: a.folio,
    incident: a.incident,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    startedAt: a.startedAt?.toISOString() || null,
    finishedAt: a.finishedAt?.toISOString() || null,
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

  return guarded(async () => {
    const trip = await prisma.vehicleTrip.findUnique({
      where: { id },
      select: { fsrId: true },
    });

    if (!trip) {
      throw new Error("Trip not found");
    }

    // FSR can only update their own trips
    if (
      !userHasPermission(user, "vehicle-trips:manage-all") &&
      trip.fsrId !== user.id
    ) {
      businessRule("Solo puedes actualizar tus propios viajes.");
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
    return { data: updatedTrip };
  });
}

/**
 * Delete trip (soft delete)
 */
export async function deleteVehicleTrip(id: string) {
  const user = await requirePermission("vehicle-trips:delete");

  return guarded(async () => {
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
    if (
      !userHasPermission(user, "vehicle-trips:manage-all") &&
      trip.fsrId !== user.id
    ) {
      businessRule("Solo puedes eliminar tus propios viajes.");
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
  });
}
