/**
 * System state/role lists shared by both seeds (Fase 3, H-08/H-09).
 *
 * Single source of truth for the rows whose `code` is the stable identity:
 * `initial_load/seed.ts` (real data, gitignored) and
 * `initial_load/seed.example.ts` (tracked template) must seed exactly these.
 * The migration backfills `code = name` for the same names.
 */

export type SystemState = {
  code: string;
  color?: string;
  description?: string;
};

export const SYSTEM_USER_STATUSES: readonly string[] = [
  "ACTIVO",
  "INACTIVO",
  "SUSPENDIDO",
];

export const SYSTEM_INCIDENT_STATUSES: readonly SystemState[] = [
  { code: "ABIERTO", color: "#94A3B8" },
  { code: "ASIGNADO", color: "#8B5CF6" },
  { code: "VISTO", color: "#06B6D4" },
  { code: "INICIADO", color: "#3B82F6" },
  { code: "EN_PROGRESO", color: "#F59E0B" },
  { code: "CERRADO", color: "#10B981" },
  { code: "CANCELADA", color: "#EF4444" },
];

export const SYSTEM_ASSIGNMENT_STATUSES: readonly SystemState[] = [
  { code: "PENDIENTE_DE_ASIGNACION", color: "#94A3B8" },
  { code: "ASIGNADO", color: "#8B5CF6" },
  { code: "VISTO", color: "#06B6D4" },
  { code: "INICIADO", color: "#3B82F6" },
  { code: "EN_PROGRESO", color: "#F59E0B" },
  { code: "CERRADO", color: "#10B981" },
];

export const SYSTEM_VACATION_STATUSES: readonly SystemState[] = [
  {
    code: "PENDIENTE",
    description: "Vacation request pending admin review",
    color: "#F59E0B",
  },
  {
    code: "APROBADA",
    description: "Vacation request approved",
    color: "#10B981",
  },
  {
    code: "RECHAZADA",
    description: "Vacation request rejected",
    color: "#EF4444",
  },
];

export const SYSTEM_VEHICLE_STATUSES: readonly string[] = [
  "AVAILABLE",
  "IN_USE",
  "MAINTENANCE",
  "INACTIVE",
];

export const SYSTEM_VEHICLE_TRIP_STATUSES: readonly string[] = [
  "EN_CURSO",
  "COMPLETADO",
  "CANCELADO",
];
