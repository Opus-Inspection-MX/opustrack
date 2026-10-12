/** One-shot offline writer; never reads credentials or connects to a database. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import { EQUIPMENT_HEADER, LINE_HEADER } from "./derive-center-candidates-v2";
import {
  CLIENT_HEADER,
  deriveClientCandidatesV2,
} from "./derive-client-candidates-v2";

const dir = path.resolve("initial_load");
const inputs = [
  "clientes.csv",
  "line-candidates-v2.csv",
  "equipment-candidates-cdmx.csv",
];
const output = path.join(dir, "clientes-v2.csv");
const fail = (code: string): never => {
  throw new Error(code);
};
const hash = (buffer: Buffer) =>
  createHash("sha256").update(buffer).digest("hex");

async function privatePath(filename: string, exists: boolean): Promise<void> {
  try {
    execFileSync("git", ["check-ignore", "--no-index", "-q", "--", filename], {
      stdio: "ignore",
    });
    if (
      execFileSync("git", ["ls-files", "--", filename], {
        encoding: "utf8",
      }).trim()
    )
      fail("TRACKED_PATH");
  } catch {
    fail("PATH_NOT_PRIVATE");
  }
  try {
    const stat = await lstat(filename);
    if (
      !exists ||
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      (stat.mode & 0o777) !== 0o600
    )
      fail("PATH_UNSAFE");
  } catch (error) {
    if (exists || (error as NodeJS.ErrnoException).code !== "ENOENT")
      fail("PATH_UNSAFE");
  }
}

async function main() {
  const paths = inputs.map((name) => path.join(dir, name));
  for (const filename of [...paths, output])
    await privatePath(filename, filename !== output);
  const raw = await Promise.all(paths.map((filename) => readFile(filename)));
  const hashes = raw.map(hash);
  const tables = raw.map((buffer) => {
    const [header, ...rows] = parseCsv(buffer.toString("utf8"));
    if (!header) fail("CSV_EMPTY");
    return { header, rows };
  });
  if (
    tables[1].header.join("\0") !== LINE_HEADER.join("\0") ||
    tables[2].header.join("\0") !== EQUIPMENT_HEADER.join("\0")
  )
    fail("LINK_HEADER_INVALID");
  const rows = deriveClientCandidatesV2(tables[0], tables[1], tables[2]);
  if (
    rows.length !== 106 ||
    tables[1].rows.length !== 327 ||
    tables[2].rows.length !== 147
  )
    fail("BASELINE_MISMATCH");
  for (let i = 0; i < paths.length; i++) {
    if (hash(await readFile(paths[i])) !== hashes[i]) fail("SOURCE_CHANGED");
    await privatePath(paths[i], true);
  }
  await privatePath(output, false);
  const handle = await open(
    output,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(toCsv(CLIENT_HEADER, rows), "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await privatePath(output, true);
  const [header, ...written] = parseCsv(await readFile(output, "utf8"));
  if (
    header?.join("\0") !== CLIENT_HEADER.join("\0") ||
    written.length !== 106 ||
    written.some(
      (row, index) =>
        row.length !== CLIENT_HEADER.length ||
        row.some((field, column) => field !== rows[index]?.[column]) ||
        row.some(
          (field, column) =>
            column !== 2 && field !== tables[0].rows[index]?.[column],
        ) ||
        row[2] !== tables[0].rows[index]?.[1],
    )
  )
    fail("READBACK_INVALID");
  console.log(
    JSON.stringify({
      clients: rows.length,
      lines: tables[1].rows.length,
      equipment: tables[2].rows.length,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `CLIENT_V2_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
