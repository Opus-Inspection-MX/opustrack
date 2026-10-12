/** Offline exclusive writer for the new CDMX synthetic Equipment candidate version. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import { deriveCdmxEquipmentV3 } from "./derive-cdmx-equipment-v3";
import { EQUIPMENT_HEADER } from "./derive-center-candidates-v2";

const sources = [
  "initial_load/line-candidates-v3.csv",
  "initial_load/clientes-v3.csv",
  "initial_load/equipment-candidates-cdmx-v2.csv",
];
const target = "initial_load/equipment-candidates-cdmx-v3.csv";
const digest = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");

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

function table(data: Buffer) {
  const text = data.toString("utf8");
  const parsed = parseCsv(text);
  const [header, ...rows] = parsed;
  if (!header || toCsv(header, rows) !== text) throw new Error("CSV_INVALID");
  return { header, rows };
}

async function main() {
  for (const filename of sources) await privatePath(filename, true);
  await privatePath(target, false);
  const input = await Promise.all(
    sources.map((filename) => readFile(filename)),
  );
  const hashes = input.map(digest);
  const [lines, clients, equipment] = input.map(table);
  const result = deriveCdmxEquipmentV3(clients, lines, equipment);
  if (
    result.dynamometers !== 147 ||
    result.physical === 0 ||
    result.rows.length !== result.dynamometers + result.physical
  )
    throw new Error("BASELINE_MISMATCH");
  const document = toCsv(EQUIPMENT_HEADER, result.rows);
  for (let i = 0; i < sources.length; i++) {
    await privatePath(sources[i], true);
    if (digest(await readFile(sources[i])) !== hashes[i])
      throw new Error("SOURCE_CHANGED");
  }
  await privatePath(target, false);
  const handle = await open(
    target,
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
  await privatePath(target, true);
  const readback = await readFile(target);
  const verified = table(readback);
  if (
    readback.toString("utf8") !== document ||
    verified.rows.length !== result.rows.length
  )
    throw new Error("READBACK_INVALID");
  for (let i = 0; i < sources.length; i++)
    if (digest(await readFile(sources[i])) !== hashes[i])
      throw new Error("SOURCE_CHANGED");
  console.log(
    JSON.stringify({
      dynamometers: result.dynamometers,
      physicalMechanical: result.physical,
      total: result.rows.length,
      mode: "0600",
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `EQUIPMENT_V3_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
