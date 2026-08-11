import moment from "moment-timezone";
import { APP_TZ } from "@/lib/utils/datetime";
import {
  DAYS_PER_WEEK,
  HOLIDAY_CELL_LABEL,
  type IncidentProgramInput,
  type IncidentProgramReport,
  type ProgramCategory,
  type ProgramDay,
  type ProgramRow,
  type ProgramRowKind,
  type ProgramWeek,
  ROW_LABELS,
  WEEKDAY_LABELS,
} from "./types";

const MONTH_NAMES = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

/** Space out every character, the way the source workbook writes its banner. */
function spaced(value: string): string {
  return value.split("").join(" ");
}

/**
 * Banner text for the report.
 *
 * A range that covers exactly one calendar month keeps the source workbook's
 * spaced style (`M A Y O   2 0 2 6`). Any other range is labelled with its
 * bounds, since the spaced style only reads well for a bare month name.
 */
export function rangeTitle(startDate: string, endDate: string): string {
  const start = moment.tz(startDate, "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(endDate, "YYYY-MM-DD", APP_TZ);

  const isWholeMonth =
    start.isSame(start.clone().startOf("month"), "day") &&
    end.isSame(start.clone().endOf("month"), "day");

  if (isWholeMonth) {
    return `${spaced(MONTH_NAMES[start.month()])}   ${spaced(String(start.year()))}`;
  }

  const label = (m: moment.Moment) =>
    `${m.format("DD")} ${MONTH_NAMES[m.month()]} ${m.year()}`;
  return `${label(start)} - ${label(end)}`;
}

/**
 * Shorten a user's full name to the single upper-case token used by the
 * operation's schedule (`Jesús Ramírez` → `JESÚS`).
 */
export function shortName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first.toUpperCase();
}

/** Strip accents and lower-case, so type names can be matched loosely. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Map an incident type name onto one of the report's rows.
 *
 * The report format predates the incident-type catalog, so the mapping is by
 * name rather than by id: opacimeter/gas work has its own row, remaining
 * calibration work goes to phase II, maintenance types go to the maintenance
 * row, and everything else (failures, supply, cleaning…) is reactive work that
 * belongs to the RESPONSABLES INCIDENCIAS duty row.
 */
export function classifyIncidentType(
  typeName: string | null | undefined,
): ProgramCategory {
  const name = normalize(typeName ?? "");
  if (name.includes("opacim") || name.includes("gases")) {
    return "CAL_OPACIMETRO_GASES";
  }
  if (name.includes("calibra")) return "CALIBRACION_FASE_II";
  if (name.includes("mantenimiento")) return "MANTENIMIENTO";
  return "INCIDENCIAS";
}

/** Accumulates the distinct responsables of a single cell, preserving order. */
type CellNames = string[];

function pushNames(target: CellNames, names: string[]): void {
  for (const name of names) {
    if (name && !target.includes(name)) target.push(name);
  }
}

function joinNames(names: CellNames | undefined): string | null {
  if (!names || names.length === 0) return null;
  return names.join(", ");
}

/** Categories that occupy a CENTRO group, in the order they are rendered. */
const CENTRO_CATEGORIES = [
  "MANTENIMIENTO",
  "CALIBRACION_FASE_II",
  "CAL_OPACIMETRO_GASES",
] as const;

type CentroCategory = (typeof CENTRO_CATEGORIES)[number];

/** One CENTRO group: the cliente plus its per-category responsables by day. */
interface Slot {
  centro: (string | null)[];
  responsables: Record<CentroCategory, Record<number, CellNames>>;
}

function emptySlot(): Slot {
  return {
    centro: new Array<string | null>(DAYS_PER_WEEK).fill(null),
    responsables: {
      MANTENIMIENTO: {},
      CALIBRACION_FASE_II: {},
      CAL_OPACIMETRO_GASES: {},
    },
  };
}

const CATEGORY_ROW_LABEL: Record<CentroCategory, string> = {
  MANTENIMIENTO: ROW_LABELS.MANTENIMIENTO,
  CALIBRACION_FASE_II: ROW_LABELS.CALIBRACION,
  CAL_OPACIMETRO_GASES: ROW_LABELS.OPACIMETRO,
};

function makeRow(
  kind: ProgramRowKind,
  label: string,
  cells: (string | null)[],
): ProgramRow {
  return { kind, label, cells };
}

/**
 * Build the Monday→Saturday day columns of every ISO week that overlaps the
 * range. Sundays are dropped: the source format has six columns.
 */
