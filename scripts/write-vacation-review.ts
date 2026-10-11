/** One-shot local writer; never loads a database or workbook. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { type FileHandle, lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, toCsv } from "../initial_load/csv";
import { type CsvTable, deriveVacationReview } from "./derive-vacation-review";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GIT = "/usr/bin/git";
const SOURCE = "vacation-balances.csv";
const USERS = "users.csv";
const OUTPUT = "vacation-review.csv";
const hash = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

function sameFile(
  a: { dev: number; ino: number },
  b: { dev: number; ino: number },
) {
  return a.dev === b.dev && a.ino === b.ino;
}

async function pinnedRead(file: FileHandle): Promise<Buffer> {
  const stat = await file.stat();
  if (!stat.isFile() || (stat.mode & 0o777) !== 0o600 || stat.size > 8_000_000)
    throw new Error("PATH_UNSAFE");
  const result = Buffer.alloc(stat.size);
  let offset = 0;
  while (offset < result.length) {
    const { bytesRead } = await file.read(
      result,
      offset,
      result.length - offset,
      offset,
    );
    if (!bytesRead) throw new Error("SOURCE_CHANGED");
    offset += bytesRead;
  }
  const after = await file.stat();
  if (
    !sameFile(stat, after) ||
    stat.size !== after.size ||
    stat.mtimeMs !== after.mtimeMs
  )
    throw new Error("SOURCE_CHANGED");
  return result;
}

/** Linux /proc/self/fd binds all file operations to the held parent inode. */
export async function openPrivateWorkspace(root: string) {
  let rootHandle: FileHandle | undefined;
  let parent: FileHandle | undefined;
  let gitDir: FileHandle | undefined;
  try {
    if (path.resolve(root) !== root || (await realpath(root)) !== root)
      throw new Error("PATH_UNSAFE");
    rootHandle = await open(
      root,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const rootStat = await rootHandle.stat();
    if (!rootStat.isDirectory()) throw new Error("PATH_UNSAFE");
    parent = await open(
      `/proc/self/fd/${rootHandle.fd}/initial_load`,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    gitDir = await open(
      `/proc/self/fd/${rootHandle.fd}/.git`,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
    );
    const parentStat = await parent.stat();
    const gitStat = await gitDir.stat();
    if (!parentStat.isDirectory() || !gitStat.isDirectory())
      throw new Error("PATH_UNSAFE");
    const projectHandle = rootHandle;
    const parentHandle = parent;
    const gitHandle = gitDir;
    const gitPath = path.join(root, ".git");
    const dirPath = path.join(root, "initial_load");
    const verifyParent = async () => {
      const [currentRoot, currentParent, currentGit] = await Promise.all([
        lstat(root),
        lstat(dirPath),
        lstat(gitPath),
      ]);
      if (
        !sameFile(rootStat, currentRoot) ||
        !sameFile(parentStat, currentParent) ||
        !sameFile(gitStat, currentGit) ||
        !currentParent.isDirectory() ||
        !currentGit.isDirectory() ||
        !sameFile(parentStat, await parentHandle.stat())
      )
        throw new Error("PARENT_CHANGED");
    };
    await verifyParent();
    // Never inherit Git's repo/index/config selectors. --git-dir and --work-tree
    // bind these checks to this repository even when cwd or PATH is hostile.
    const env = {
      NODE_ENV: process.env.NODE_ENV ?? "production",
      PATH: "/usr/bin:/bin",
      GIT_INDEX_FILE: path.join(gitPath, "index"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_COUNT: "0",
    };
    const git = (args: string[]) =>
      execFileSync(
        GIT,
        [
          "--no-optional-locks",
          `--git-dir=${gitPath}`,
          `--work-tree=${root}`,
          "-c",
          "core.excludesFile=/dev/null",
          ...args,
        ],
        {
          cwd: root,
          env,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
    const relative = (name: string) => `initial_load/${name}`;
    const check = async (name: string, present: boolean) => {
      if (![SOURCE, USERS, OUTPUT].includes(name))
        throw new Error("PATH_UNSAFE");
      await verifyParent();
      let ignore: string;
      try {
        ignore = git([
          "check-ignore",
          "--no-index",
          "-v",
          "--",
          relative(name),
        ]);
      } catch {
        throw new Error("PATH_NOT_PRIVATE");
      }
      // Reject matches from global or repo-info excludes: only the root rule counts.
      if (!ignore.startsWith(".gitignore:"))
        throw new Error("PATH_NOT_PRIVATE");
      let tracked: string;
      try {
        tracked = git(["ls-files", "--", relative(name)]);
      } catch {
        throw new Error("PATH_NOT_PRIVATE");
      }
      if (tracked.trim()) throw new Error("TRACKED_PATH");
      await verifyParent();
      const filePath = `/proc/self/fd/${parentHandle.fd}/${name}`;
      const metadata = await lstat(filePath).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw new Error("PATH_UNSAFE");
          return null;
        },
      );
      if (
        present
          ? !metadata?.isFile() ||
            metadata.isSymbolicLink() ||
            (metadata.mode & 0o777) !== 0o600
          : metadata !== null
      )
        throw new Error("PATH_UNSAFE");
      return metadata;
    };
    const read = async (name: typeof SOURCE | typeof USERS) => {
      const metadata = await check(name, true);
      const handle = await open(
        `/proc/self/fd/${parentHandle.fd}/${name}`,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      try {
        const stat = await handle.stat();
        if (!metadata || !sameFile(metadata, stat))
          throw new Error("SOURCE_CHANGED");
        const contents = await pinnedRead(handle);
        await verifyParent();
        return { handle, contents, digest: hash(contents) };
      } catch (error) {
        await handle.close();
        throw error;
      }
    };
    const write = async (document: string) => {
      await check(OUTPUT, false);
      // O_EXCL protects the final component; /proc/self/fd pins every parent.
      const handle = await open(
        `/proc/self/fd/${parentHandle.fd}/${OUTPUT}`,
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
      await parentHandle.sync();
      await verifyParent();
      await check(OUTPUT, true);
    };
    return {
      check,
      read,
      write,
      verifyParent,
      close: async () => {
        await gitHandle.close();
        await parentHandle.close();
        await projectHandle.close();
      },
    };
  } catch (error) {
    await gitDir?.close();
    await parent?.close();
    await rootHandle?.close();
    // Never expose paths, environment, source fields or child-process errors.
    throw new Error(
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : "PATH_UNSAFE",
    );
  }
}

function table(bytes: Buffer): CsvTable {
  const [header, ...rows] = parseCsv(bytes.toString("utf8"));
  if (!header) throw new Error("SOURCE_SCHEMA_INVALID");
  return { header, rows };
}

export async function writeVacationReview(root = ROOT) {
  if (process.argv.length !== 2) throw new Error("ARGUMENTS_INVALID");
  const workspace = await openPrivateWorkspace(root);
  let sourceFile: Awaited<ReturnType<typeof workspace.read>> | undefined;
  let userFile: Awaited<ReturnType<typeof workspace.read>> | undefined;
  try {
    sourceFile = await workspace.read(SOURCE);
    userFile = await workspace.read(USERS);
    await workspace.check(OUTPUT, false);
    const sourceBytes = sourceFile.contents;
    const userBytes = userFile.contents;
    const sourceHash = sourceFile.digest;
    const usersHash = userFile.digest;
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
    await workspace.check(SOURCE, true);
    await workspace.check(USERS, true);
    await workspace.check(OUTPUT, false);
    if (
      hash(await pinnedRead(sourceFile.handle)) !== sourceHash ||
      hash(await pinnedRead(userFile.handle)) !== usersHash
    )
      throw new Error("SOURCE_CHANGED");
    await workspace.write(document);
    if (
      hash(await pinnedRead(sourceFile.handle)) !== sourceHash ||
      hash(await pinnedRead(userFile.handle)) !== usersHash
    )
      throw new Error("SOURCE_CHANGED");
    await workspace.verifyParent();
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
  } finally {
    await userFile?.handle.close();
    await sourceFile?.handle.close();
    await workspace.close();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  writeVacationReview().catch((error) => {
    console.error(
      `VACATION_REVIEW_FAILED:${error instanceof Error && /^[A-Z_]+$/.test(error.message) ? error.message : "UNEXPECTED"}`,
    );
    process.exitCode = 1;
  });
}
