// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  load: vi.fn(),
  rm: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawnSync: mocks.spawn }));
vi.mock("node:fs", async (original) => ({
  ...(await original()),
  rmSync: mocks.rm,
}));
vi.mock("./lib/env-profiles.mjs", () => ({ loadProfile: mocks.load }));
vi.mock("dotenv", () => ({ default: { config: vi.fn() } }));

const originalArgv = process.argv;
const originalEnv = { ...process.env };
let handlers;

afterEach(() => {
  process.argv = originalArgv;
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
  vi.clearAllMocks();
});

async function execute(args, fail = () => false) {
  handlers = {};
  process.argv = ["node", "scripts/e2e.mjs", ...args];
  mocks.spawn.mockImplementation((command, argv) => ({
    status: fail(command, argv) ? 7 : 0,
  }));
  vi.spyOn(process, "on").mockImplementation((signal, handler) => {
    handlers[signal] = handler;
    return process;
  });
  const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined);
  await import("./e2e.mjs");
  return exit;
}

const calls = () => mocks.spawn.mock.calls;
const finalDown = () => calls().at(-1)?.slice(0, 2);

describe("workflow runner boundary", () => {
  it.each([false, true])(
    "excludes workflow files from every other project (opt-in=%s)",
    async (enabled) => {
      process.env.CI = "1";
      process.env.E2E_EXTRA_BROWSERS = "1";
      process.env.DATABASE_URL =
        "postgresql://e2e:e2e@localhost:5433/opustrack_e2e";
      process.env.E2E_DB_PORT = "5433";
      if (enabled) process.env.E2E_WORKFLOWS = "1";
      else delete process.env.E2E_WORKFLOWS;
      const { default: config } = await import("../playwright.config.ts");
      const workflowPath = "/repo/e2e/workflows/incident-role-workflow.spec.ts";
      const projects = config.projects;
      const workflowProject = projects.find(
        (project) => project.name === "workflows",
      );
      expect(Boolean(workflowProject)).toBe(enabled);
      if (enabled) {
        expect(config.workers).toBe(1);
        expect(workflowProject.fullyParallel).toBe(false);
        expect(workflowProject.dependencies).toBeUndefined();
        expect(workflowProject.testMatch.test(workflowPath)).toBe(true);
      }
      for (const project of projects.filter(
        (project) => project.name !== "workflows",
      )) {
        expect(
          project.testIgnore.some((pattern) => pattern.test(workflowPath)),
          project.name,
        ).toBe(true);
      }
      expect(mocks.spawn).not.toHaveBeenCalled();
    },
  );

  it("consumes opt-in and runs one project/worker after a real build", async () => {
    const exit = await execute(["--workflows", "--grep", "vacation"]);
    expect(process.env.E2E_WORKFLOWS).toBe("1");
    expect(process.env.E2E_SERVER).not.toBe("dev");
    expect(calls().map(([command, args]) => [command, args])).toEqual([
      ["docker", ["compose", "-f", "docker-compose.e2e.yml", "down", "-v"]],
      [
        "docker",
        ["compose", "-f", "docker-compose.e2e.yml", "up", "-d", "--wait"],
      ],
      ["npx", ["tsx", "scripts/e2e-prepare.ts"]],
      ["npx", ["next", "build"]],
      [
        "npx",
        [
          "playwright",
          "test",
          "--grep",
          "vacation",
          "--project=workflows",
          "--workers=1",
        ],
      ],
      ["docker", ["compose", "-f", "docker-compose.e2e.yml", "down", "-v"]],
    ]);
    for (const [, , options] of calls()) expect(options.shell).toBe(false);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it.each([
    ["--project=chromium"],
    ["--project", "chromium"],
    ["--workers=2"],
    ["--workers", "2"],
    ["-j", "2"],
    ["-j2"],
    ["--dev"],
    ["--shard=1/2"],
  ])("rejects conflicting %j before any stack process", async (...args) => {
    await expect(execute(["--workflows", ...args])).rejects.toThrow();
    expect(mocks.spawn).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  });

  it("consumes matching explicit overrides instead of duplicating them", async () => {
    await execute(["--workflows", "--project", "workflows", "--workers=1"]);
    expect(calls().find(([, args]) => args[0] === "playwright")[1]).toEqual([
      "playwright",
      "test",
      "--project=workflows",
      "--workers=1",
    ]);
  });

  it.each(["up", "tsx", "next", "playwright"])(
    "cleans up after %s failure",
    async (phase) => {
      const exit = await execute(["--workflows"], (_command, args) =>
        args.includes(phase),
      );
      expect(finalDown()).toEqual([
        "docker",
        ["compose", "-f", "docker-compose.e2e.yml", "down", "-v"],
      ]);
      expect(exit).toHaveBeenCalledWith(phase === "playwright" ? 7 : 1);
    },
  );

  it.each(["SIGINT", "SIGTERM"])(
    "preserves idempotent %s cleanup",
    async (signal) => {
      const exit = await execute(["--workflows"]);
      const count = calls().length;
      handlers[signal]();
      expect(calls()).toHaveLength(count);
      expect(exit).toHaveBeenLastCalledWith(130);
    },
  );

  it.each(["SIGINT", "SIGTERM"])(
    "tears down exactly once on live %s before finally",
    async (signal) => {
      const exit = await execute(["--workflows"], (_command, args) => {
        if (args[0] === "playwright") handlers[signal]();
        return false;
      });
      expect(exit).toHaveBeenCalledWith(130);
      // Initial stale-stack discard plus one signal cleanup, no finally repeat.
      expect(calls().filter(([, args]) => args.includes("down"))).toHaveLength(
        2,
      );
      expect(finalDown()[1]).toContain("down");
    },
  );

  it("keeps normal dev forwarding and clears inherited workflow opt-in", async () => {
    process.env.E2E_WORKFLOWS = "1";
    await execute(["--dev", "--project=chromium"]);
    expect(process.env.E2E_WORKFLOWS).toBeUndefined();
    expect(process.env.E2E_SERVER).toBe("dev");
    expect(calls().some(([, args]) => args[0] === "next")).toBe(false);
    expect(calls().find(([, args]) => args[0] === "playwright")[1]).toContain(
      "--project=chromium",
    );
  });
});
