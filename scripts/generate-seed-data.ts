/**
 * Regenerate the initial-load CSVs from the source Excel workbooks.
 *
 *   npx tsx scripts/generate-seed-data.ts
 *
 * Reads (both gitignored, so this runs on demand, never at boot):
 *   initial_load/PERSONAL OPUS 2026.xlsx                        → users.csv
 *   initial_load/ListaCentrosNumerosdeLineasPorEstado ....xlsx  → clientes.csv
 *
 * Everything generated here is deterministic: re-running produces byte-identical
 * files. Credentials in particular are derived from the person's name or the
 * center's code rather than randomized, so a regeneration never silently
 * invalidates someone's login.
 *
 * Existing emails and passwords are preserved from the current users file when
 * one is present — the historical addresses do not all follow the naming rule
 * (rosario.bores, enrique.reyes), and rewriting them would lock those people out.
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseCsvBody, toCsv } from "../initial_load/csv";

const DIR = path.join(__dirname, "..", "initial_load");
const PERSONNEL_XLSX = path.join(DIR, "PERSONAL OPUS 2026.xlsx");
const CENTERS_XLSX = path.join(
  DIR,
  "ListaCentrosNumerosdeLineasPorEstado 15.06.2026.xlsx",
);
const USERS_CSV = path.join(DIR, "users.csv");
const CLIENTES_CSV = path.join(DIR, "clientes.csv");
const LEGACY_USERS_TXT = path.join(DIR, "users.txt");

const EMAIL_DOMAIN = "opusinspection.com";

/** Sheet name → the state name as it appears in the seeded State catalog. */
const SHEET_TO_STATE: Record<string, string> = {
  CDMX: "Ciudad de México",
  "ESTADO DE MEXICO": "México",
  QUERETARO: "Querétaro",
  TLAXCALA: "Tlaxcala",
  PUEBLA: "Puebla",
};

/**
 * Line-count column header → the Line type it produces.
 *
 * The workbook splits line counts differently per state: CDMX by measurement
 * rig, Querétaro and Tlaxcala by fuel, the rest a single undifferentiated
 * count. Matching on the header keeps the reader honest about which is which.
 */
const LINE_TYPE_BY_HEADER: Array<[RegExp, string]> = [
  [/DINAMOMETRO/i, "DINAMOMETRO"],
  [/FISICO/i, "FISICO_MECANICA"],
  [/GASOLINA/i, "GASOLINA"],
  [/DIESEL/i, "DIESEL"],
  [/NUMERO DE LINEAS/i, "LINEA"],
];

// ---------------------------------------------------------------------------
// Cell / text helpers
// ---------------------------------------------------------------------------

/** ExcelJS cell value → plain string (formulas, rich text and links included). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const rich = value as {
      text?: string;
      result?: unknown;
      richText?: Array<{ text: string }>;
    };
    if (Array.isArray(rich.richText)) {
      return rich.richText.map((part) => part.text).join("");
    }
    if (rich.text !== undefined) return String(rich.text);
    if (rich.result !== undefined) return String(rich.result);
    return "";
  }
  return String(value);
}

/** Collapse runs of whitespace and trim. */
function tidy(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Drop accents so names become safe email local-parts. */
function deaccent(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * A center's code with every separator removed: "IZ-13" → "IZ13",
 * "VVQ 03" → "VVQ03". This is the generic account's name, and lowercased, its
 * email local-part. `Cliente.code` keeps the official formatting.
 */
export function normalizeCode(code: string): string {
  return deaccent(code)
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

/**
 * Four stable alphanumeric characters derived from a seed string.
 *
 * Deterministic on purpose: regenerating the files must not hand everyone a new
 * password. FNV-1a is plenty here — this is throwaway initial-load material,
 * not a security boundary.
 */
function suffix(seed: string): string {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 4; i += 1) {
    out += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length) + i * 31;
  }
  return out;
}

/** The part before the "@", or the whole string when there is none. */
function localPartOf(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

/** First given name + last surname, e.g. "Adrián Pérez Sánchez" → adrian.sanchez. */
function emailLocalPart(fullName: string): string {
  const words = deaccent(tidy(fullName))
    .split(" ")
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);
  if (words.length === 0) return "usuario";
  if (words.length === 1) return words[0].toLowerCase();
  return `${words[0]}.${words[words.length - 1]}`.toLowerCase();
}

// ---------------------------------------------------------------------------
// Personnel
// ---------------------------------------------------------------------------

interface StaffRow {
  name: string;
  email: string;
  password: string;
  role: string;
  jobPosition: string;
}

/**
 * Credentials already issued, keyed by person name.
 *
 * Read from whichever users file exists so a regeneration is non-destructive:
 * three of the historical addresses do not follow the naming rule, and every
 * password predates this script.
 */
function loadExistingCredentials(): Map<
  string,
  { email: string; password: string }
> {
  const existing = new Map<string, { email: string; password: string }>();

  if (fs.existsSync(USERS_CSV)) {
    for (const [name, email, password] of parseCsvBody(
      fs.readFileSync(USERS_CSV, "utf8"),
    )) {
      if (name) existing.set(tidy(name), { email, password });
    }
    return existing;
  }

  // Fall back to the pre-CSV tab-separated file, once.
  if (fs.existsSync(LEGACY_USERS_TXT)) {
    for (const line of fs
      .readFileSync(LEGACY_USERS_TXT, "utf8")
      .split(/\r?\n/)) {
      if (!line.trim() || line.startsWith("#")) continue;
      const [name, email, password] = line.split("\t");
      if (name) existing.set(tidy(name), { email, password });
    }
  }

  return existing;
}

/** Read one personnel sheet: `[N.P., NAME, PUESTO?]` under a header row. */
function readPersonnelSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
): Array<{ name: string; jobPosition: string }> {
  const sheet = workbook.getWorksheet(sheetName);
  if (!sheet)
    throw new Error(`Falta la hoja "${sheetName}" en el Excel de personal`);

  const people: Array<{ name: string; jobPosition: string }> = [];
  let seenHeader = false;

  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells = [1, 2, 3].map((col) =>
      tidy(cellText(row.getCell(col).value)),
    );
    const [index, name, position] = cells;

    // The header is the row whose first cell reads "N.P."; data starts after it.
    if (!seenHeader) {
      if (/^N\.?P\.?$/i.test(index)) seenHeader = true;
      return;
    }
    // Data rows are numbered; anything else is a spacer or a stray note.
    if (!/^\d+$/.test(index) || !name) return;

    people.push({ name, jobPosition: position });
  });

  return people;
}

