import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import { assertEphemeralDatabase } from "./e2e/fixtures/ephemeral-db";

/**
 * See https://playwright.dev/docs/test-configuration.
 *
 * The environment is loaded HERE, not by the npm script, so a bare
 * `npx playwright test` is configured and guarded exactly like
 * `npm run test:e2e`. `override: true` means an exported DATABASE_URL cannot
 * redirect the suite, and the assertion below refuses to start at all unless
 * the target is the throwaway container.
 *
 * The suite also runs on its own port (3100 by default) instead of the app's
 * 3000: `reuseExistingServer` would otherwise attach to whatever already
 * listens there — a stale dev server, or an unrelated container.
 *
 * Database and credentials come from config/e2e.env (throwaway, tracked) and
 * config/e2e.local.env (gitignored, optional). See e2e/README.md.
 */
for (const file of ["config/e2e.env", "config/e2e.local.env"]) {
  // A missing local override file is harmless: dotenv returns an error object
  // instead of throwing. Later files win because of `override`.
  dotenv.config({
    path: path.resolve(__dirname, file),
    override: true,
    quiet: true,
  });
}

assertEphemeralDatabase(process.env.DATABASE_URL);

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const BASE_URL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Only .spec.ts files are browser tests. `*.test.ts` under e2e/ belongs to
  // vitest (pure helpers); the setup projects override this with their own
  // testMatch.
  testMatch: /.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Provisions the dedicated e2e accounts. Everything else depends on it.
    {
      name: "db",
      testMatch: /db\.setup\.ts/,
    },
    // Authenticates each role once and persists storage state.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      dependencies: ["db"],
    },
    // Catalog CRUD: 16 catalogs x 4 tests. Chromium only — it is not
    // browser-sensitive, and running it everywhere would triple the suite.
    {
      name: "catalogs",
      testMatch: /catalogs\.spec\.ts$/,
      // Serial: the catalogs share one database and reference each other
      // (equipments picks a line, lines picks a cliente). Run in parallel, one
      // catalog's fixture becomes another's dependency and deletes start
      // failing on guards that have nothing to do with the test.
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    // Programación and seguimiento: dense flows over shared operational data
    // (schedules, incidents, assignments). Chromium only and serial, for the
    // same reasons as the catalogs — they are not browser-sensitive, and two
    // workers editing the same incident rows race each other.
    {
      name: "flows",
      testMatch: /(programacion|tracking)\.spec\.ts$/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      testIgnore: /(catalogs|programacion|tracking)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      testIgnore: /(catalogs|programacion|tracking)\.spec\.ts$/,
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      testIgnore: /(catalogs|programacion|tracking)\.spec\.ts$/,
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Chrome",
      testIgnore: /(catalogs|programacion|tracking)\.spec\.ts$/,
      use: { ...devices["Pixel 5"] },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Safari",
      testIgnore: /(catalogs|programacion|tracking)\.spec\.ts$/,
      use: { ...devices["iPhone 12"] },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    // Production server by default. `next dev` logs every request Playwright
    // aborts on teardown as `uncaughtException: [Error: aborted] ECONNRESET`,
    // which buried real server errors in ~45 lines of noise per run. The
    // production server emits none of it, runs faster, and is what ships.
    // `E2E_SERVER=dev` switches back for debugging (dev overlay, stack traces).
    // Both scripts load config/e2e.env with dotenv's --override, so the app
    // under test always talks to the disposable container.
    command:
      process.env.E2E_SERVER === "dev"
        ? `npm run e2e:dev -- --port ${PORT}`
        : `npm run e2e:start -- --port ${PORT}`,
    url: BASE_URL,
    // NextAuth builds its callback URLs from NEXTAUTH_URL; without this the
    // login POST would redirect to port 3000 and the session cookie would be
    // set on the wrong origin.
    env: { NEXTAUTH_URL: BASE_URL },
    // Never reuse: each run gets a freshly built server against a freshly
    // created database. Reusing once attached the suite to an unrelated
    // container that happened to hold the port.
    reuseExistingServer: false,
    timeout: 120000,
  },
});
