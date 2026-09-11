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
  /**
   * Locator que solo existe con los datos cargados. `networkidle` no
   * garantiza que React ya haya pintado: tracking y el detalle FSR cargan
   * con una Server Action después de hidratar, y axe medía a veces el
   * spinner o el esqueleto en vez de la página.
   */
  ready: string | (() => string);
}

let fixture: TrackingFixture;

test.beforeAll(async () => {
  fixture = await createTrackingFixture();
});

const PAGES: AuditPage[] = [
  {
    name: "inicio",
    path: "/inicio",
    role: "admin",
    // Acotado a `main` como en inicio.spec.ts (streaming).
    ready: "main [data-widget-id]",
  },
  { name: "login", path: "/login", role: null, ready: "#email" },
  {
    name: "tracking",
    path: "/admin/tracking",
    role: "admin",
    // Lo pinta la paginación compartida solo con datos.
    ready: "text=/Mostrando \\d+ a \\d+ de \\d+/",
  },
  {
    name: "detalle FSR",
    path: () => `/fsr/assignments/${fixture.assignmentId}`,
    role: "admin",
    // El encabezado muestra el título del incidente del fixture.
    ready: () => `text=${fixture.incidentTitle}`,
  },
  {
    name: "clientes",
    path: "/admin/clients",
    role: "admin",
    // Cubre la paginación compartida en los catálogos.
    ready: "text=/Mostrando \\d+ a \\d+ de \\d+/",
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
  const ready =
    typeof pageDef.ready === "string" ? pageDef.ready : pageDef.ready();
  await page.goto(path, { waitUntil: "networkidle" });

  // The theme must actually be applied before axe measures contrast.
  await expect(
    page.locator(`html.${theme}`),
    `theme class "${theme}" on <html>`,
  ).toBeAttached({ timeout: 10_000 });

  // Los datos, no el esqueleto: un escaneo del estado de carga no puede
  // volver a pasar como verde.
  await expect(
    page.locator(ready),
    `${pageDef.name}: datos cargados`,
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.locator('[data-slot="skeleton"]'),
    `${pageDef.name}: sin esqueletos visibles al auditar`,
  ).toHaveCount(0);
  await expect(
    page.getByText(/Cargando/),
    `${pageDef.name}: sin estado de carga visible al auditar`,
  ).toHaveCount(0);

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
        // La carga con datos más axe excede el presupuesto de 30 s en
        // runners lentos (visto en Mobile).
        test.setTimeout(60_000);
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
