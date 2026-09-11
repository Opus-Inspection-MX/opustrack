import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";
import { authFile, type Role } from "./fixtures/auth";
import { createTrackingFixture, type TrackingFixture } from "./fixtures/flows";

/**
 * Fase 5 · Accessibility audit with axe.
 *
 * Four representative pages — /inicio (home), /login (logged out),
 * /admin/tracking (operación) and the FSR assignment detail (field flow) —
 * each scanned in the three themes (light/dark/opus) via the next-themes
 * localStorage key, so theme-specific contrast regressions surface here
 * instead of in a bug report.
 *
 * WCAG 2.0/2.1 A+AA, scoped to the default rule set. Rules that fail for
 * reasons outside this phase (third-party markup, needs-design-call color
 * pairs) are disabled inline WITH a reason and tracked as debt in
 * docs/ui-patterns.md — never silently.
 */

const THEMES = ["light", "dark", "opus"] as const;
type Theme = (typeof THEMES)[number];

interface AuditPage {
  name: string;
  path: string | (() => string);
  role: Role | null;
}

let fixture: TrackingFixture;

test.beforeAll(async () => {
  fixture = await createTrackingFixture();
});

const PAGES: AuditPage[] = [
  { name: "inicio", path: "/inicio", role: "admin" },
  { name: "login", path: "/login", role: null },
  { name: "tracking", path: "/admin/tracking", role: "admin" },
  {
    name: "detalle FSR",
    path: () => `/fsr/assignments/${fixture.assignmentId}`,
    role: "admin",
  },
];

async function scan(browser: Browser, pageDef: AuditPage, theme: Theme) {
  const context = await browser.newContext(
    pageDef.role ? { storageState: authFile(pageDef.role) } : {},
  );
  // next-themes reads this key before first paint when it exists.
  await context.addInitScript(
    (value: string) => window.localStorage.setItem("theme", value),
    theme,
  );
  const page = await context.newPage();
  const path = typeof pageDef.path === "string" ? pageDef.path : pageDef.path();
  await page.goto(path, { waitUntil: "networkidle" });

  // The theme must actually be applied before axe measures contrast.
  await expect(
    page.locator(`html.${theme}`),
    `theme class "${theme}" on <html>`,
  ).toBeAttached({ timeout: 10_000 });

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  await context.close();
  return results;
}

for (const pageDef of PAGES) {
  test.describe(`${pageDef.name}`, () => {
    for (const theme of THEMES) {
      test(`sin violaciones axe en tema ${theme}`, async ({ browser }) => {
        const results = await scan(browser, pageDef, theme);
        expect(
          results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.length,
            help: v.help,
          })),
          `${pageDef.name} @ ${theme}: axe violations`,
        ).toEqual([]);
      });
    }
  });
}
