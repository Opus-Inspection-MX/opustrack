/** One-shot local writer; never loads a database or workbook. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import { type CsvTable, deriveVacationReview } from "./derive-vacation-review";

const source = path.resolve("initial_load/vacation-balances.csv");
const users = path.resolve("initial_load/users.csv");
const output = path.resolve("initial_load/vacation-review.csv");
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

async function privatePath(filename: string, present: boolean) {
  execFileSync("git", ["check-ignore", "-q", "--", filename], {
    stdio: "ignore",
  });
  if (
    execFileSync("git", ["ls-files", "--", filename], {
      encoding: "utf8",
    }).trim()
  )
    throw new Error("TRACKED_PATH");
  const stat = await lstat(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw new Error("PATH_UNSAFE");
    return null;
  });
  if (
    present
      ? !stat?.isFile() ||
        stat.isSymbolicLink() ||
        (stat.mode & 0o777) !== 0o600
      : stat !== null
  )
    throw new Error("PATH_UNSAFE");
}

function table(bytes: Buffer): CsvTable {
  const [header, ...rows] = parseCsv(bytes.toString("utf8"));
  if (!header) throw new Error("SOURCE_SCHEMA_INVALID");
  return { header, rows };
}

async function main() {
  if (process.argv.length !== 2) throw new Error("ARGUMENTS_INVALID");
  await privatePath(source, true);
  await privatePath(users, true);
  await privatePath(output, false);
  const sourceBytes = await readFile(source);
  const userBytes = await readFile(users);
  const sourceHash = hash(sourceBytes);
  const usersHash = hash(userBytes);
  const derived = deriveVacationReview(
    table(sourceBytes),
    table(userBytes),
    sourceHash,
  );
  const rows = derived.rows;
  if (
    rows.length !== 145 ||
    rows.filter((row) => row[6] === "unmatched").length !== 23 ||
    rows.filter((row) => row[7] === "partial").length !== 25 ||
    rows.filter((row) => row[7] === "inconsistent").length !== 3 ||
    rows.filter((row) => row[8] === "ambiguous").length === 0 ||
    rows.filter((row) => row[4]).length !== 122 ||
    new Set(rows.map((row) => row[4]).filter(Boolean)).size !== 18 ||
    rows.some((row) => row[10] !== "PENDING" || row[11] !== "false")
  )
    throw new Error("BASELINE_MISMATCH");
  const document = toCsv(derived.header, rows);
  await privatePath(source, true);
  await privatePath(users, true);
  await privatePath(output, false);
  if (
    hash(await readFile(source)) !== sourceHash ||
    hash(await readFile(users)) !== usersHash
  )
    throw new Error("SOURCE_CHANGED");
  const handle = await open(
    output,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(document, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  const directory = await open(
    path.dirname(output),
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
  await privatePath(output, true);
  if (
    hash(await readFile(source)) !== sourceHash ||
    hash(await readFile(users)) !== usersHash
  )
    throw new Error("SOURCE_CHANGED");
  console.log(
    JSON.stringify({
      rows: rows.length,
      proposed: 122,
      unmatched: 23,
      partial: 25,
      inconsistent: 3,
      ambiguousHireRows: rows.filter((row) => row[8] === "ambiguous").length,
      importApproved: 0,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `VACATION_REVIEW_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
