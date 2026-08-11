import ExcelJS from "exceljs";
import moment from "moment-timezone";
import { APP_TZ } from "@/lib/utils/datetime";
import {
  DAYS_PER_WEEK,
  HOLIDAY_CELL_LABEL,
  type IncidentProgramReport,
  type ProgramRow,
  type ProgramWeek,
  ROW_LABELS,
} from "./types";

/**
 * Excel renderer for the incident report.
 *
 * Colours, fonts, borders and row order are taken verbatim from the operation's
 * existing file (`Programantto <plaza> <MES> <AÑO>.xlsx`). The source stores
 * some fills as theme references; those are resolved here to their literal ARGB
 * so the output looks identical regardless of the destination workbook theme:
 *
 *   title  = lt1  tint -0.25  → BFBFBF
 *   DIA    = dk2  tint  0.90  → DCEAF7
 *   calib. = acc5 tint  0.60  → E59EDD
 */

const COLOR = {
  /** Month banner. */
  title: "FFBFBFBF",
  /** DIA / FECHA header rows. */
  header: "FFDCEAF7",
  /** CENTRO cells holding a cliente code. */
  centro: "FF92D050",
  /** CENTRO cells holding the FERIADO marker. */
  feriado: "FFFFFF00",
  /** CALIBRACION FASE II and CAL. OPACIMETRO, GASES cells. */
  calibracion: "FFE59EDD",
  /** Default body cell. */
  body: "FFFFFFFF",
} as const;

const BODY_FONT = { name: "Aptos Narrow", family: 2, size: 8 } as const;
const CENTRO_FONT = {
  name: "Arial",
  family: 2,
  size: 8,
  bold: true,
  italic: true,
} as const;

const THIN = { style: "thin", color: { argb: "FF000000" } } as const;
const ALL_BORDERS: Partial<ExcelJS.Borders> = {
  top: THIN,
  left: THIN,
  bottom: THIN,
  right: THIN,
};

/** Column index of the row-label column, and of the first day column. */
const LABEL_COL = 1;
const FIRST_DAY_COL = 2;

/** The source workbook leaves rows 1–3 empty and opens the banner on row 4. */
const FIRST_ROW = 4;
/** Blank rows inserted between two week blocks. */
const WEEK_GAP = 2;
/** Height applied to rows that carry a wrapped label. */
const LABEL_ROW_HEIGHT = 21;