function buildStaff(workbook: ExcelJS.Workbook): StaffRow[] {
  const existing = loadExistingCredentials();

  // Later sources win, so a person listed both as FSR and in the management
  // group ends up an administrator with their real job title.
  const byName = new Map<
    string,
    { name: string; role: string; jobPosition: string }
  >();

  const add = (name: string, role: string, jobPosition: string) => {
    byName.set(tidy(name), { name: tidy(name), role, jobPosition });
  };

  for (const person of readPersonnelSheet(workbook, "FSR")) {
    add(person.name, "FSR", "FSR - Field Service Representative");
  }
  for (const person of readPersonnelSheet(workbook, "ADMINISTRATIVO")) {
    add(person.name, "ADMINISTRADOR", person.jobPosition || "ADMINISTRATIVO");
  }
  for (const person of readPersonnelSheet(workbook, "GRUPO GERENCIAL")) {
    add(person.name, "ADMINISTRADOR", person.jobPosition || "GERENCIAL");
  }

  // The system owner is not in the workbook.
  add("Enrique Abdiel Reyes Rodriguez", "ADMINISTRADOR", "ADMINISTRADOR");

  const takenEmails = new Set<string>();
  const rows: StaffRow[] = [];

  for (const person of byName.values()) {
    const known = existing.get(person.name);

    // Keep the historical local-part — three of them predate the naming rule
    // (rosario.bores, enrique.reyes) — but always re-attach the current domain,
    // so changing EMAIL_DOMAIN actually takes effect instead of being pinned by
    // whatever the previous file said.
    let email = known?.email
      ? `${localPartOf(known.email)}@${EMAIL_DOMAIN}`
      : "";
    if (!email) {
      const base = emailLocalPart(person.name);
      let local = base;
      let n = 2;
      while (takenEmails.has(`${local}@${EMAIL_DOMAIN}`)) {
        local = `${base}${n}`;
        n += 1;
      }
      email = `${local}@${EMAIL_DOMAIN}`;
    }
    takenEmails.add(email);

    const firstName = deaccent(tidy(person.name).split(" ")[0]);
    const password = known?.password ?? `${firstName}${suffix(person.name)}`;

    rows.push({ ...person, email, password });
  }

  // Administrators first, then alphabetical — makes the file easy to scan.
  rows.sort((a, b) =>
    a.role === b.role
      ? a.name.localeCompare(b.name, "es")
      : a.role === "ADMINISTRADOR"
        ? -1
        : 1,
  );

  return rows;
}

// ---------------------------------------------------------------------------
// Centers
// ---------------------------------------------------------------------------

interface ClienteRow {
  state: string;
  code: string;
  razonSocial: string;
  lines: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  clientUser: string;
  clientEmail: string;
  clientPassword: string;
}

interface CenterColumns {
  headerRow: number;
  code: number;
  razon: number;
  contactName: number;
  contactPhone: number;
  contactEmail: number;
  lines: Array<{ col: number; type: string }>;
}

/**
 * Locate the header row and map columns by their text.
 *
 * The header sits on row 4 or 5 depending on the sheet and the line-count
 * columns differ per state, so nothing here is positional beyond what the
 * header itself declares.
 */
