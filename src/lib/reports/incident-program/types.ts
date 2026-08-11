/**
 * Incident report rendered in the operation's schedule grid — domain model.
 *
 * The report answers "which incidents happened, where, and who attended them",
 * laid out in the pre-existing Excel format used by the operation (one block
 * per ISO week, Monday→Saturday columns). Incidents are selected through the
 * programaciones (schedules) they belong to, over a date range.
 *
 * Every week block repeats a fixed set of labelled rows:
 *
 *   DIA                          L | M | Mi | J | V | S
 *   FECHA                        day-of-month numbers
 *   CENTRO                       cliente of the incident
 *   RESPONSABLES MANTENIMIENTO   FSRs who attended maintenance incidents
 *   CALIBRACION FASE II          FSRs who attended phase-II calibration
 *   CAL. OPACIMETRO, GASES       FSRs who attended opacimeter/gas calibration
 *   RESPONSABLES INCIDENCIAS     FSRs who attended reactive (failure) incidents
 *   VACACIONES                   FSRs on approved vacation
 *
 * The CENTRO group repeats when incidents at more than one cliente fall on the
 * same day of a given week — each concurrent cliente occupies a "slot".
 */

/** Column headers used by the source workbook (Monday → Saturday). */
export const WEEKDAY_LABELS = ["L", "M", "Mi", "J", "V", "S"] as const;

/** Number of day columns per week block. Sunday is not part of the format. */
export const DAYS_PER_WEEK = WEEKDAY_LABELS.length;

/** Row labels, verbatim from the source workbook. */
export const ROW_LABELS = {
  DIA: "DIA ",
  FECHA: "FECHA",
  CENTRO: "CENTRO",
  MANTENIMIENTO: "RESPONSABLES MANTENIMIENTO",
  CALIBRACION: "CALIBRACION FASE II",
  OPACIMETRO: "CAL. OPACIMETRO, GASES",
  INCIDENCIAS: "RESPONSABLES INCIDENCIAS",
  VACACIONES: "VACACIONES",
} as const;

/** Label placed in the CENTRO row when a day is an official holiday. */
export const HOLIDAY_CELL_LABEL = "FERIADO";

/**
 * Sentinel used by the schedule picker to also include incidents that are not
 * linked to any programación.
 */
export const NO_SCHEDULE_ID = "__no_schedule__";

/**
 * Which row an incident lands on, derived from its type name — see
 * `classifyIncidentType`. `INCIDENCIAS` is reactive work (failures) and has no
 * CENTRO row of its own; the rest are planned activities at a centro.
 */
export type ProgramCategory =
  | "MANTENIMIENTO"
  | "CALIBRACION_FASE_II"
  | "CAL_OPACIMETRO_GASES"
  | "INCIDENCIAS";

/** Row kinds emitted by the builder, in the order they appear on the sheet. */
export type ProgramRowKind =
  | "CENTRO"
  | "MANTENIMIENTO"
  | "CALIBRACION_FASE_II"
  | "CAL_OPACIMETRO_GASES"
  | "INCIDENCIAS"
  | "VACACIONES";

/** One incident placed on the grid. */
export interface ProgramEntry {
  /** Calendar date in CDMX, `YYYY-MM-DD`. */
  date: string;
  /**
   * Cliente code shown in the CENTRO row (e.g. `CVV24`). Null when unknown;
   * `INCIDENCIAS` entries ignore it — that row is a duty roster, not per centro.
   */
  clienteCode: string | null;
  category: ProgramCategory;
  /** Display names of the FSRs who attended it. May be empty. */
  responsables: string[];
}

/** FSRs on approved vacation on a single date. */
export interface VacationEntry {
  date: string;
  responsables: string[];
}

/** Raw input consumed by `buildIncidentProgram`. */
export interface IncidentProgramInput {
  /** Inclusive range, `YYYY-MM-DD` in CDMX. */
  startDate: string;
  endDate: string;
  entries: ProgramEntry[];
  vacations: VacationEntry[];
  /** Calendar dates (`YYYY-MM-DD`) that are official holidays. */
  holidays: string[];
}

export interface ProgramDay {
  /** `YYYY-MM-DD` in CDMX. */
  date: string;
  dayOfMonth: number;
  weekday: (typeof WEEKDAY_LABELS)[number];
  isHoliday: boolean;
  /** False for days the rendered weeks cover but the requested range excludes. */
  inRange: boolean;
}

export interface ProgramRow {
  kind: ProgramRowKind;
  label: string;
  /** One value per day column; `null` when the cell is empty. */
  cells: (string | null)[];
}

export interface ProgramWeek {
  days: ProgramDay[];
  rows: ProgramRow[];
}

export interface IncidentProgramReport {
  startDate: string;
  endDate: string;
  /**
   * Banner text. A range covering exactly one calendar month keeps the source
   * workbook's spaced style (`M A Y O   2 0 2 6`); other ranges are labelled
   * with their bounds.
   */
  title: string;
  weeks: ProgramWeek[];
  /** Total incidents placed on the grid — 0 means nothing matched. */
  incidentCount: number;
}

/** One row of the schedule picker. */
export interface ScheduleOption {
  /** Schedule id, or `NO_SCHEDULE_ID` for the "sin programación" entry. */
  id: string;
  title: string;
  /** `YYYY-MM-DD`, null for the "sin programación" entry. */
  startDate: string | null;
  endDate: string | null;
  /** Incidents this schedule contributes within the requested range. */
  incidentCount: number;
  /** Cliente codes touched by the schedule, for context in the list. */
  clienteCodes: string[];
}