function buildWeeks(
  startDate: string,
  endDate: string,
  holidays: Set<string>,
): ProgramDay[][] {
  const start = moment.tz(startDate, "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(endDate, "YYYY-MM-DD", APP_TZ);

  const cursor = start.clone().startOf("isoWeek");
  const last = end.clone().startOf("isoWeek");

  const weeks: ProgramDay[][] = [];
  while (cursor.isSameOrBefore(last, "day")) {
    const days: ProgramDay[] = [];
    for (let i = 0; i < DAYS_PER_WEEK; i++) {
      const day = cursor.clone().add(i, "days");
      const date = day.format("YYYY-MM-DD");
      days.push({
        date,
        dayOfMonth: day.date(),
        weekday: WEEKDAY_LABELS[i],
        isHoliday: holidays.has(date),
        inRange: day.isBetween(start, end, "day", "[]"),
      });
    }
    weeks.push(days);
    cursor.add(1, "week");
  }
  return weeks;
}

/**
 * Turn the selected incidents into the exact row grid the Excel export and the
 * on-screen preview render. Pure — no I/O, no timezone surprises beyond CDMX
 * calendar-date arithmetic.
 */
export function buildIncidentProgram(
  input: IncidentProgramInput,
): IncidentProgramReport {
  const { startDate, endDate } = input;
  const holidays = new Set(input.holidays);
  const weeksDays = buildWeeks(startDate, endDate, holidays);

  // date → { weekIndex, dayIndex }, so entries land on the right column.
  const position = new Map<string, { week: number; day: number }>();
  weeksDays.forEach((days, week) => {
    days.forEach((d, day) => {
      position.set(d.date, { week, day });
    });
  });

  const slotsByWeek: Slot[][] = weeksDays.map(() => []);
  // Per week: cliente code → slot index, so a cliente keeps its row all week.
  const slotIndexByWeek: Map<string, number>[] = weeksDays.map(() => new Map());
  const dutyByWeek: Record<number, CellNames>[] = weeksDays.map(() => ({}));

  let incidentCount = 0;

  for (const entry of input.entries) {
    const at = position.get(entry.date);
    if (!at) continue;
    incidentCount++;

    // Reactive work, and anything without a centro, is a duty-roster entry.
    const isCentroWork =
      entry.category !== "INCIDENCIAS" && entry.clienteCode !== null;

    if (!isCentroWork) {
      dutyByWeek[at.week][at.day] ??= [];
      pushNames(dutyByWeek[at.week][at.day], entry.responsables);
      continue;
    }

    const clienteCode = entry.clienteCode as string;
    const slots = slotsByWeek[at.week];
    const index = slotIndexByWeek[at.week];

    let slotIndex = index.get(clienteCode);
    if (slotIndex === undefined) {
      slotIndex = slots.length;
      index.set(clienteCode, slotIndex);
      slots.push(emptySlot());
    }

    const slot = slots[slotIndex];
    slot.centro[at.day] = clienteCode;
    const bucket = slot.responsables[entry.category as CentroCategory];
    bucket[at.day] ??= [];
    pushNames(bucket[at.day], entry.responsables);
  }

  const vacationsByWeek: Record<number, CellNames>[] = weeksDays.map(
    () => ({}),
  );
  for (const item of input.vacations) {
    const at = position.get(item.date);
    if (!at) continue;
    vacationsByWeek[at.week][at.day] ??= [];
    pushNames(vacationsByWeek[at.week][at.day], item.responsables);
  }

  const weeks: ProgramWeek[] = weeksDays.map((days, weekIndex) => {
    // Always render at least one CENTRO group, even on an empty week.
    const slots = slotsByWeek[weekIndex].length
      ? slotsByWeek[weekIndex]
      : [emptySlot()];

    const rows: ProgramRow[] = [];

    slots.forEach((slot, slotIndex) => {
      const centro = slot.centro.slice();
      // The holiday marker only belongs to the first group and only where no
      // incident was recorded — the source workbook writes it in that cell.
      if (slotIndex === 0) {
        days.forEach((day, i) => {
          if (day.isHoliday && centro[i] === null) {
            centro[i] = HOLIDAY_CELL_LABEL;
          }
        });
      }
      rows.push(makeRow("CENTRO", ROW_LABELS.CENTRO, centro));

      for (const category of CENTRO_CATEGORIES) {
        const bucket = slot.responsables[category];
        const hasData = Object.keys(bucket).length > 0;
        // MANTENIMIENTO is structural and always follows CENTRO; the two
        // calibration rows only appear when there is work to show.
        if (category !== "MANTENIMIENTO" && !hasData) continue;

        const cells = days.map((_, i) => joinNames(bucket[i]));
        rows.push(makeRow(category, CATEGORY_ROW_LABEL[category], cells));
      }
    });

    const duty = dutyByWeek[weekIndex];
    rows.push(
      makeRow(
        "INCIDENCIAS",
        ROW_LABELS.INCIDENCIAS,
        days.map((_, i) => joinNames(duty[i])),
      ),
    );

    const vacations = vacationsByWeek[weekIndex];
    if (Object.keys(vacations).length > 0) {
      rows.push(
        makeRow(
          "VACACIONES",
          ROW_LABELS.VACACIONES,
          days.map((_, i) => joinNames(vacations[i])),
        ),
      );
    }

    return { days, rows };
  });

  return {
    startDate,
    endDate,
    title: rangeTitle(startDate, endDate),
    weeks,
    incidentCount,
  };
}