function mapCenterColumns(sheet: ExcelJS.Worksheet): CenterColumns {
  let headerRow = -1;
  const headers: string[] = [];

  for (let r = 1; r <= Math.min(sheet.rowCount, 12); r += 1) {
    const row = sheet.getRow(r);
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      cells.push(tidy(cellText(cell.value)));
    });
    if (cells.some((c) => /^CENTRO$/i.test(c))) {
      headerRow = r;
      headers.push(...cells);
      break;
    }
  }

  if (headerRow === -1) {
    throw new Error(`No se encontró la fila de encabezados en "${sheet.name}"`);
  }

  const find = (pattern: RegExp): number => {
    const index = headers.findIndex((h) => pattern.test(h));
    return index === -1 ? -1 : index + 1; // ExcelJS columns are 1-based
  };

  const lines: Array<{ col: number; type: string }> = [];
  headers.forEach((header, index) => {
    for (const [pattern, type] of LINE_TYPE_BY_HEADER) {
      if (pattern.test(header)) {
        lines.push({ col: index + 1, type });
        break;
      }
    }
  });

  const columns: CenterColumns = {
    headerRow,
    code: find(/^CENTRO$/i),
    razon: find(/RAZON SOCIAL/i),
    contactName: find(/^NOMBRE$/i),
    contactPhone: find(/TELEF/i),
    contactEmail: find(/CORREO/i),
    lines,
  };

  if (columns.code === -1 || columns.razon === -1) {
    throw new Error(`Encabezados incompletos en "${sheet.name}"`);
  }

  return columns;
}

function readCenters(workbook: ExcelJS.Workbook): ClienteRow[] {
  const rows: ClienteRow[] = [];
  const seenCodes = new Set<string>();

  for (const [sheetName, stateName] of Object.entries(SHEET_TO_STATE)) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet)
      throw new Error(`Falta la hoja "${sheetName}" en el Excel de centros`);

    const columns = mapCenterColumns(sheet);

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= columns.headerRow) return;

      const code = tidy(cellText(row.getCell(columns.code).value));
      const razon = tidy(cellText(row.getCell(columns.razon).value));
      if (!code || !razon) return;
      // Guard against a repeated banner row.
      if (/^CENTRO/i.test(code)) return;

      const lines = columns.lines
        .map(({ col, type }) => {
          const count = Number.parseInt(
            tidy(cellText(row.getCell(col).value)),
            10,
          );
          return Number.isFinite(count) && count > 0 ? `${type}:${count}` : "";
        })
        .filter(Boolean)
        .join(";");

      const normalized = normalizeCode(code);
      if (seenCodes.has(normalized)) {
        throw new Error(
          `Código de centro duplicado tras normalizar: "${code}" → ${normalized}`,
        );
      }
      seenCodes.add(normalized);

      rows.push({
        state: stateName,
        code,
        razonSocial: razon,
        lines,
        contactName: tidy(cellText(row.getCell(columns.contactName).value)),
        contactPhone: tidy(cellText(row.getCell(columns.contactPhone).value)),
        contactEmail: tidy(
          cellText(row.getCell(columns.contactEmail).value),
        ).toLowerCase(),
        // One generic account per center; the people behind it type their own
        // name into each incident instead of having individual logins.
        clientUser: normalized,
        clientEmail: `${normalized.toLowerCase()}@${EMAIL_DOMAIN}`,
        clientPassword: `${normalized}${suffix(normalized)}`,
      });
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  for (const file of [PERSONNEL_XLSX, CENTERS_XLSX]) {
    if (!fs.existsSync(file)) {
      throw new Error(`No se encontró el archivo fuente: ${file}`);
    }
  }

  const personnel = new ExcelJS.Workbook();
  await personnel.xlsx.readFile(PERSONNEL_XLSX);
  const staff = buildStaff(personnel);

  const centersBook = new ExcelJS.Workbook();
  await centersBook.xlsx.readFile(CENTERS_XLSX);
  const centers = readCenters(centersBook);

  fs.writeFileSync(
    USERS_CSV,
    toCsv(
      ["name", "email", "password", "role", "jobPosition"],
      staff.map((s) => [s.name, s.email, s.password, s.role, s.jobPosition]),
    ),
    "utf8",
  );

  fs.writeFileSync(
    CLIENTES_CSV,
    toCsv(
      [
        "state",
        "code",
        "razonSocial",
        "lines",
        "contactName",
        "contactPhone",
        "contactEmail",
        "clientUser",
        "clientEmail",
        "clientPassword",
      ],
      centers.map((c) => [
        c.state,
        c.code,
        c.razonSocial,
        c.lines,
        c.contactName,
        c.contactPhone,
        c.contactEmail,
        c.clientUser,
        c.clientEmail,
        c.clientPassword,
      ]),
    ),
    "utf8",
  );

  const admins = staff.filter((s) => s.role === "ADMINISTRADOR").length;
  const fsrs = staff.filter((s) => s.role === "FSR").length;
  const lineTotal = centers.reduce(
    (sum, c) =>
      sum +
      c.lines
        .split(";")
        .filter(Boolean)
        .reduce((n, pair) => n + Number(pair.split(":")[1] ?? 0), 0),
    0,
  );

  console.log(
    `✅ users.csv    → ${staff.length} personas (${admins} admin, ${fsrs} FSR)`,
  );
  console.log(
    `✅ clientes.csv → ${centers.length} centros, ${lineTotal} líneas, ${centers.length} usuarios CLIENT`,
  );
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