const MONTH_ABBR = [
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

/** True when the range covers exactly one calendar month. */
function isWholeMonth(start: moment.Moment, end: moment.Moment): boolean {
  return (
    start.isSame(start.clone().startOf("month"), "day") &&
    end.isSame(start.clone().endOf("month"), "day")
  );
}

/**
 * Sheet name. A whole month keeps the operation's convention
 * (`MANTTOS MAYO 26`); other ranges are labelled with their bounds. Excel
 * caps sheet names at 31 characters.
 */
export function sheetName(startDate: string, endDate: string): string {
  const start = moment.tz(startDate, "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(endDate, "YYYY-MM-DD", APP_TZ);

  const name = isWholeMonth(start, end)
    ? `MANTTOS ${MONTH_ABBR[start.month()]} ${start.format("YY")}`
    : `${start.format("DDMMMYY")}-${end.format("DDMMMYY")}`.toUpperCase();

  return name.slice(0, 31);
}

/**
 * Download file name. The operation names these per plaza
 * ("ProgramanttoPuebla MAYO 2026.xlsx"), so the state is included when the
 * report is filtered to one: `Incidentes Puebla MAYO 2026.xlsx`.
 */
export function workbookFileName(
  startDate: string,
  endDate: string,
  plaza?: string | null,
): string {
  const start = moment.tz(startDate, "YYYY-MM-DD", APP_TZ);
  const end = moment.tz(endDate, "YYYY-MM-DD", APP_TZ);
  const scope = plaza?.trim() ? ` ${plaza.trim()}` : "";

  const period = isWholeMonth(start, end)
    ? `${MONTH_ABBR[start.month()]} ${start.year()}`
    : `${start.format("YYYY-MM-DD")} a ${end.format("YYYY-MM-DD")}`;

  return `Incidentes${scope} ${period}.xlsx`;
}

function fill(argb: string): ExcelJS.FillPattern {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

/** Paint the label cell of a data row (bold, wrapped, left-aligned). */
function writeLabel(row: ExcelJS.Row, label: string): void {
  const cell = row.getCell(LABEL_COL);
  cell.value = label;
  cell.font = { ...BODY_FONT, bold: true };
  cell.border = ALL_BORDERS;
  cell.alignment = { vertical: "middle", wrapText: true };
}

/** Resolve the fill of a body cell from the row kind and its content. */
function bodyFillFor(row: ProgramRow, value: string | null): string {
  if (row.kind === "CENTRO") {
    if (value === null) return COLOR.body;
    return value === HOLIDAY_CELL_LABEL ? COLOR.feriado : COLOR.centro;
  }
  if (
    row.kind === "CALIBRACION_FASE_II" ||
    row.kind === "CAL_OPACIMETRO_GASES"
  ) {
    return value === null ? COLOR.body : COLOR.calibracion;
  }
  return COLOR.body;
}

function writeHeaderRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  label: string,
  values: (string | number)[],
): void {
  const row = sheet.getRow(rowNumber);
  const cells: (string | number)[] = [label, ...values];
  cells.forEach((value, i) => {
    const cell = row.getCell(LABEL_COL + i);
    cell.value = value;
    cell.font = { ...BODY_FONT, bold: true };
    cell.fill = fill(COLOR.header);
    cell.border = ALL_BORDERS;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
  row.commit();
}

function writeDataRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  programRow: ProgramRow,
): void {
  const row = sheet.getRow(rowNumber);
  row.height = LABEL_ROW_HEIGHT;
  writeLabel(row, programRow.label);

  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    const value = programRow.cells[i] ?? null;
    const cell = row.getCell(FIRST_DAY_COL + i);
    if (value !== null) cell.value = value;
    cell.font = programRow.kind === "CENTRO" ? CENTRO_FONT : BODY_FONT;
    cell.fill = fill(bodyFillFor(programRow, value));
    cell.border = ALL_BORDERS;
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
  }
  row.commit();
}

function writeWeek(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  week: ProgramWeek,
): number {
  let rowNumber = startRow;

  writeHeaderRow(
    sheet,
    rowNumber++,
    ROW_LABELS.DIA,
    week.days.map((d) => d.weekday),
  );
  writeHeaderRow(
    sheet,
    rowNumber++,
    ROW_LABELS.FECHA,
    week.days.map((d) => d.dayOfMonth),
  );

  for (const row of week.rows) {
    writeDataRow(sheet, rowNumber++, row);
  }

  return rowNumber;
}

/**
 * Render the report into an .xlsx buffer that reproduces the operation's
 * existing schedule-grid layout.
 */
export async function renderIncidentProgramWorkbook(
  report: IncidentProgramReport,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "OpusTrack";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(
    sheetName(report.startDate, report.endDate),
    {
      views: [{ showGridLines: true }],
      pageSetup: {
        orientation: "portrait",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.4,
          right: 0.4,
          top: 0.5,
          bottom: 0.5,
          header: 0.3,
          footer: 0.3,
        },
      },
    },
  );

  sheet.getColumn(LABEL_COL).width = 28;
  for (let i = 0; i < DAYS_PER_WEEK; i++) {
    sheet.getColumn(FIRST_DAY_COL + i).width = 20;
  }

  // Month banner, merged across the label column and the six day columns.
  const lastCol = FIRST_DAY_COL + DAYS_PER_WEEK - 1;
  sheet.mergeCells(FIRST_ROW, LABEL_COL, FIRST_ROW, lastCol);
  const banner = sheet.getRow(FIRST_ROW);
  for (let col = LABEL_COL; col <= lastCol; col++) {
    const cell = banner.getCell(col);
    cell.font = { ...BODY_FONT, bold: true };
    cell.fill = fill(COLOR.title);
    cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  }
  banner.getCell(LABEL_COL).value = report.title;
  banner.commit();

  let rowNumber = FIRST_ROW + WEEK_GAP;
  for (const week of report.weeks) {
    rowNumber = writeWeek(sheet, rowNumber, week) + WEEK_GAP;
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
