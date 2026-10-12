/** Offline, additive writer. Never reads credentials or connects to a database. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import {
  deriveCenterCandidatesV2,
  EQUIPMENT_HEADER,
  LINE_HEADER,
} from "./derive-center-candidates-v2";

const dir = path.resolve("initial_load");
const inputs = [
  "clientes.csv",
  "line-counts.csv",
  "line-candidates.csv",
  "centers-reconciliation.csv",
];
const outputs = ["line-candidates-v2.csv", "equipment-candidates-cdmx.csv"];
const fail = (code: string): never => {
  throw new Error(code);
};
const digest = (data: Buffer) =>
  createHash("sha256").update(data).digest("hex");

async function safePath(name: string, exists: boolean) {
  const filename = path.join(dir, name);
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
  return filename;
}

async function main() {
  const inputPaths = await Promise.all(
    inputs.map((name) => safePath(name, true)),
  );
  const outputPaths = await Promise.all(
    outputs.map((name) => safePath(name, false)),
  );
  const raw = await Promise.all(inputPaths.map((name) => readFile(name)));
  const hashes = raw.map(digest);
  const tables = raw.map((buffer) => {
    const [header, ...rows] = parseCsv(buffer.toString("utf8"));
    if (!header) fail("CSV_EMPTY");
    return { header, rows };
  });
  const result = deriveCenterCandidatesV2(tables[0], tables[1], tables[2]);
  const old = tables[2].rows;
  if (
    old.length !== 327 ||
    old.filter((row) => row[4] === "candidate").length !== 190 ||
    old.filter((row) => row[4] === "blocked").length !== 137 ||
    result.lines.length !== old.length ||
    result.lines.filter((row) => row[4] === "candidate").length !== 190 ||
    result.lines.filter((row) => row[4] === "blocked").length !== 137 ||
    result.equipment.length !==
      result.lines.filter(
        (row) => row[0] === "Ciudad de México" && row[8] === "DINAMOMETRO",
      ).length
  )
    fail("BASELINE_MISMATCH");
  if (
    tables[3].header.join("\0") !==
      [
        "sourceSheet",
        "sourceRow",
        "sourceColumn",
        "category",
        "clientCode",
      ].join("\0") ||
    tables[3].rows.length !== 67 ||
    tables[1].rows.length !== 181 ||
    tables[0].rows.length !== 106
  )
    fail("EVIDENCE_MISMATCH");
  const documents = [
    toCsv(LINE_HEADER, result.lines),
    toCsv(EQUIPMENT_HEADER, result.equipment),
  ];
  for (let i = 0; i < inputPaths.length; i++)
    if (digest(await readFile(inputPaths[i])) !== hashes[i])
      fail("SOURCE_CHANGED");
  for (let i = 0; i < outputPaths.length; i++) {
    const handle = await open(
      outputPaths[i],
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
  }
  console.log(
    JSON.stringify({
      lines: result.lines.length,
      eligible: result.lines.filter((row) => row[4] === "candidate").length,
      blocked: result.lines.filter((row) => row[4] === "blocked").length,
      equipment: result.equipment.length,
    }),
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(
      `CANDIDATES_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
