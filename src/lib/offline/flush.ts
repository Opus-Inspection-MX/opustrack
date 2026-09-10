import {
  closeAssignment,
  startAssignmentWork,
} from "@/lib/actions/assignments";
import { type ActionResult, isFailure } from "@/lib/actions/result";
import { endVehicleTrip, startVehicleTrip } from "@/lib/actions/vehicle-trips";
import {
  type EnqueueResult,
  enqueueEntry,
  newOutboxKey,
  type OfflineActionKind,
  type OutboxEntry,
  stagePhoto,
  takeStagedPhoto,
} from "./outbox";

/**
 * Flush: re-send a frozen draft through the UNCHANGED server action
 * (RF-260, RF-261).
 *
 * GPS + `capturedAt` travel as data captured at field time — the device
 * NEVER re-captures location at flush time. Business-rule failures keep the
 * entry (the operator resolves them manually, like any online failure); only
 * a successful flush removes it.
 */

/** Trip kinds cannot flush without their odometer photo blob. */
export function entryRequiresPhoto(kind: OfflineActionKind): boolean {
  return kind === "startVehicleTrip" || kind === "endVehicleTrip";
}

export function entryToFormData(entry: OutboxEntry, photo?: File): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entry.fields)) {
    fd.append(key, value);
  }
  fd.append("idempotencyKey", entry.key);
  fd.append("capturedAt", entry.capturedAt);
  if (photo) fd.append("photo", photo);
  return fd;
}

export type FlushResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

/**
 * Flush one draft. A missing required photo blob (page reloaded since
 * capture) fails WITHOUT touching the server or burning an attempt — the
 * operator re-attaches the photo and retries.
 */
export async function flushEntry(
  entry: OutboxEntry,
  photo?: File,
): Promise<FlushResult> {
  const blob = photo ?? takeStagedPhoto(entry.key);
  if (entryRequiresPhoto(entry.kind) && !blob) {
    return {
      success: false,
      error:
        "La foto del odómetro ya no está disponible. Vuelve a adjuntarla antes de reintentar.",
    };
  }
  if (blob) stagePhoto(entry.key, blob);
  const fd = entryToFormData(entry, blob);
  let result: ActionResult<{ data: unknown }>;
  switch (entry.kind) {
    case "startAssignmentWork":
      result = await startAssignmentWork(fd);
      break;
    case "closeAssignment":
      result = await closeAssignment(fd);
      break;
    case "startVehicleTrip":
      result = await startVehicleTrip(fd);
      break;
    case "endVehicleTrip":
      result = await endVehicleTrip(fd);
      break;
  }
  if (isFailure(result)) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export interface SaveDraftInput {
  kind: OfflineActionKind;
  fields: Record<string, string>;
  photo?: File;
}

/**
 * Freeze action-time evidence into a draft. Returns the enqueue result so
 * the caller can surface the cap-reached path (user-confirmed eviction).
 */
export function saveDraft(input: SaveDraftInput): EnqueueResult {
  const entry: OutboxEntry = {
    key: newOutboxKey(),
    kind: input.kind,
    fields: input.fields,
    capturedAt: new Date().toISOString(),
    attempts: 0,
    photoName: input.photo?.name,
  };
  if (input.photo) stagePhoto(entry.key, input.photo);
  return enqueueEntry(entry);
}

/** Operator-facing message when a draft could NOT be queued. */
export function describeEnqueueFailure(
  reason: "cap-reached" | "quota-exceeded",
): string {
  return reason === "cap-reached"
    ? "Cola de borradores llena. Descarta un borrador pendiente para guardar este."
    : "Almacenamiento del dispositivo lleno. Libera espacio o descarta un borrador pendiente.";
}
