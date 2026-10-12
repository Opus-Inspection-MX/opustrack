/** Offline candidate extraction only. Never import the legacy credential generator. */
import { execFileSync } from "node:child_process";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { toCsv } from "../initial_load/csv";

const DIR = path.resolve("initial_load");
const SOURCE = path.join(
  DIR,
  "ListaCentrosNumerosdeLineasPorEstado 15.06.2026.xlsx",
);
const OUTPUTS = [
  "clientes.csv",
  "line-counts.csv",
  "line-candidates.csv",
  "centers-reconciliation.csv",
] as const;

// Same catalog names and sheet mapping as the tracked legacy generator; never import it.
const SHEET_TO_STATE: Record<string, string> = {
  CDMX: "Ciudad de México",
  "ESTADO DE MEXICO": "México",
  QUERETARO: "Querétaro",
  TLAXCALA: "Tlaxcala",
  PUEBLA: "Puebla",
};
const TYPES: Array<[RegExp, string]> = [
  [/DINAMOMETRO/, "DINAMOMETRO"],
  [/FISICO/, "FISICO_MECANICA"],
  [/GASOLINA/, "GASOLINA"],
  [/DIESEL/, "DIESEL"],
  [/(?:NUMERO|NO\.?|N\.?)(?: DE)? LINEAS/, "LINEA"],
];
const MAX_FIELD = 100;
const MAX_CLIENT_LINES = 999;

function plain(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  if (typeof value === "object") {
    if ("richText" in value)
      return value.richText
        .map((v) => v.text)
        .join("")
        .trim();
    if ("text" in value) return value.text.trim();
  }
  return ""; // Dates, formula results and external links are not identifiers/counts.
}

function isFormula(value: ExcelJS.CellValue): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    ("formula" in value || "sharedFormula" in value)
  );
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function stateFor(sheet: string): { state: string; alias: boolean } {
  if (SHEET_TO_STATE[sheet])
    return {
      state: SHEET_TO_STATE[sheet],
      alias: false,
    };
  const matches = Object.entries(SHEET_TO_STATE).filter(
    ([key]) => fold(key) === fold(sheet),
  );
  return matches.length === 1
    ? { state: matches[0][1], alias: true }
    : { state: "", alias: false };
}

const SMALL = [
  "",
  "UNO",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISEIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIUNO",
  "VEINTIDOS",
  "VEINTITRES",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISEIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];
const TENS = [
  "",
  "",
  "",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];
const HUNDREDS = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

