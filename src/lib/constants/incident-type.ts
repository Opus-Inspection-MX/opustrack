/**
 * Name of the catch-all IncidentType used as fallback when an incident is
 * created without a type. Lives outside the `"use server"` boundary so it can
 * be imported from both client and server modules.
 *
 * The seed creates this row with sla = null. `deleteIncidentType` rejects any
 * delete attempt against this name.
 */
export const FALLBACK_INCIDENT_TYPE_NAME = "Desconocido";
