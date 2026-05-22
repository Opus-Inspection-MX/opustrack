/**
 * Incident state machine.
 *
 * Flow: ABIERTO → ASIGNADO → VISTO → INICIADO → EN_PROGRESO → CERRADO
 *                                                          ↘ CANCELADA
 *
 * Incident state is *derived* from its assignments — callers should not
 * change incident state manually; use syncIncidentState() instead.
 * CANCELADA is the exception: it is set directly by admin via
 * cancelIncident() and is terminal (sync no-ops on it).
 */

export const INCIDENT_STATE = {
  ABIERTO: "ABIERTO",
  ASIGNADO: "ASIGNADO",
  VISTO: "VISTO",
  INICIADO: "INICIADO",
  EN_PROGRESO: "EN_PROGRESO",
  CERRADO: "CERRADO",
  CANCELADA: "CANCELADA",
} as const;

export type IncidentState =
  (typeof INCIDENT_STATE)[keyof typeof INCIDENT_STATE];

/** Ordered for "max state" comparisons during sync. CANCELADA excluded — terminal admin-only. */
export const INCIDENT_STATE_ORDER: IncidentState[] = [
  INCIDENT_STATE.ABIERTO,
  INCIDENT_STATE.ASIGNADO,
  INCIDENT_STATE.VISTO,
  INCIDENT_STATE.INICIADO,
  INCIDENT_STATE.EN_PROGRESO,
  INCIDENT_STATE.CERRADO,
  INCIDENT_STATE.CANCELADA,
];

const ALLOWED: Record<IncidentState, ReadonlySet<IncidentState>> = {
  [INCIDENT_STATE.ABIERTO]: new Set([
    INCIDENT_STATE.ABIERTO,
    INCIDENT_STATE.ASIGNADO,
    INCIDENT_STATE.CANCELADA,
  ]),
  [INCIDENT_STATE.ASIGNADO]: new Set([
    INCIDENT_STATE.ABIERTO, // can go back if all assignments removed
    INCIDENT_STATE.ASIGNADO,
    INCIDENT_STATE.VISTO,
    INCIDENT_STATE.CANCELADA,
  ]),
  [INCIDENT_STATE.VISTO]: new Set([
    INCIDENT_STATE.ASIGNADO, // possible if seen state is rolled back
    INCIDENT_STATE.VISTO,
    INCIDENT_STATE.INICIADO,
    INCIDENT_STATE.CANCELADA,
  ]),
  [INCIDENT_STATE.INICIADO]: new Set([
    INCIDENT_STATE.VISTO,
    INCIDENT_STATE.INICIADO,
    INCIDENT_STATE.EN_PROGRESO,
    INCIDENT_STATE.CERRADO,
    INCIDENT_STATE.CANCELADA,
  ]),
  [INCIDENT_STATE.EN_PROGRESO]: new Set([
    INCIDENT_STATE.INICIADO,
    INCIDENT_STATE.EN_PROGRESO,
    INCIDENT_STATE.CERRADO,
    INCIDENT_STATE.CANCELADA,
  ]),
  [INCIDENT_STATE.CERRADO]: new Set([
    INCIDENT_STATE.EN_PROGRESO, // reopen path
    INCIDENT_STATE.CERRADO,
  ]),
  [INCIDENT_STATE.CANCELADA]: new Set([
    INCIDENT_STATE.CANCELADA, // terminal
  ]),
};

export function assertIncidentTransition(
  from: IncidentState,
  to: IncidentState,
): void {
  if (!ALLOWED[from]?.has(to)) {
    throw new Error(
      `Transición de incidencia inválida: ${from} → ${to}. Permitidas desde ${from}: ${[
        ...(ALLOWED[from] ?? []),
      ].join(", ")}`,
    );
  }
}

export function isIncidentState(value: unknown): value is IncidentState {
  return (
    typeof value === "string" &&
    (INCIDENT_STATE_ORDER as readonly string[]).includes(value)
  );
}

/** Terminal states where FSR mutations on child assignments must be blocked. */
export const INCIDENT_TERMINAL_STATES: ReadonlySet<IncidentState> = new Set([
  INCIDENT_STATE.CERRADO,
  INCIDENT_STATE.CANCELADA,
]);
