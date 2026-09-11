import { expect, type Page, test } from "@playwright/test";
import { authFile, type Role } from "./fixtures/auth";
import { createTrackingFixture, type TrackingFixture } from "./fixtures/flows";

/**
 * Fase 5 · Responsive audit.
 *
 * One representative route per area, swept across 360 / 768 / 1024 / 1440 px:
 * login (auth), /inicio (home), /admin/tracking (operación), the FSR
 * assignment detail (mobile-first field flow), /admin/reports (reportes),
 * /admin/clients (catálogo) and /vacations (personas).
 *
 * Every sweep asserts the same contract:
 * - No horizontal scroll on the document (documentElement, 1px tolerance).
 * - On shell routes: exactly ONE notification bell — the Fase 2 regression
 *   was two bells between 768 and 1023px (use-mobile cut at md, header at
 *   lg), fixed by unifying every breakpoint at lg.
 * - The global header is visible on shell routes; the mobile tab bar is
 *   visible below lg (1024) and hidden at/above it.
 *
 * Runs in the default browser projects (chromium, Mobile Chrome, plus the
 * opt-in ones). Viewports are set explicitly per test, so the assertions hold
 * no matter which project device launches them.
 */

const VIEWPORTS = [
  { width: 360, height: 800, label: "360" },
  { width: 768, height: 1024, label: "768" },
  { width: 1024, height: 768, label: "1024" },
  { width: 1440, height: 900, label: "1440" },
] as const;

const MOBILE_BREAKPOINT = 1024;

interface AreaRoute {
  /** Area name for test titles. */
  area: string;
  /** Path or thunk (the FSR detail needs its fixture id). */
  path: string | (() => string);
  /** Storage-state role, or null for the logged-out login page. */
  role: Role | null;
  /** False for pages outside the AppShell (no header, bell, or tab bar). */
  shell: boolean;
}

let fixture: TrackingFixture;

test.beforeAll(async () => {
  fixture = await createTrackingFixture();
});

const ROUTES: AreaRoute[] = [
  { area: "login", path: "/login", role: null, shell: false },
  { area: "inicio", path: "/inicio", role: "admin", shell: true },
  { area: "tracking", path: "/admin/tracking", role: "admin", shell: true },
  {
    area: "detalle FSR",
    path: () => `/fsr/assignments/${fixture.assignmentId}`,
    role: "admin",
    shell: true,
  },
  { area: "reportes", path: "/admin/reports", role: "admin", shell: true },
  { area: "catálogo", path: "/admin/clients", role: "admin", shell: true },
  { area: "vacations", path: "/vacations", role: "admin", shell: true },
];

function tabBar(page: Page) {
  return page.locator('nav[aria-label="Navegación principal"]');
}

function bells(page: Page) {
  return page.locator('button[aria-label^="Notificaciones"]');
}

async function expectNoDocumentScroll(page: Page) {
  const { doc, win } = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    win: window.innerWidth,
  }));
  expect(doc, "documentElement.scrollWidth").toBeLessThanOrEqual(win + 1);
}

for (const route of ROUTES) {
  test.describe(`${route.area} · ${typeof route.path === "string" ? route.path : "/fsr/assignments/[id]"}`, () => {
    if (route.role) {
      test.use({ storageState: authFile(route.role) });
    }

    for (const viewport of VIEWPORTS) {
      test(`sin scroll horizontal a ${viewport.label}px`, async ({ page }) => {
        const path = typeof route.path === "string" ? route.path : route.path();
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto(path, { waitUntil: "networkidle" });

        await expectNoDocumentScroll(page);

        if (route.shell) {
          // One header, one bell, and the tab bar exactly where it belongs.
          await expect(page.locator("header").first()).toBeVisible();
          await expect(bells(page)).toHaveCount(1);
          if (viewport.width < MOBILE_BREAKPOINT) {
            await expect(tabBar(page)).toBeVisible();
          } else {
            await expect(tabBar(page)).toBeHidden();
          }
        } else {
          // The login page lives outside the shell: form reachable, chrome absent.
          await expect(page.locator("#email")).toBeVisible();
          await expect(page.locator("#password")).toBeVisible();
          await expect(
            page.getByRole("button", { name: /Iniciar Sesión/i }),
          ).toBeVisible();
          await expect(tabBar(page)).toHaveCount(0);
          await expect(bells(page)).toHaveCount(0);
        }
      });
    }
  });
}

test.describe("prefers-reduced-motion", () => {
  test.use({
    storageState: authFile("admin"),
    contextOptions: { reducedMotion: "reduce" },
  });

  test("la preferencia llega a la página y las transiciones CSS se anulan", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/inicio", { waitUntil: "networkidle" });

    // The OS setting must be observable: MotionConfig reducedMotion="user"
    // defers to it, and the globals.css guard zeroes CSS durations off it.
    expect(
      await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);

    // Interactive elements keep their classes but resolve to ~zero duration.
    const durations = await page.evaluate(() => {
      const sample = Array.from(
        document.querySelectorAll("main button, main a"),
      ).slice(0, 20);
      return sample.map((el) => {
        const style = window.getComputedStyle(el);
        return {
          transition: style.transitionDuration,
          animation: style.animationDuration,
        };
      });
    });
    expect(durations.length).toBeGreaterThan(0);
    for (const { transition, animation } of durations) {
      for (const value of [...transition.split(","), ...animation.split(",")]) {
        const seconds = Number.parseFloat(value) || 0;
        expect(seconds).toBeLessThanOrEqual(0.02);
      }
    }

    await expectNoDocumentScroll(page);
    await expect(page.locator("header").first()).toBeVisible();
    await expect(tabBar(page)).toBeVisible();
  });
});
