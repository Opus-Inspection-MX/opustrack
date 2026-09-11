/**
 * Stable system codes for statuses (Fase 3, H-08).
 *
 * `name` is an editable label; `code` is the identity the logic resolves by.
 * `INCIDENT_STATE` / `ASSIGNMENT_STATE` keep living in the state machines
 * (they own the transition tables); the values here MUST stay identical to
 * those so `code` and machine state are the same string.
 *
 * Every comparison goes through `codeOf` + the `is*` helpers below — never a
 * direct label comparison. `codeOf` falls back to `name` so rows that predate
 * the backfill (and unit mocks without `code`) keep working.
 */

import {
  ASSIGNMENT_STATE,
  type AssignmentState,
} from "@/lib/state-machine/assignment-machine";
import {
  INCIDENT_STATE,
  INCIDENT_TERMINAL_STATES,
  type IncidentState,
} from "@/lib/state-machine/incident-machine";

export const USER_STATUS = {
  ACTIVO: "ACTIVO",
  INACTIVO: "INACTIVO",
  SUSPENDIDO: "SUSPENDIDO",
} as const;

export type UserStatusCode = (typeof USER_STATUS)[keyof typeof USER_STATUS];

export const VACATION_STATUS = {
  PENDIENTE: "PENDIENTE",
  APROBADA: "APROBADA",
  RECHAZADA: "RECHAZADA",
} as const;

export type VacationStatusCode =
  (typeof VACATION_STATUS)[keyof typeof VACATION_STATUS];

export const VEHICLE_STATUS = {
  AVAILABLE: "AVAILABLE",
  IN_USE: "IN_USE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE",
} as const;

export type VehicleStatusCode =
  (typeof VEHICLE_STATUS)[keyof typeof VEHICLE_STATUS];

export const VEHICLE_TRIP_STATUS = {
  EN_CURSO: "EN_CURSO",
  COMPLETADO: "COMPLETADO",
  CANCELADO: "CANCELADO",
} as const;

export type VehicleTripStatusCode =
  (typeof VEHICLE_TRIP_STATUS)[keyof typeof VEHICLE_TRIP_STATUS];

/** A status row as the logic sees it: identity in `code`, label in `name`. */
export type StatusRef = {
  code?: string | null;
  name?: string | null;
};

/** Stable identity of a status row, falling back to the label. */
export function codeOf(status: StatusRef | null | undefined): string | null {
  if (!status) return null;
  return status.code ?? status.name ?? null;
}

// --- incident ---------------------------------------------------------------

export function isIncidentTerminalCode(code: string | null): boolean {
  return code === INCIDENT_STATE.CERRADO || code === INCIDENT_STATE.CANCELADA;
}

export function isIncidentTerminal(
  status: StatusRef | null | undefined,
): boolean {
  return isIncidentTerminalCode(codeOf(status));
}

export function isIncidentCancelled(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === INCIDENT_STATE.CANCELADA;
}

export function isIncidentClosed(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === INCIDENT_STATE.CERRADO;
}

/** Re-export for call sites that already import from here. */
export { ASSIGNMENT_STATE, INCIDENT_STATE, INCIDENT_TERMINAL_STATES };
export type { AssignmentState, IncidentState };

// --- assignment -------------------------------------------------------------

export function isAssignmentClosed(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === ASSIGNMENT_STATE.CERRADO;
}

// --- user -------------------------------------------------------------------

export function isUserActive(status: StatusRef | null | undefined): boolean {
  return codeOf(status) === USER_STATUS.ACTIVO;
}

// --- vacation ---------------------------------------------------------------

export function isVacationPending(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === VACATION_STATUS.PENDIENTE;
}

export function isVacationApproved(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === VACATION_STATUS.APROBADA;
}

export function isVacationBlocking(
  status: StatusRef | null | undefined,
): boolean {
  const code = codeOf(status);
  return (
    code === VACATION_STATUS.PENDIENTE || code === VACATION_STATUS.APROBADA
  );
}

// --- vehicle ----------------------------------------------------------------

export function isVehicleAvailable(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === VEHICLE_STATUS.AVAILABLE;
}

// --- vehicle trip -----------------------------------------------------------

export function isVehicleTripOpen(
  status: StatusRef | null | undefined,
): boolean {
  return codeOf(status) === VEHICLE_TRIP_STATUS.EN_CURSO;
}
