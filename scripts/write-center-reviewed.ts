/** Exclusive local-only writer for user-reviewed zero interpretations. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import {
  deriveCenterReviewed,
  REVIEWED_COUNT_HEADER,
  REVIEWED_RECONCILIATION_HEADER,
} from "./derive-center-reviewed";
import { CLIENT_HEADER } from "./derive-client-candidates-v2";

const dir = path.resolve("initial_load");
const inputs = [
  "line-counts.csv",
  "centers-reconciliation.csv",
  "clientes-v2.csv",
  "line-candidates-v2.csv",
  "equipment-candidates-cdmx.csv",
];
const outputs = [
  "line-counts-reviewed.csv",
  "clientes-v3.csv",
  "line-candidates-v3.csv",
  "equipment-candidates-cdmx-v2.csv",
  "centers-reconciliation-reviewed.csv",
];
const hash = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

async function privatePath(filename: string, present: boolean) {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", "--", filename], {
      stdio: "ignore",
    });
    if (
      execFileSync("git", ["ls-files", "--", filename], {
        encoding: "utf8",
      }).trim()
    )
      throw new Error("TRACKED");
  } catch {
    throw new Error("PATH_NOT_PRIVATE");
  }
  let stat: Stats | undefined;
  try {
    stat = await lstat(filename);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
      throw new Error("PATH_UNSAFE");
  }
  if (
    present
      ? !stat ||
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (stat.mode & 0o777) !== 0o600
      : Boolean(stat)
  )
    throw new Error("PATH_UNSAFE");
}

async function main() {
  const sources = inputs.map((name) => path.join(dir, name));
  const targets = outputs.map((name) => path.join(dir, name));
  for (const filename of sources) await privatePath(filename, true);
  for (const filename of targets) await privatePath(filename, false);
  const buffers = await Promise.all(
    sources.map((filename) => readFile(filename)),
  );
  const hashes = buffers.map(hash);
  const tables = buffers.map((buffer) => {
    const [header, ...rows] = parseCsv(buffer.toString("utf8"));
    if (!header) throw new Error("CSV_EMPTY");
    return { header, rows };
  });
  const result = deriveCenterReviewed(
    tables[2],
    tables[0],
    tables[1],
    tables[3],
    tables[4],
  );
  const category = (name: string) =>
    result.reconciliation.filter((row) => row[3] === name).length;
  const blankTypes = (state: string, type: string) =>
    tables[0].rows.filter(
      (row) =>
        row[0] === state && row[2] === type && row[4].startsWith("blank_"),
    ).length;
  if (
    result.clients.length !== 106 ||
    result.counts.length !== 181 ||
    result.counts.filter((row) => row[4] === "valid").length !== 120 ||
    category("resolved_zero_by_user") !== 61 ||
    category("total_excluded") !== 5 ||
    category("note_excluded") !== 1 ||
    result.reconciliation.length !== 67 ||
    blankTypes("Ciudad de México", "DINAMOMETRO") !== 2 ||
    blankTypes("Ciudad de México", "FISICO_MECANICA") !== 23 ||
    blankTypes("Querétaro", "DIESEL") !== 18 ||
    blankTypes("Tlaxcala", "DIESEL") !== 18 ||
    result.lines.length !== 327 ||
    result.equipment.length !== 147 ||
    result.lines.some((row) => row[4] !== "candidate") ||
    result.clients.some((row) => row[9] !== "needs_review")
  )
    throw new Error("BASELINE_MISMATCH");
  const documents = [
    toCsv(REVIEWED_COUNT_HEADER, result.counts),
    toCsv(CLIENT_HEADER, result.clients),
    toCsv(LINE_HEADER, result.lines),
    toCsv(EQUIPMENT_HEADER, result.equipment),
    toCsv(REVIEWED_RECONCILIATION_HEADER, result.reconciliation),
  ];
  for (let i = 0; i < sources.length; i++) {
    await privatePath(sources[i], true);
    if (hash(await readFile(sources[i])) !== hashes[i])
      throw new Error("SOURCE_CHANGED");
  }
  for (const filename of targets) await privatePath(filename, false);
  for (let i = 0; i < targets.length; i++) {
    const handle = await open(
      targets[i],
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await handle.writeFile(documents[i], "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await privatePath(targets[i], true);
    const [header, ...rows] = parseCsv(await readFile(targets[i], "utf8"));
    const expected = parseCsv(documents[i]);
    if (
      header?.join("\0") !== expected[0].join("\0") ||
      rows.length !== expected.length - 1 ||
      rows.some(
        (row, index) =>
          row.length !== header.length ||
          row.join("\0") !== expected[index + 1].join("\0"),
      )
    )
      throw new Error("READBACK_INVALID");
  }
  for (let i = 0; i < sources.length; i++)
    if (hash(await readFile(sources[i])) !== hashes[i])
      throw new Error("SOURCE_CHANGED");
  console.log(
    JSON.stringify({
      clients: result.clients.length,
      countFields: result.counts.length,
      reviewedZero: category("resolved_zero_by_user"),
      lines: result.lines.length,
      syntheticEquipment: result.equipment.length,
      exclusions: 6,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `REVIEWED_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
