import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { vi } from "vitest";
import { assertEphemeralDatabase } from "../../../e2e/fixtures/ephemeral-db";

/**
 * Integration setup: real Postgres, mocked framework edges.
 *
 * - Loads `config/e2e.env` (plus optional `config/e2e.local.env`) with
 *   override BEFORE anything imports Prisma, so a `DATABASE_URL` exported
 *   in the shell can never redirect the suite at the wrong database.
 * - Refuses to run against anything but the ephemeral container
 *   (localhost:5433/opustrack_e2e): the same guard as the e2e suite.
 * - Mocks ONLY the framework edges: `next/cache` (no-op revalidation),
 *   `next/navigation` (`redirect` throws a recognizable error instead of
 *   Next's internal digest), and `next-auth`'s `getServerSession`, which
 *   returns whoever `actAs(userId)` selected. Everything else — authz,
 *   scopes, state machines, mail, storage — is the real code against the
 *   real database.
 * - React's `cache()` is deliberately NOT mocked: outside RSC it is a
 *   passthrough, which is what lets `actAs` switch users between calls
 *   (pinned by the "switches identity" test in scope-matrix).
 */

/** Minimal dotenv parser: KEY=VALUE, quotes, `export ` prefix, `#` comments. */
function loadEnvFile(path: string, required: boolean): void {
  if (!existsSync(path)) {
    if (required) throw new Error(`Integration setup: missing ${path}`);
    return;
  }
  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eq = body.indexOf("=");
    if (eq === -1) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    // Inline comments only outside quotes (no lookbehind: ES2017 target).
    if (!/^['"`]/.test(value)) {
      const hash = value.search(/(^|[^\\])#/);
      if (hash !== -1)
        value = value.slice(0, hash + (value[hash] === "#" ? 0 : 1)).trim();
    }
    const quoted = value.match(/^(['"`])([\s\S]*)\1$/);
    if (quoted) value = quoted[2] ?? "";
    // `override: true` on purpose — see module docstring.
    process.env[key] = value;
  }
}

const root = process.cwd();
loadEnvFile(join(root, "config", "e2e.env"), true);
loadEnvFile(join(root, "config", "e2e.local.env"), false);

assertEphemeralDatabase(process.env.DATABASE_URL);

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("next-auth", async () => {
  const { getCurrentUserId } = await import("./session-state");
  return {
    getServerSession: async () => {
      const id = getCurrentUserId();
      if (!id) return null;
      return {
        user: { id, name: "integration-test", email: "int@test.local" },
        expires: new Date(Date.now() + 3600_000).toISOString(),
      };
    },
  };
});
