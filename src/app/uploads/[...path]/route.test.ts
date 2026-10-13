import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

/**
 * Dynamic upload serving (RF-265).
 *
 * Production `next start` never picks up files added to `public/` after boot,
 * so this route reads from disk per request. Traversal must fail closed and
 * fresh files must serve immediately with the right content type.
 */

import { GET } from "./route";

const ROOT = join(process.cwd(), "public", "uploads", "route-test");
const created: string[] = [];

function call(path: string[]) {
  return GET(new NextRequest(`http://localhost/uploads/${path.join("/")}`), {
    params: Promise.resolve({ path }),
  });
}

afterEach(async () => {
  await rm(ROOT, { recursive: true, force: true });
  created.length = 0;
});

describe("GET /uploads/[...path]", () => {
  it("serves a file written after server start with its content type", async () => {
    await mkdir(ROOT, { recursive: true });
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
    await writeFile(join(ROOT, "fresh.png"), bytes);

    const response = await call(["route-test", "fresh.png"]);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toContain("immutable");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  it("answers 404 for a missing file", async () => {
    const response = await call(["route-test", "absent.png"]);
    expect(response.status).toBe(404);
  });

  it("rejects traversal, empty and backslash segments", async () => {
    for (const path of [
      ["..", "secret"],
      ["route-test", "..", "secret"],
      ["route-test", "a\\b"],
      ["route-test", ""],
      ["route-test", "."],
    ]) {
      expect(await (await call(path)).status, path.join("/")).toBe(404);
    }
  });

  it("serves unknown extensions as octet-stream", async () => {
    await mkdir(ROOT, { recursive: true });
    await writeFile(join(ROOT, "notes.unknownext"), "hello");
    const response = await call(["route-test", "notes.unknownext"]);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/octet-stream",
    );
  });
});