export function spanishNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > MAX_CLIENT_LINES)
    throw new Error("NUMBER_RANGE");
  if (n === 100) return "CIEN";
  if (n < 30) return SMALL[n];
  if (n < 100)
    return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` Y ${SMALL[n % 10]}` : ""}`;
  return `${HUNDREDS[Math.floor(n / 100)]}${n % 100 ? ` ${spanishNumber(n % 100)}` : ""}`;
}

interface Columns {
  header: number;
  code: number;
  company: number;
  contact: number;
  phone: number;
  email: number;
  counts: Array<{ col: number; type: string; header: string }>;
}

function columnsFor(sheet: ExcelJS.Worksheet): Columns {
  for (let n = 1; n <= Math.min(12, sheet.rowCount); n++) {
    const row = sheet.getRow(n);
    const headings = Array.from({ length: row.cellCount }, (_, i) =>
      fold(plain(row.getCell(i + 1).value)),
    );
    if (!headings.includes("CENTRO")) continue;
    const at = (re: RegExp) => headings.findIndex((h) => re.test(h)) + 1;
    const counts = headings.flatMap((header, i) => {
      const type = TYPES.find(([re]) => re.test(header))?.[1];
      return type
        ? [{ col: i + 1, type, header: plain(row.getCell(i + 1).value) }]
        : [];
    });
    const result = {
      header: n,
      code: at(/^CENTRO$/),
      company: at(/^RAZON SOCIAL/),
      contact: at(/^NOMBRE$/),
      phone: at(/TELEF/),
      email: at(/CORREO/),
      counts,
    };
    if (
      !result.company ||
      !counts.length ||
      new Set(counts.map((c) => c.type)).size !== counts.length
    )
      throw new Error("HEADER_INVALID");
    return result;
  }
  throw new Error("HEADER_MISSING");
}

type Row = string[];
type Issue = {
  sheet: string;
  row: number;
  column: string;
  category: string;
  code: string;
};

export function extract(book: ExcelJS.Workbook) {
  const clients: Row[] = [];
  const counts: Row[] = [];
  const lines: Row[] = [];
  const issues: Issue[] = [];
  const centers: Array<{
    sheet: string;
    row: number;
    code: string;
    state: string;
    fields: Array<{ type: string; column: string; count: number | null }>;
    blocked: boolean;
  }> = [];
  const excluded: Record<string, number> = { total: 0, note: 0 };
  const report = (
    sheet: string,
    row: number,
    column: string,
    category: string,
    code = "",
  ) => issues.push({ sheet, row, column, category, code });

  if (book.worksheets.length !== 5) throw new Error("SHEET_COUNT");
  for (const sheet of book.worksheets) {
    const cols = columnsFor(sheet);
    const mapping = stateFor(sheet.name);
    if (mapping.alias) report(sheet.name, 0, "", "state_alias_mapped");
    if (!mapping.state) report(sheet.name, 0, "", "state_unmapped");
    for (let n = cols.header + 1; n <= sheet.rowCount; n++) {
      const row = sheet.getRow(n);
      if (!row.hasValues) continue;
      const code = plain(row.getCell(cols.code).value);
      const company = plain(row.getCell(cols.company).value);
      const formula = cols.counts.some(({ col }) =>
        isFormula(row.getCell(col).value),
      );
      if (
        /^TOTAL\b/i.test(code) ||
        /^TOTAL\b/i.test(company) ||
        (!code && !company && formula)
      ) {
        excluded.total++;
        report(sheet.name, n, "", "total_excluded");
        continue;
      }
      const populated = cols.counts.some(
        ({ col }) => plain(row.getCell(col).value) !== "",
      );
      if (!code && !company && !populated) {
        excluded.note++;
        report(sheet.name, n, "", "note_excluded");
        continue;
      }
      const center = {
        sheet: sheet.name,
        row: n,
        code,
        state: mapping.state,
        blocked: !mapping.state,
        fields: [] as Array<{
          type: string;
          column: string;
          count: number | null;
        }>,
      };
      if (!code || !fold(code)) {
        report(sheet.name, n, "CENTRO", "missing_code", code);
        center.blocked = true;
      }
      if (!company) {
        report(sheet.name, n, "RAZON SOCIAL", "missing_company", code);
        center.blocked = true;
      }
      if (!mapping.state) center.blocked = true;
      if (code && company) {
        clients.push([
          mapping.state,
          code,
          "",
          company,
          plain(row.getCell(cols.contact).value),
          plain(row.getCell(cols.phone).value),
          plain(row.getCell(cols.email).value),
          sheet.name,
          String(n),
          "needs_review",
        ]);
      }
      for (const [index, field] of cols.counts.entries()) {
        const raw = row.getCell(field.col).value;
        const text = plain(raw);
        let count: number | null = null;
        let status = "valid";
        if (isFormula(raw)) status = "formula_count_unverified";
        else if (raw == null || text === "")
          status = index === 0 ? "blank_primary" : "blank_secondary";
        else if (
          (typeof raw === "number" && Number.isSafeInteger(raw) && raw >= 0) ||
          (typeof raw === "string" &&
            /^(0|[1-9]\d*)$/.test(text) &&
            Number.isSafeInteger(Number(text)))
        ) {
          count = Number(text);
          if (count > MAX_FIELD) {
            status = "count_capped";
            count = null;
          }
        } else status = "invalid_count";
        if (status !== "valid") {
          report(sheet.name, n, field.header, status, code);
          center.blocked = true;
        }
        center.fields.push({ type: field.type, column: field.header, count });
        counts.push([
          mapping.state,
          code,
          field.type,
          text,
          status,
          sheet.name,
          String(n),
          field.header,
        ]);
      }
      centers.push(center);
    }
  }
  const raw = new Map<string, number>();
  const normalized = new Map<string, number>();
  for (const center of centers) {
    if (!center.code) continue;
    const exact = center.code.trim();
    const key = fold(exact).replace(/ /g, "");
    raw.set(exact, (raw.get(exact) ?? 0) + 1);
    normalized.set(key, (normalized.get(key) ?? 0) + 1);
  }
  for (const center of centers) {
    if (!center.code) continue;
    const exact = center.code.trim();
    if ((raw.get(exact) ?? 0) > 1) {
      report(center.sheet, center.row, "CENTRO", "duplicate_raw", exact);
      center.blocked = true;
    }
    if ((normalized.get(fold(exact).replace(/ /g, "")) ?? 0) > 1) {
      report(center.sheet, center.row, "CENTRO", "duplicate_normalized", exact);
      center.blocked = true;
    }
  }
  const names = new Set<string>();
  for (const center of centers) {
    let ordinal = 0;
    const total = center.fields.reduce(
      (sum, field) => sum + (field.count ?? 0),
      0,
    );
    if (total > MAX_CLIENT_LINES) {
      report(center.sheet, center.row, "", "capacity_capped", center.code);
      center.blocked = true;
      continue;
    }
    for (const field of center.fields) {
      for (let i = 0; i < (field.count ?? 0); i++) {
        const name = spanishNumber(++ordinal);
        const key = `${center.state}\0${center.code}\0${name}`;
        if (names.has(key)) throw new Error("LINE_COLLISION");
        names.add(key);
        lines.push([
          center.state,
          center.code,
          name,
          `Source sheet: ${center.sheet}; count type: ${field.type}`,
          center.blocked ? "blocked" : "candidate",
          center.sheet,
          String(center.row),
          field.column,
          field.type,
        ]);
      }
    }
  }
  // Incomplete clients are retained as review candidates; downstream seed must reject them.
  const blocked = new Set(
    centers.filter((c) => c.blocked).map((c) => `${c.sheet}:${c.row}`),
  );
  for (const client of clients)
    if (blocked.has(`${client[7]}:${client[8]}`)) client[9] = "blocked";
  return { clients, counts, lines, issues, excluded, centers: centers.length };
}

async function main() {
  // Git checks are part of the runtime gate, not a substitute for exclusive writes.
  const paths = [SOURCE, ...OUTPUTS.map((name) => path.join(DIR, name))];
  for (const filename of paths) {
    try {
      execFileSync(
        "git",
        ["check-ignore", "--no-index", "-q", "--", filename],
        { stdio: "ignore" },
      );
      if (
        execFileSync("git", ["ls-files", "--", filename], {
          encoding: "utf8",
        }).trim()
      )
        throw new Error("TRACKED_PATH");
    } catch {
      throw new Error("PATH_NOT_PRIVATE");
    }
  }
  const sourceStat = await lstat(SOURCE);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink())
    throw new Error("SOURCE_UNSAFE");
  for (const output of OUTPUTS) {
    try {
      const handle = await open(
        path.join(DIR, output),
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      await handle.close();
      throw new Error("OUTPUT_OCCUPIED");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error("OUTPUT_OCCUPIED");
    }
  }
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(SOURCE);
  const data = extract(book);
  const documents = [
    toCsv(
      [
        "state",
        "code",
        "name",
        "companyName",
        "contact",
        "phone",
        "email",
        "sourceSheet",
        "sourceRow",
        "status",
      ],
      data.clients,
    ),
    toCsv(
      [
        "state",
        "code",
        "type",
        "rawCount",
        "status",
        "sourceSheet",
        "sourceRow",
        "sourceColumn",
      ],
      data.counts,
    ),
    toCsv(
      [
        "state",
        "clientCode",
        "name",
        "description",
        "status",
        "sourceSheet",
        "sourceRow",
        "sourceColumn",
        "type",
      ],
      data.lines,
    ),
    toCsv(
      ["sourceSheet", "sourceRow", "sourceColumn", "category", "clientCode"],
      data.issues.map((v) => [
        v.sheet,
        String(v.row),
        v.column,
        v.category,
        v.code,
      ]),
    ),
  ];
  for (const [index, filename] of OUTPUTS.entries()) {
    const handle = await open(
      path.join(DIR, filename),
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(documents[index], "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  const categories = Object.entries(
    data.issues.reduce<Record<string, number>>((acc, issue) => {
      acc[issue.category] = (acc[issue.category] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));
  console.log(
    JSON.stringify({
      sheets: book.worksheets.length,
      sourceRows: data.centers,
      clients: data.clients.length,
      populatedFields: data.counts.filter((c) => c[3] !== "").length,
      validCountSum: data.counts.reduce(
        (n, c) => n + (c[4] === "valid" ? Number(c[3]) : 0),
        0,
      ),
      lines: data.lines.length,
      candidateLines: data.lines.filter((l) => l[4] === "candidate").length,
      excluded: data.excluded,
      categories,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `EXTRACTION_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
