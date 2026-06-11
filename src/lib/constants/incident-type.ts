/**
 * Name of the catch-all IncidentType used as fallback when an incident is
 * created without a type. Lives outside the `"use server"` boundary so it can
 * be imported from both client and server modules.
 *
 * The seed creates this row with sla = null. `deleteIncidentType` rejects any
 * delete attempt against this name.
 */
export const FALLBACK_INCIDENT_TYPE_NAME = "Desconocido";

/**
 * Priority threshold above which an incident type is considered critical.
 * An IncidentType with priority >= CRITICAL_PRIORITY_THRESHOLD is critical.
 * Single source of truth for dashboard queries, Zod validators, and UI badges.
 */
export const CRITICAL_PRIORITY_THRESHOLD = 8;

/** Minimum allowed value for IncidentType.priority (inclusive). */
export const MIN_INCIDENT_PRIORITY = 1;

/** Maximum allowed value for IncidentType.priority (inclusive). */
export const MAX_INCIDENT_PRIORITY = 10;

/**
 * Returns true if the given priority value meets or exceeds the critical
 * threshold. Client-safe — no server imports.
 */
export function isCriticalPriority(priority: number): boolean {
  return priority >= CRITICAL_PRIORITY_THRESHOLD;
}
