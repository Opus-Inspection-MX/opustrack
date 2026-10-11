import { execFileSync } from "node:child_process";
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { openPrivateWorkspace } from "./write-vacation-review";

const output = "vacation-review.csv";
const aggregate = '{"rows":2,"pending":2}\n';

async function withFixture(
  test: (fixture: { base: string; root: string; dir: string }) => Promise<void>,
) {
  const base = await mkdtemp("/tmp/opencode/vacation-writer-");
  try {
    const root = path.join(base, "repo");
    const dir = path.join(root, "initial_load");
    await mkdir(root);
    execFileSync("/usr/bin/git", ["init", "-q", root], { stdio: "ignore" });
    await mkdir(dir);
    await writeFile(path.join(root, ".gitignore"), "/initial_load/*.csv\n");
    for (const name of ["users.csv", "vacation-balances.csv"]) {
      await writeFile(path.join(dir, name), '"synthetic"\n', { mode: 0o600 });
    }
    await test({ base, root, dir });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

async function expectAbsent(filename: string) {
  await expect(lstat(filename)).rejects.toMatchObject({ code: "ENOENT" });
}

it("uses its own Git repository and index despite hostile PATH and Git selectors", async () => {
  await withFixture(async ({ base, root, dir }) => {
    const fakeBin = path.join(base, "bin");
    await mkdir(fakeBin);
    const marker = path.join(base, "fake-git-ran");
    await writeFile(
      path.join(fakeBin, "git"),
      `#!/usr/bin/node\nrequire("fs").writeFileSync(${JSON.stringify(marker)}, "ran");\n`,
      { mode: 0o700 },
    );
    const selectors = [
      "PATH",
      "GIT_DIR",
      "GIT_WORK_TREE",
      "GIT_INDEX_FILE",
      "GIT_CONFIG_PARAMETERS",
    ] as const;
    const previous = Object.fromEntries(
      selectors.map((name) => [name, process.env[name]]),
    );
    process.env.PATH = `${fakeBin}:${process.env.PATH ?? ""}`;
    process.env.GIT_DIR = path.join(base, "other-repository");
    process.env.GIT_WORK_TREE = base;
    process.env.GIT_INDEX_FILE = path.join(base, "false-index");
    process.env.GIT_CONFIG_PARAMETERS = "core.excludesFile=/dev/null";
    try {
      const workspace = await openPrivateWorkspace(root);
      try {
        await workspace.check("users.csv", true);
        await workspace.check(output, false);
      } finally {
        await workspace.close();
      }
      await expectAbsent(marker);
      execFileSync(
        "/usr/bin/git",
        ["-C", root, "add", "-f", "initial_load/users.csv"],
        { stdio: "ignore", env: { NODE_ENV: "test", PATH: "/usr/bin:/bin" } },
      );
      const tracked = await openPrivateWorkspace(root);
      try {
        await expect(tracked.read("users.csv")).rejects.toThrow("TRACKED_PATH");
        await expectAbsent(path.join(dir, output));
      } finally {
        await tracked.close();
      }
    } finally {
      for (const name of selectors) {
        const value = previous[name];
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});

it("rejects a nonzero ls-files before reading private input or creating output", async () => {
  await withFixture(async ({ root, dir }) => {
    // check-ignore --no-index still succeeds; ls-files fails on this corrupt index.
    await writeFile(
      path.join(root, ".git", "index"),
      "corrupt synthetic index",
    );
    await chmod(path.join(dir, "users.csv"), 0o000);
    const workspace = await openPrivateWorkspace(root);
    try {
      await expect(workspace.read("users.csv")).rejects.toThrow(
        "PATH_NOT_PRIVATE",
      );
      await expect(workspace.write(aggregate)).rejects.toThrow(
        "PATH_NOT_PRIVATE",
      );
      await expectAbsent(path.join(dir, output));
    } finally {
      await workspace.close();
    }
  });
});

it("rejects a replaced parent and an initial parent symlink", async () => {
  await withFixture(async ({ base, root, dir }) => {
    const workspace = await openPrivateWorkspace(root);
    const moved = path.join(base, "moved");
    try {
      await rename(dir, moved);
      await mkdir(dir);
      await expect(workspace.verifyParent()).rejects.toThrow("PARENT_CHANGED");
      await expect(workspace.write(aggregate)).rejects.toThrow(
        "PARENT_CHANGED",
      );
      await expectAbsent(path.join(dir, output));
      await expectAbsent(path.join(moved, output));
    } finally {
      await workspace.close();
    }
    await rm(dir, { recursive: true });
    await symlink(moved, dir);
    await expect(openPrivateWorkspace(root)).rejects.toThrow("PATH_UNSAFE");
    await expectAbsent(path.join(moved, output));
  });
});

it("refuses a symlink or occupied output without overwriting its target", async () => {
  await withFixture(async ({ root, dir }) => {
    const destination = path.join(dir, output);
    const workspace = await openPrivateWorkspace(root);
    try {
      await symlink("users.csv", destination);
      await expect(workspace.write(aggregate)).rejects.toThrow("PATH_UNSAFE");
      expect(await readFile(path.join(dir, "users.csv"), "utf8")).toBe(
        '"synthetic"\n',
      );
      await rm(destination);
      await writeFile(destination, '"occupied"\n', { mode: 0o600 });
      await expect(workspace.write(aggregate)).rejects.toThrow("PATH_UNSAFE");
      expect(await readFile(destination, "utf8")).toBe('"occupied"\n');
    } finally {
      await workspace.close();
    }
  });
});

it("rejects unsafe input permissions without creating output", async () => {
  await withFixture(async ({ root, dir }) => {
    await chmod(path.join(dir, "users.csv"), 0o000);
    const workspace = await openPrivateWorkspace(root);
    try {
      await expect(workspace.read("users.csv")).rejects.toThrow("PATH_UNSAFE");
      await expectAbsent(path.join(dir, output));
    } finally {
      await workspace.close();
    }
  });
});

it("reads synthetic input and exclusively writes aggregate-only output in mode 0600", async () => {
  await withFixture(async ({ root, dir }) => {
    const workspace = await openPrivateWorkspace(root);
    try {
      const input = await workspace.read("vacation-balances.csv");
      try {
        expect(input.contents.toString()).toBe('"synthetic"\n');
      } finally {
        await input.handle.close();
      }
      await workspace.write(aggregate);
      const destination = path.join(dir, output);
      expect(await readFile(destination, "utf8")).toBe(aggregate);
      expect((await lstat(destination)).mode & 0o777).toBe(0o600);
      await expect(workspace.write(aggregate)).rejects.toThrow("PATH_UNSAFE");
      expect(await readFile(destination, "utf8")).toBe(aggregate);
    } finally {
      await workspace.close();
    }
  });
});
