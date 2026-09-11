import { existsSync } from "node:fs";
import path from "node:path";
import {
  defineConfig,
  devices,
  type PlaywrightTestProject,
  webkit,
} from "@playwright/test";
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

// Boxes without Playwright's bundled browsers (e.g. Arch Linux, where the
// Ubuntu-built Chromium doesn't run): fall back to the system Chromium when it
// exists and this is NOT CI. On CI the bundled build is mandatory — a missing
// browser there must fail loudly instead of silently testing another binary
// (H-23).
const SYSTEM_CHROMIUM =
  !process.env.CI && existsSync("/usr/bin/chromium")
    ? "/usr/bin/chromium"
    : undefined;
const SYSTEM_CHROMIUM_USE = SYSTEM_CHROMIUM
  ? { launchOptions: { executablePath: SYSTEM_CHROMIUM } }
  : {};

// WebKit has no system fallback: Playwright's build targets Ubuntu and there is
// no distro package to point at. When it isn't installed, drop the WebKit
// projects (Desktop Safari, iPhone) locally instead of failing every test in
// them. CI never skips — a missing browser there must fail loudly.
const WEBKIT_AVAILABLE = Boolean(process.env.CI) || hasWebkit();

// Default runs are Chromium-only: Firefox, WebKit, Mobile Safari and iPad are
// opt-in behind E2E_EXTRA_BROWSERS=1. Chromium, Mobile Chrome and the
// Chromium-based catalogs/flows projects always run. (Firefox entries that
// finish in 1-3ms are skips from a missing binary, not passes.)
const EXTRA_BROWSERS = process.env.E2E_EXTRA_BROWSERS === "1";
const EXTRA_BROWSER_PROJECTS = new Set([
  "firefox",
  "webkit",
  "Mobile Safari",
  "iPad",
]);

function hasWebkit(): boolean {
  try {
    return existsSync(webkit.executablePath());
  } catch {
    return false;
  }
}

// The config is evaluated by the runner and again by every worker; warn once.
if (!WEBKIT_AVAILABLE && process.env.TEST_WORKER_INDEX === undefined) {
  process.stderr.write(
    "[playwright] WebKit no está instalado: se omiten los proyectos webkit y Mobile Safari. Instálalo con `npx playwright install webkit`.\n",
  );
}
if (!EXTRA_BROWSERS && process.env.TEST_WORKER_INDEX === undefined) {
  process.stderr.write(
    "[playwright] Chromium-only run: firefox, webkit and Mobile Safari are skipped. Opt in with E2E_EXTRA_BROWSERS=1.\n",
  );
}

const onlyAvailableBrowsers = (project: PlaywrightTestProject) => {
  if (
    !EXTRA_BROWSERS &&
    project.name !== undefined &&
    EXTRA_BROWSER_PROJECTS.has(project.name)
  ) {
    return false;
  }
  return WEBKIT_AVAILABLE || project.use?.defaultBrowserType !== "webkit";
};

export default defineConfig({
  testDir: "./e2e",
  // Only .spec.ts files are browser tests. `*.test.ts` under e2e/ belongs to
  // vitest (pure helpers); the setup projects override this with their own
  // testMatch. `zz-*` debug specs never run anywhere, not even locally: they
  // are throwaway files that must not be committed.
  testMatch: /.*\.spec\.ts$/,
  testIgnore: /zz-.*\.spec\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // "list" prints each test's pass/fail live to the terminal — without it,
  // "html" alone only writes the report file and stays silent until the run
  // ends, making the run look stuck / indistinguishable from server logs.
  reporter: [["list"], ["html"]],
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
    // Authenticates each role once and persists storage state. Needs a
    // working Chromium like every other browser project (the setup tests
    // launch a real login page), so it carries the system-Chromium
    // fallback too — otherwise it falls back to the bundled headless
    // shell that Arch boxes cannot download.
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...SYSTEM_CHROMIUM_USE },
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
      use: { ...devices["Desktop Chrome"], ...SYSTEM_CHROMIUM_USE },
      dependencies: ["setup"],
    },
    // Programación and seguimiento: dense flows over shared operational data
    // (schedules, incidents, assignments). Chromium only and serial, for the
    // same reasons as the catalogs — they are not browser-sensitive, and two
    // workers editing the same incident rows race each other.
    {
      name: "flows",
      testMatch:
        /(programacion|tracking|errors|vacations|rbac-roles|notifications-mail|incident-operations|inicio)\.spec\.ts$/,
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], ...SYSTEM_CHROMIUM_USE },
      dependencies: ["setup"],
    },
    {
      name: "chromium",
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|rbac-roles|notifications-mail|incident-operations|inicio)\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], ...SYSTEM_CHROMIUM_USE },
      dependencies: ["setup"],
    },
    {
      name: "firefox",
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|rbac-roles|notifications-mail|incident-operations|inicio)\.spec\.ts$/,
      use: { ...devices["Desktop Firefox"] },
      dependencies: ["setup"],
    },
    {
      name: "webkit",
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|rbac-roles|notifications-mail|incident-operations|inicio)\.spec\.ts$/,
      use: { ...devices["Desktop Safari"] },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Chrome",
      // Navigation, RBAC and inicio run here too (Fase 5): auth-rbac was
      // never excluded, and rbac-roles/inicio assertions hold on small
      // viewports — the rbac menu spec opens the "Más" drawer first. The
      // remaining flows specs stay desktop-only: they drive dense
      // operational grids over shared rows.
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|notifications-mail|incident-operations)\.spec\.ts$/,
      use: { ...devices["Pixel 5"], ...SYSTEM_CHROMIUM_USE },
      dependencies: ["setup"],
    },
    {
      name: "iPad",
      // Tablet companion to Mobile Chrome (Fase 5): same spec set, iPad
      // viewport with touch. WebKit-based, so it joins the
      // E2E_EXTRA_BROWSERS=1 opt-in set like Mobile Safari.
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|notifications-mail|incident-operations)\.spec\.ts$/,
      use: { ...devices["iPad (gen 7)"] },
      dependencies: ["setup"],
    },
    {
      name: "Mobile Safari",
      testIgnore:
        /(catalogs|programacion|tracking|errors|vacations|rbac-roles|notifications-mail|incident-operations|inicio)\.spec\.ts$/,
      use: { ...devices["iPhone 12"] },
      dependencies: ["setup"],
    },
  ].filter(onlyAvailableBrowsers),

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
