import { readFileSync } from "node:fs";
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

    for (const workflow of [
      ".github/workflows/ci.yml",
      ".github/workflows/e2e-nightly.yml",
    ]) {
      const targets = Array.from(
        readProjectFile(workflow).matchAll(/node-version:\s*["']?(\d+)/g),
        (match) => match[1],
      );
      expect(targets.length, workflow).toBeGreaterThan(0);
      expect(
        targets.every((target) => target === "24"),
        workflow,
      ).toBe(true);
    }
  });
});
