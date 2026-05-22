/**
 * Assignment state machine.
 *
 * Flow:
 *   PENDIENTE_DE_ASIGNACION → ASIGNADO → VISTO → INICIADO ↔ EN_PROGRESO → CERRADO
 *   CERRADO → EN_PROGRESO (reopen, admin)
 *
 * CERRADO requiere: GPS final, evidencia (≥1 adjunto) y folio ODT.
 */

export const ASSIGNMENT_STATE = {
  PENDIENTE_DE_ASIGNACION: "PENDIENTE_DE_ASIGNACION",
  ASIGNADO: "ASIGNADO",
  VISTO: "VISTO",
  INICIADO: "INICIADO",
  EN_PROGRESO: "EN_PROGRESO",
  CERRADO: "CERRADO",
} as const;

export type AssignmentState =
  (typeof ASSIGNMENT_STATE)[keyof typeof ASSIGNMENT_STATE];

/** Used by sync to map assignment state → incident state. */
export const ASSIGNMENT_STATE_ORDER: AssignmentState[] = [
  ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
  ASSIGNMENT_STATE.ASIGNADO,
  ASSIGNMENT_STATE.VISTO,
  ASSIGNMENT_STATE.INICIADO,
  ASSIGNMENT_STATE.EN_PROGRESO,
  ASSIGNMENT_STATE.CERRADO,
];

const ALLOWED: Record<AssignmentState, ReadonlySet<AssignmentState>> = {
  [ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION]: new Set([
    ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION,
    ASSIGNMENT_STATE.ASIGNADO,
  ]),
  [ASSIGNMENT_STATE.ASIGNADO]: new Set([
    ASSIGNMENT_STATE.PENDIENTE_DE_ASIGNACION, // last assignee removed
    ASSIGNMENT_STATE.ASIGNADO,
    ASSIGNMENT_STATE.VISTO,
  ]),
  [ASSIGNMENT_STATE.VISTO]: new Set([
    ASSIGNMENT_STATE.VISTO,
    ASSIGNMENT_STATE.INICIADO,
  ]),
  [ASSIGNMENT_STATE.INICIADO]: new Set([
    ASSIGNMENT_STATE.INICIADO,
    ASSIGNMENT_STATE.EN_PROGRESO,
    ASSIGNMENT_STATE.CERRADO,
  ]),
  [ASSIGNMENT_STATE.EN_PROGRESO]: new Set([
    ASSIGNMENT_STATE.EN_PROGRESO,
    ASSIGNMENT_STATE.INICIADO, // resume on-site work
    ASSIGNMENT_STATE.CERRADO,
  ]),
  [ASSIGNMENT_STATE.CERRADO]: new Set([
    ASSIGNMENT_STATE.CERRADO,
    ASSIGNMENT_STATE.EN_PROGRESO, // admin reopen
  ]),
};

export function assertAssignmentTransition(
  from: AssignmentState,
  to: AssignmentState,
): void {
  if (!ALLOWED[from]?.has(to)) {
    throw new Error(
      `Transición de asignación inválida: ${from} → ${to}. Permitidas desde ${from}: ${[
        ...(ALLOWED[from] ?? []),
      ].join(", ")}`,
    );
  }
}

export function isAssignmentState(value: unknown): value is AssignmentState {
  return (
    typeof value === "string" &&
    (ASSIGNMENT_STATE_ORDER as readonly string[]).includes(value)
  );
}

/** Preconditions evaluated against the resulting Assignment row. */
export type AssignmentPreconditionCtx = {
  startedAt: Date | null | undefined;
  finishedAt: Date | null | undefined;
  startLatitude: number | null | undefined;
  startLongitude: number | null | undefined;
  endLatitude: number | null | undefined;
  endLongitude: number | null | undefined;
  attachmentCount: number; // active assignment attachments
  odtFolio: string | null | undefined;
};

export function assertAssignmentPreconditions(
  to: AssignmentState,
  ctx: AssignmentPreconditionCtx,
): void {
  if (to === ASSIGNMENT_STATE.INICIADO) {
    if (
      ctx.startLatitude == null ||
      ctx.startLongitude == null ||
      ctx.startedAt == null
    ) {
      throw new Error(
        "No se puede iniciar la asignación sin ubicación GPS y hora de inicio",
      );
    }
  }
  if (to === ASSIGNMENT_STATE.CERRADO) {
    if (
      ctx.endLatitude == null ||
      ctx.endLongitude == null ||
      ctx.finishedAt == null
    ) {
      throw new Error(
        "No se puede cerrar la asignación sin ubicación GPS final y hora de cierre",
      );
    }
    if (ctx.attachmentCount <= 0) {
      throw new Error(
        "No se puede cerrar la asignación sin al menos una evidencia",
      );
    }
    if (!ctx.odtFolio || ctx.odtFolio.trim() === "") {
      throw new Error(
        "No se puede cerrar la asignación sin folio ODT registrado",
      );
    }
  }
}
