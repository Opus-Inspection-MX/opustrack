"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth, requirePermission } from "@/lib/auth/auth";
import { assignmentScopeWhere, getReportScope } from "@/lib/auth/report-scope";
import { userHasPermission } from "@/lib/authz/authz";
import {
  ASSIGNMENT_STATE,
  isVehicleTripOpen,
  VACATION_STATUS,
  VEHICLE_STATUS,
  VEHICLE_TRIP_STATUS,
} from "@/lib/constants/status-codes";
import { prisma } from "@/lib/database/prisma.singleton";
import { serializableTransaction } from "@/lib/database/serializable-transaction";
import {
  assertOfflineFreshness,
  findReplayTargetId,
  readOfflineFields,
} from "@/lib/offline/idempotency";
import {
  assertAllowedUpload,
  deleteFile,
  uploadFileFromBuffer,
} from "@/lib/storage/file-storage";
import { holidayRuleMatchesDate } from "@/lib/utils/availability";
import { mxDateString, mxDayRange } from "@/lib/utils/datetime";
import { businessRule, guarded } from "./result";

const OPEN_ASSIGNMENT_CODES = [
  ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
  ASSIGNMENT_STATE.ASIGNADO,
  ASSIGNMENT_STATE.VISTO,
  ASSIGNMENT_STATE.INICIADO,
  ASSIGNMENT_STATE.EN_PROGRESO,
];

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
  if (n === undefined || !Number.isInteger(n) || n < 0 || n > 2147483647) {
    businessRule(`${label} debe ser un entero entre 0 y 2147483647.`);
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

async function releaseVehicle(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  actorId: string,
) {
  const remaining = await tx.vehicleTrip.count({
    where: {
      vehicleId,
      active: true,
      status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
    },
  });
  if (remaining !== 0) return;
  const vehicle = await tx.vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
  });
  const status = await tx.vehicleStatus.findUnique({
    where: { code: vehicle.operationalStatusCode, active: true },
  });
  if (!status || status.code === VEHICLE_STATUS.IN_USE)
    throw new Error("Invalid vehicle operational status");
  await tx.vehicle.update({
    where: { id: vehicleId },
    data: { statusId: status.id, updatedById: actorId },
  });
}

/**
 * Get trips for current FSR by effective capture day in CDMX.
 */
