import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Node runtime contract", () => {
  it("runs compatibility tests on Node 24", () => {
    expect(process.versions.node.split(".")[0]).toBe("24");
  });

  it("aligns local, container, CI, package and type targets with Node 24", () => {
    const manifest = JSON.parse(readProjectFile("package.json"));
    expect(manifest.engines.node).toBe("24.x");
    expect(manifest.devDependencies["@types/node"]).toMatch(/^\^24\./);
    expect(readProjectFile(".nvmrc").trim()).toBe("24");
    expect(readProjectFile("Dockerfile")).toMatch(
      /^FROM node:24-slim AS base$/m,
    );

    const targets = Array.from(
      readProjectFile(".github/workflows/ci.yml").matchAll(
        /node-version:\s*["']?(\d+)/g,
      ),
      (match) => match[1],
    );
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target === "24")).toBe(true);
  });

  it("limits CI to static checks and unit tests without browser or database suites", () => {
    const ci = readProjectFile(".github/workflows/ci.yml");
    const jobs = ci.split("\njobs:\n")[1];
    expect(jobs).toBeDefined();
    expect(
      Array.from(jobs.matchAll(/^ {2}([\w-]+):/gm), (match) => match[1]),
    ).toEqual(["verify"]);
    expect(
      Array.from(ci.matchAll(/^ {8}run: (.+)$/gm), (match) => match[1]),
    ).toEqual(["npm ci", "npm run check", "npm run test:unit"]);

    for (const file of readdirSync(join(process.cwd(), ".github/workflows"))) {
      if (!/\.ya?ml$/.test(file)) continue;
      expect(readProjectFile(`.github/workflows/${file}`), file).not.toMatch(
        /npm run test:(?:e2e|int|all)\b|playwright install/,
      );
    }
  });
});
