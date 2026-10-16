import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { mxDayRange } from "../../src/lib/utils/datetime";

export interface SourceRow {
  sourceSheet: string;
  sourceRow: number;
  cycleYear: number;
  sourceName: string;
  hireDate: Date | null;
  yearsOfService: number;
  entitledDays: number | null;
  takenDays: number | null;
  remainingDays: number | null;
  issues: string[];
  sourceValues: Prisma.InputJsonValue;
}

function tokens(name: string) {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/);
}

/** Only rotate whole name blocks; never approximate or sort individual tokens. */
export function samePerson(a: string, b: string): boolean {
  const left = tokens(a),
    right = tokens(b).join(" ");
  return left.some(
    (_, i) => [...left.slice(i), ...left.slice(0, i)].join(" ") === right,
  );
}

const months: Record<string, number> = {
  ene: 1,
  feb: 2,
  mar: 3,
  abr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dic: 12,
};
const amount = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(value));

function dateKey(
  value: ExcelJS.CellValue,
  evidenceYears: Set<number>,
): string | null {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
      ? value.slice(0, 10)
      : null;
  }
  const match = value
    .trim()
    .toLowerCase()
    .match(/^(\d{1,2})-([a-z]{3})-(\d{2}|\d{4})$/);
  if (!match || !months[match[2]]) return null;
  const yy = Number(match[3]);
  const candidates =
    match[3].length === 4
      ? [yy]
      : [1900 + yy, 2000 + yy].filter((year) => evidenceYears.has(year));
  if (candidates.length !== 1) return null;
  const key = `${candidates[0]}-${String(months[match[2]]).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const date = new Date(`${key}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === key
    ? key
    : null;
}

/** Data only: ExcelJS does not execute VBA. Recompute only the known E-F formula. */
export async function readVacationWorkbook(bytes: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const candidates: {
    sheet: ExcelJS.Worksheet;
    row: ExcelJS.Row;
    year: number;
  }[] = [];
  const source = workbook.worksheets.map((sheet) => {
    const rows: { number: number; values: Prisma.InputJsonValue }[] = [];
    sheet.eachRow((row, number) => {
      rows.push({ number, values: json(row.values) });
      const year = sheet.name.match(/^Vacaciones (20\d{2})-(20\d{2})$/);
      if (
        year &&
        number > 2 &&
        typeof row.getCell(1).value === "string" &&
        row.getCell(2).value &&
        amount(row.getCell(3).value) !== null
      ) {
        candidates.push({ sheet, row, year: Number(year[1]) });
      }
    });
    return {
      name: sheet.name,
      state: sheet.state,
      merges: sheet.model.merges,
      rows,
    };
  });
  const rows: SourceRow[] = candidates.map(({ sheet, row, year }) => {
    const name = row.getCell(1).text;
    const peers = candidates.filter((other) =>
      samePerson(name, other.row.getCell(1).text),
    );
    const evidence = new Set(
      peers.map((other) => other.year - Number(other.row.getCell(3).value)),
    );
    const hireKey = dateKey(row.getCell(2).value, evidence);
    const peerDates = new Set(
      peers
        .map((other) => dateKey(other.row.getCell(2).value, evidence))
        .filter(Boolean),
    );
    const entitled = amount(row.getCell(5).value);
    const usedRaw = row.getCell(6).value;
    let taken = amount(usedRaw);
    const balanceCell = row.getCell(7);
    const formula =
      balanceCell.type === ExcelJS.ValueType.Formula ? balanceCell.formula : "";
    const recognized = new RegExp(
      `^\\+?E${row.number}-F${row.number}$`,
      "i",
    ).test(formula);
    // A blank operand in this exact Excel subtraction evaluates to zero.
    if (recognized && (usedRaw === null || usedRaw === undefined)) taken = 0;
    const rawBalance = balanceCell.value;
    const cached =
      rawBalance && typeof rawBalance === "object" && "result" in rawBalance
        ? amount(rawBalance.result)
        : amount(rawBalance);
    let remaining = cached;
    const issues: string[] = [];
    if (recognized && entitled !== null && taken !== null) {
      remaining = entitled - taken;
      if (cached !== null && cached !== remaining)
        issues.push("FORMULA_CACHE_MISMATCH");
    } else if (formula) issues.push("UNSUPPORTED_FORMULA");
    if (entitled === null || taken === null || remaining === null)
      issues.push("INCOMPLETE_BALANCE");
    else if (entitled < taken || entitled - taken !== remaining)
      issues.push("INCONSISTENT_BALANCE");
    if (!hireKey || peerDates.size !== 1) issues.push("UNVERIFIED_HIRE_DATE");
    if (hireKey && year - Number(hireKey.slice(0, 4)) !== row.getCell(3).value)
      issues.push("SOURCE_SENIORITY_MISMATCH");
    return {
      sourceSheet: sheet.name,
      sourceRow: row.number,
      cycleYear: year,
      sourceName: name,
      hireDate:
        hireKey && peerDates.size === 1 ? mxDayRange(hireKey).gte : null,
      yearsOfService: Number(row.getCell(3).value),
      entitledDays: entitled,
      takenDays: taken,
      remainingDays: remaining,
      issues,
      sourceValues: json(row.values),
    };
  });
  if (!rows.length) throw new Error("WORKBOOK_EMPTY");
  return {
    digest: createHash("sha256").update(bytes).digest("hex"),
    source: json(source),
    rows,
  };
}