export async function getMyVehicleTrips(range?: {
  startDate?: string;
  endDate?: string;
}) {
  const user = await requirePermission("vehicle-trips:read");

  const startedAtFilter: { gte?: Date; lte?: Date } = {};
  if (range?.startDate) {
    startedAtFilter.gte = mxDayRange(range.startDate).gte;
  }
  if (range?.endDate) {
    startedAtFilter.lte = mxDayRange(range.endDate).lte;
  }

  const trips = await prisma.vehicleTrip.findMany({
    where: {
      fsrId: user.id, // Only FSR's own trips
      active: true,
      ...(Object.keys(startedAtFilter).length > 0
        ? {
            OR: [
              { startCapturedAt: startedAtFilter },
              { startCapturedAt: null, startedAt: startedAtFilter },
            ],
          }
        : {}),
    },
    include: {
      vehicle: true,
      status: true,
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
    where: { id, active: true },
    include: {
      vehicle: true,
      status: true,
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
 *
 * Optional offline draft-and-retry fields (RF-261):
 *  - idempotencyKey: string — retried drafts converge instead of re-applying
 *  - capturedAt: string (ISO) — action-time evidence; >24h old is rejected
 */
export async function startVehicleTrip(formData: FormData) {
  const user = await requirePermission("vehicle-trips:create");

  return guarded(async () => {
    const vehicleId = getString(formData, "vehicleId");
    if (!vehicleId) businessRule("vehicleId requerido");
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

    // RF-261: offline draft-and-retry — before any write (photo upload
    // included). A known key converges on the live trip; guards below still
    // run unchanged for new keys.
    const offline = readOfflineFields(formData);
    const binding = {
      actorId: user.id,
      action: "startVehicleTrip",
      requestTargetId: vehicleId,
    };
    if (offline.capturedAt !== undefined) {
      assertOfflineFreshness(offline.capturedAt);
    }
    if (offline.idempotencyKey) {
      const targetId = await findReplayTargetId(
        prisma,
        offline.idempotencyKey,
        binding,
      );
      if (targetId) {
        const live = await prisma.vehicleTrip.findUnique({
          where: { id: targetId, active: true },
          include: { vehicle: true, assignment: true },
        });
        if (live) {
          if (
            live.fsrId !== user.id &&
            !userHasPermission(user, "vehicle-trips:manage-all")
          )
            businessRule("Solo puedes consultar tus propios viajes.");
          revalidatePath("/fsr/vehicle-trips");
          revalidatePath("/admin/vehicles");
          return { data: live };
        }
      }
    }

    assertAllowedUpload(photoMimetype, photo.size);

    const needsAvailable = !userHasPermission(user, "vehicle-trips:manage-all");
    const capturedAt = offline.capturedAt
      ? new Date(offline.capturedAt)
      : new Date();
    const startExceptionReason =
      getString(formData, "startExceptionReason") ?? null;
    const capturedDay = mxDateString(capturedAt);
    const receivedDay = mxDateString(new Date());

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const startPhotoResult = await uploadFileFromBuffer(
      photo.name,
      buffer,
      photoMimetype,
      { subfolder: "vehicle-trips" },
    );

    // Upload once outside the database-only retry loop; failed transactions
    // clean it up, while idempotency conflicts converge on the committed trip.
    let trip: Prisma.VehicleTripGetPayload<{
      include: { vehicle: true; assignment: true };
    }>;
    try {
      trip = await serializableTransaction(async (tx) => {
        const vehicle = await tx.vehicle.findUnique({
          where: { id: vehicleId, active: true },
        });
        if (!vehicle) businessRule("Vehículo no encontrado o inactivo.");
        if (
          needsAvailable &&
          vehicle.operationalStatusCode !== VEHICLE_STATUS.AVAILABLE
        ) {
          businessRule("El vehículo no está disponible.");
        }
        if (
          !needsAvailable &&
          vehicle.operationalStatusCode !== VEHICLE_STATUS.AVAILABLE &&
          !startExceptionReason
        )
          businessRule(
            "El inicio fuera de servicio requiere un motivo de excepción operacional.",
          );
        const openTrip = await tx.vehicleTrip.findFirst({
          where: {
            active: true,
            status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
            OR: [{ vehicleId }, { fsrId: user.id }],
          },
          select: { id: true },
        });
        if (openTrip)
          businessRule("El vehículo o conductor ya tiene un viaje en curso.");
        let lastReading = vehicle.odometerBaseline ?? 0;
        if (vehicle.odometerBaselineAt) {
          if (capturedAt < vehicle.odometerBaselineAt)
            businessRule(
              "La captura es anterior a la corrección del odómetro. Vuelve a capturar el inicio.",
            );
          const observations = await tx.vehicleTrip.findMany({
            where: { vehicleId },
            select: {
              startOdometer: true,
              endOdometer: true,
              startCapturedAt: true,
              endCapturedAt: true,
              startedAt: true,
              endedAt: true,
            },
          });
          for (const observation of observations) {
            if (
              (observation.startCapturedAt ?? observation.startedAt) >=
              vehicle.odometerBaselineAt
            )
              lastReading = Math.max(lastReading, observation.startOdometer);
            const endAt = observation.endCapturedAt ?? observation.endedAt;
            if (
              endAt &&
              endAt >= vehicle.odometerBaselineAt &&
              observation.endOdometer !== null
            )
              lastReading = Math.max(lastReading, observation.endOdometer);
          }
        } else {
          const readings = await tx.vehicleTrip.aggregate({
            where: { vehicleId },
            _max: { startOdometer: true, endOdometer: true },
          });
          lastReading = Math.max(
            lastReading,
            readings._max.startOdometer ?? 0,
            readings._max.endOdometer ?? 0,
          );
        }
        if (startOdometer < lastReading)
          businessRule(
            `El odómetro inicial no puede ser menor que la última lectura (${lastReading} km).`,
          );
        if (assignmentId) {
          const clientIds = userHasPermission(user, "scope:all-clients")
            ? null
            : (
                await tx.userClientAssignment.findMany({
                  where: { userId: user.id, active: true },
                  select: { clientId: true },
                })
              ).map((membership) => membership.clientId);
          const assignment = await tx.assignment.findFirst({
            where: {
              id: assignmentId,
              active: true,
              status: { code: { in: OPEN_ASSIGNMENT_CODES } },
              incident: {
                active: true,
                status: { code: { notIn: ["CERRADO", "CANCELADA"] } },
                ...(clientIds === null ? {} : { clientId: { in: clientIds } }),
              },
              ...(needsAvailable
                ? { assignees: { some: { userId: user.id, active: true } } }
                : {}),
            },
            select: { id: true },
          });
          if (!assignment)
            businessRule(
              "La asignación debe estar activa, abierta y dentro de tu alcance; debes estar asignado a ella.",
            );
        }
        // Check both the captured day and live day: late delivery grants no absence bypass.
        for (const day of new Set([capturedDay, receivedDay])) {
          const { gte, lte } = mxDayRange(day);
          const rules = await tx.holiday.findMany({
            where: { active: true, month: Number(day.slice(5, 7)) },
          });
          const vacation = await tx.vacation.findFirst({
            where: {
              userId: user.id,
              active: true,
              status: { code: VACATION_STATUS.APROBADA },
              startDate: { lte },
              endDate: { gte },
            },
            select: { id: true },
          });
          if (
            vacation ||
            rules.some((rule) => holidayRuleMatchesDate(rule, day))
          ) {
            if (needsAvailable || !startExceptionReason)
              businessRule(
                "No se puede iniciar un viaje en vacaciones o día festivo sin autorización y motivo explícito.",
              );
          }
        }
        const inUseStatus = await tx.vehicleStatus.findUnique({
          where: { code: VEHICLE_STATUS.IN_USE, active: true },
        });
        const inProgressStatus = await tx.vehicleTripStatus.findUnique({
          where: { code: VEHICLE_TRIP_STATUS.EN_CURSO, active: true },
        });
        if (!inUseStatus || !inProgressStatus)
          throw new Error("Vehicle/trip status catalog incomplete");
        const claimed = await tx.vehicle.updateMany({
          where: {
            id: vehicleId,
            active: true,
            operationalStatusCode: vehicle.operationalStatusCode,
          },
          data: { statusId: inUseStatus.id, updatedById: user.id },
        });
        if (claimed.count !== 1)
          businessRule("El vehículo no está disponible.");

        const created = await tx.vehicleTrip.create({
          data: {
            vehicleId,
            fsrId: user.id,
            assignmentId,
            startOdometer,
            startCapturedAt: capturedAt,
            startExceptionReason,
            createdById: user.id,
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

        if (offline.idempotencyKey) {
          await tx.actionIdempotency.create({
            data: {
              key: offline.idempotencyKey,
              action: "startVehicleTrip",
              targetId: created.id,
              actorId: user.id,
              requestTargetId: vehicleId,
            },
          });
        }
        return created;
      });
    } catch (error) {
      await deleteFile(
        startPhotoResult.url,
        startPhotoResult.provider as "vercel-blob" | "filesystem",
      ).catch(() => {});
      // Converge on the winner's live trip whenever our key already has one:
      // P2002 (both runners inserted the key) or vehicle-claim loss (the
      // winner's commit moved the vehicle AND the key row atomically, so a
      // count of 0 means the target exists). Without a replay target the
      // original error propagates unchanged.
      if (offline.idempotencyKey) {
        const targetId = await findReplayTargetId(
          prisma,
          offline.idempotencyKey,
          binding,
        );
        if (targetId) {
          const live = await prisma.vehicleTrip.findUnique({
            where: { id: targetId, active: true },
            include: { vehicle: true, assignment: true },
          });
          if (live) {
            if (
              live.fsrId !== user.id &&
              !userHasPermission(user, "vehicle-trips:manage-all")
            )
              businessRule("Solo puedes consultar tus propios viajes.");
            revalidatePath("/fsr/vehicle-trips");
            revalidatePath("/admin/vehicles");
            return { data: live };
          }
        }
      }
      throw error;
    }

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
 *
 * Optional offline draft-and-retry fields (RF-261): same as startVehicleTrip.
 */
export async function endVehicleTrip(formData: FormData) {
  const user = await requirePermission("vehicle-trips:update");

  return guarded(async () => {
    const id = getString(formData, "tripId");
    if (!id) businessRule("tripId requerido");
    const endOdometer = requireInt(formData, "endOdometer", "endOdometer");
    const photo = requireFile(formData, "photo", "Foto del odómetro");
    const photoMimetype =
      getString(formData, "photoMimetype") ||
      photo.type ||
      "application/octet-stream";

    // RF-261: offline draft-and-retry — before any write, same as trip start.
    const offline = readOfflineFields(formData);
    const binding = {
      actorId: user.id,
      action: "endVehicleTrip",
      requestTargetId: id,
    };
    if (offline.capturedAt !== undefined) {
      assertOfflineFreshness(offline.capturedAt);
    }
    if (offline.idempotencyKey) {
      const targetId = await findReplayTargetId(
        prisma,
        offline.idempotencyKey,
        binding,
      );
      if (targetId) {
        const live = await prisma.vehicleTrip.findUnique({
          where: { id: targetId, active: true },
          include: { vehicle: true, assignment: true },
        });
        if (live) {
          if (
            live.fsrId !== user.id &&
            !userHasPermission(user, "vehicle-trips:manage-all")
          )
            businessRule("Solo puedes consultar tus propios viajes.");
          revalidatePath("/fsr/vehicle-trips");
          revalidatePath(`/fsr/vehicle-trips/${targetId}`);
          revalidatePath("/admin/vehicles");
          return { data: live };
        }
      }
    }

    assertAllowedUpload(photoMimetype, photo.size);

    const trip = await prisma.vehicleTrip.findUnique({
      where: { id, active: true },
      select: {
        fsrId: true,
        vehicleId: true,
        startOdometer: true,
        status: { select: { code: true, name: true } },
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

    if (!isVehicleTripOpen(trip.status)) {
      businessRule("El viaje ya está finalizado o cancelado.");
    }

    if (endOdometer < trip.startOdometer) {
      businessRule("El odómetro final no puede ser menor que el inicial.");
    }

    const arrayBuffer = await photo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const endPhotoResult = await uploadFileFromBuffer(
      photo.name,
      buffer,
      photoMimetype,
      { subfolder: "vehicle-trips" },
    );

    // Fase 5b: same claim-first contract as the start path — the upload
    // cannot run inside the transaction, so failures delete it and a P2002
    // converges on the winner's live trip.
    let updatedTrip: Prisma.VehicleTripGetPayload<{
      include: { vehicle: true; assignment: true };
    }>;
    try {
      updatedTrip = await serializableTransaction(async (tx) => {
        const live = await tx.vehicleTrip.findUnique({
          where: { id, active: true },
          include: { status: true },
        });
        if (!live || !isVehicleTripOpen(live.status))
          businessRule("El viaje ya está finalizado, cancelado o inactivo.");
        if (
          !userHasPermission(user, "vehicle-trips:manage-all") &&
          live.fsrId !== user.id
        )
          businessRule("Solo puedes finalizar tus propios viajes.");
        if (endOdometer < live.startOdometer)
          businessRule("El odómetro final no puede ser menor que el inicial.");
        const endedAt = new Date();
        const endCapturedAt = offline.capturedAt
          ? new Date(offline.capturedAt)
          : endedAt;
        if (endCapturedAt < (live.startCapturedAt ?? live.startedAt))
          businessRule(
            "La captura final no puede ser anterior al inicio del viaje.",
          );
        if (endedAt < live.startedAt)
          businessRule(
            "La fecha de recepción final no puede ser anterior al inicio del viaje.",
          );
        const completedStatus = await tx.vehicleTripStatus.findUnique({
          where: { code: VEHICLE_TRIP_STATUS.COMPLETADO, active: true },
        });
        if (!completedStatus)
          throw new Error("Trip status COMPLETADO not found");
        const won = await tx.vehicleTrip.updateMany({
          where: {
            id,
            active: true,
            status: { code: VEHICLE_TRIP_STATUS.EN_CURSO },
          },
          data: {
            endOdometer,
            endPhotoUrl: endPhotoResult.url,
            endPhotoProvider: endPhotoResult.provider,
            endLatitude: getNumber(formData, "endLatitude") ?? null,
            endLongitude: getNumber(formData, "endLongitude") ?? null,
            endAddress: getString(formData, "endAddress") ?? null,
            endedAt,
            endCapturedAt,
            kmDriven: endOdometer - live.startOdometer,
            updatedById: user.id,
            statusId: completedStatus.id,
            notes: getString(formData, "notes") ?? live.notes,
          },
        });
        if (won.count !== 1)
          businessRule("El viaje ya está finalizado o cancelado.");
        await releaseVehicle(tx, live.vehicleId, user.id);
        const updated = await tx.vehicleTrip.findUniqueOrThrow({
          where: { id },
          include: { vehicle: true, assignment: true },
        });

        if (offline.idempotencyKey) {
          await tx.actionIdempotency.create({
            data: {
              key: offline.idempotencyKey,
              action: "endVehicleTrip",
              targetId: updated.id,
              actorId: user.id,
              requestTargetId: id,
            },
          });
        }
        return updated;
      });
    } catch (error) {
      await deleteFile(
        endPhotoResult.url,
        endPhotoResult.provider as "vercel-blob" | "filesystem",
      ).catch(() => {});
      // Same convergence as trip start: a replay target for our key means a
      // concurrent run already applied this operation — return its live row
      // instead of surfacing the loser's error.
      if (offline.idempotencyKey) {
        const targetId = await findReplayTargetId(
          prisma,
          offline.idempotencyKey,
          binding,
        );
        if (targetId) {
          const live = await prisma.vehicleTrip.findUnique({
            where: { id: targetId, active: true },
            include: { vehicle: true, assignment: true },
          });
          if (live) {
            if (
              live.fsrId !== user.id &&
              !userHasPermission(user, "vehicle-trips:manage-all")
            )
              businessRule("Solo puedes consultar tus propios viajes.");
            revalidatePath("/fsr/vehicle-trips");
            revalidatePath(`/fsr/vehicle-trips/${targetId}`);
            revalidatePath("/admin/vehicles");
            return { data: live };
          }
        }
      }
      throw error;
    }

    revalidatePath("/fsr/vehicle-trips");
    revalidatePath(`/fsr/vehicle-trips/${id}`);
    revalidatePath("/admin/vehicles");
    return { data: updatedTrip };
  });
}

/**
 * Get available vehicles (status = AVAILABLE)
 */
export async function getAvailableVehicles(options?: {
  includeOperationalExceptions?: boolean;
}) {
  const user = await requirePermission("vehicles:read");
  const includeExceptions =
    options?.includeOperationalExceptions &&
    userHasPermission(user, "vehicle-trips:manage-all");

  const vehicles = await prisma.vehicle.findMany({
    where: {
      active: true,
      ...(includeExceptions
        ? {}
        : { operationalStatusCode: VEHICLE_STATUS.AVAILABLE }),
      trips: {
        none: { active: true, status: { code: VEHICLE_TRIP_STATUS.EN_CURSO } },
      },
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
  const scope = await getReportScope(user);

  const assignments = await prisma.assignment.findMany({
    where: {
      assignees: {
        some: { userId: user.id, active: true },
      },
      active: true,
      ...assignmentScopeWhere(scope),
      status: {
        code: {
          in: OPEN_ASSIGNMENT_CODES,
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
      where: { id, active: true },
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
 * Cancel an open trip without discarding any captured evidence.
 */
async function cancelTripInTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  actorId: string,
  reason: string,
) {
  const cancelled = await tx.vehicleTripStatus.findUnique({
    where: { code: VEHICLE_TRIP_STATUS.CANCELADO, active: true },
  });
  if (!cancelled) throw new Error("Trip status CANCELADO not found");
  const won = await tx.vehicleTrip.updateMany({
    where: { id, active: true, status: { code: VEHICLE_TRIP_STATUS.EN_CURSO } },
    data: {
      statusId: cancelled.id,
      cancellationReason: reason,
      cancelledAt: new Date(),
      updatedById: actorId,
    },
  });
  if (won.count !== 1) businessRule("El viaje ya está finalizado o cancelado.");
  const trip = await tx.vehicleTrip.findUniqueOrThrow({ where: { id } });
  await releaseVehicle(tx, trip.vehicleId, actorId);
  return trip;
}

export async function cancelVehicleTrip(id: string, reason: string) {
  const user = await requirePermission("vehicle-trips:update");
  return guarded(async () => {
    if (!reason?.trim()) businessRule("El motivo de cancelación es requerido.");
    const trip = await serializableTransaction(async (tx) => {
      const live = await tx.vehicleTrip.findUnique({
        where: { id, active: true },
      });
      if (!live) businessRule("Viaje no encontrado o inactivo.");
      if (
        !userHasPermission(user, "vehicle-trips:manage-all") &&
        live.fsrId !== user.id
      )
        businessRule("Solo puedes cancelar tus propios viajes.");
      return cancelTripInTransaction(tx, id, user.id, reason.trim());
    });
    revalidatePath("/fsr/vehicle-trips");
    revalidatePath(`/fsr/vehicle-trips/${id}`);
    revalidatePath("/admin/vehicles");
    return { data: trip };
  });
}

/** Soft deletion retains evidence; deleting an open trip requires cancellation. */
export async function deleteVehicleTrip(id: string, reason?: string) {
  const user = await requirePermission("vehicle-trips:delete");
  return guarded(async () => {
    await serializableTransaction(async (tx) => {
      const trip = await tx.vehicleTrip.findUnique({
        where: { id, active: true },
        include: { status: true },
      });
      if (!trip) businessRule("Viaje no encontrado o inactivo.");
      if (
        !userHasPermission(user, "vehicle-trips:manage-all") &&
        trip.fsrId !== user.id
      )
        businessRule("Solo puedes eliminar tus propios viajes.");
      if (isVehicleTripOpen(trip.status)) {
        if (!reason?.trim())
          businessRule(
            "El motivo de cancelación es requerido para eliminar un viaje en curso.",
          );
        await cancelTripInTransaction(tx, id, user.id, reason.trim());
      }
      await tx.vehicleTrip.update({
        where: { id },
        data: {
          active: false,
          updatedById: user.id,
          deactivatedAt: new Date(),
          deactivatedById: user.id,
        },
      });
    });
    revalidatePath("/fsr/vehicle-trips");
    revalidatePath("/admin/vehicles");
    redirect("/fsr/vehicle-trips");
  });
}
