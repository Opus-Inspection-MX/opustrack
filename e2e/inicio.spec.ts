import { expect, type Page, test } from "@playwright/test";
import { authFile, type Role } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { fillStable } from "./fixtures/forms";

/**
 * The personal home (Fase 3 · /inicio).
 *
 * One route for every role: the middleware sends "/" to the role's
 * defaultPath (now /inicio for all seed roles) and the page tiles one
 * widget per granted capability. Each widget carries `data-widget-id`, so
 * this spec asserts presence AND absence — a widget leaking across roles
 * is a scoping bug, not a cosmetic one.
 *
 * Fixture roles reuse their storage state; module administrators are
 * created here like in `rbac-roles.spec.ts` so the spec stays
 * self-sufficient.
 */

test.describe.configure({ mode: "serial" });

const PASSWORD = "Inicio123!";

interface Actor {
  email: string;
  password: string;
}

async function makeUser(roleNames: string[]): Promise<Actor> {
  const suffix = uniqueSuffix();
  const email = `e2e.inicio.${suffix}@opusinspection.com`;

  const [roles, activeStatus] = await Promise.all([
    db().role.findMany({ where: { name: { in: roleNames } } }),
    db().userStatus.findFirstOrThrow({ where: { name: "ACTIVO" } }),
  ]);
  if (roles.length !== roleNames.length) {
    throw new Error(
      `Faltan roles ${roleNames.join(", ")} en el catálogo. ¿Corrió el seed?`,
    );
  }

  const { hashPassword } = await import("../src/lib/security/hash");

  await db().user.create({
    data: {
      email,
      name: `E2E Inicio ${roleNames.join("+")} ${suffix}`,
      password: await hashPassword(PASSWORD),
      userStatusId: activeStatus.id,
      userRoles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  });

  return { email, password: PASSWORD };
}

async function signIn(page: Page, actor: Actor) {
  await page.goto("/login");
  await fillStable(page.locator("#email"), actor.email);
  await fillStable(page.locator("#password"), actor.password);
  await page.getByRole("button", { name: /Iniciar|Entrar|Ingresar/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), {
    timeout: 15_000,
  });
}

function widget(page: Page, id: string) {
  // Acotado a `main`: durante el streaming de React el mismo widget existe
  // dos veces (una copia visible en `main` y otra en `div[hidden]` al final
  // de <body>), y el locator sin acotar falla en modo estricto según el
  // momento del chequeo.
  return page.locator(`main [data-widget-id="${id}"]`);
}

async function expectWidgets(
  page: Page,
  present: string[],
  absent: string[] = [],
) {
  for (const id of present) {
    await expect(widget(page, id), id).toBeVisible();
  }
  for (const id of absent) {
    await expect(widget(page, id), id).toHaveCount(0);
  }
}

test.describe("landing / → /inicio", () => {
  test("cada rol cae de / en /inicio con su saludo", async ({ browser }) => {
    // Fase 1 (H-07): includes the module administrators, proving auth.setup
    // generates their storage states too.
    for (const role of [
      "admin",
      "admin-operacion",
      "admin-vacaciones",
      "fsr",
      "reporter",
      "guest",
    ] as Role[]) {
      const context = await browser.newContext({
        storageState: authFile(role),
      });
      const page = await context.newPage();
      await page.goto("/");
      await expect(page).toHaveURL(/\/inicio$/);
      await expect(
        page.getByRole("heading", {
          name: /Buenos días|Buenas tardes|Buenas noches/,
        }),
      ).toBeVisible();
      await context.close();
    }
  });
});

test.describe("ROOT", () => {
  test.use({ storageState: authFile("admin") });

  test("ve la operación completa", async ({ page }) => {
    await page.goto("/inicio");
    await expectWidgets(page, [
      "quick-actions",
      "notifications",
      "tracking-queue",
      "ops-kpis",
      "incidents-by-status",
      "sla-risk",
      "upcoming-schedules",
      "vacation-approvals",
      "upcoming-absences",
    ]);
  });
});

test.describe("FSR", () => {
  test.use({ storageState: authFile("fsr") });

  test("ve su trabajo y no ve administración", async ({ page }) => {
    await page.goto("/inicio");
    await expectWidgets(
      page,
      [
        "quick-actions",
        "notifications",
        "my-work",
        "my-active-trip",
        "my-vacation",
        "upcoming-schedules",
      ],
      ["sla-risk", "ops-kpis", "tracking-queue", "incidents-by-status"],
    );
  });
});

test.describe("REPORTER", () => {
  test.use({ storageState: authFile("reporter") });

  test("ve sus reportes", async ({ page }) => {
    await page.goto("/inicio");
    await expectWidgets(
      page,
      ["quick-actions", "notifications", "my-reports", "upcoming-schedules"],
      ["my-work", "tracking-queue", "sla-risk", "ops-kpis"],
    );
  });
});

test.describe("GUEST", () => {
  test.use({ storageState: authFile("guest") });

  test("no ve widgets de staff", async ({ page }) => {
    await page.goto("/inicio");
    await expectWidgets(
      page,
      ["quick-actions", "notifications", "upcoming-schedules"],
      [
        "my-work",
        "my-reports",
        "my-vacation",
        "tracking-queue",
        "sla-risk",
        "ops-kpis",
      ],
    );
  });
});

test.describe("module roles", () => {
  let operacion: Actor;
  let vacaciones: Actor;
  let empleado: Actor;
  let multi: Actor;

  test.beforeAll(async () => {
    [operacion, vacaciones, empleado, multi] = await Promise.all([
      makeUser(["ADMIN_OPERACION"]),
      makeUser(["ADMIN_VACACIONES"]),
      makeUser(["EMPLEADO"]),
      makeUser(["ADMIN_VACACIONES", "FSR"]),
    ]);
  });

  test("ADMIN_OPERACION ve la cola y los KPI", async ({ page }) => {
    await signIn(page, operacion);
    await page.goto("/");
    await expect(page).toHaveURL(/\/inicio$/);
    await expectWidgets(
      page,
      [
        "tracking-queue",
        "ops-kpis",
        "incidents-by-status",
        "sla-risk",
        "upcoming-schedules",
      ],
      ["my-work", "my-reports", "vacation-approvals"],
    );
  });

  test("ADMIN_VACACIONES ve aprobaciones sin operación", async ({ page }) => {
    await signIn(page, vacaciones);
    await page.goto("/inicio");
    await expectWidgets(
      page,
      ["vacation-approvals", "upcoming-absences", "my-vacation"],
      ["tracking-queue", "ops-kpis", "incidents-by-status"],
    );
  });

  test("EMPLEADO solo ve sus vacaciones", async ({ page }) => {
    await signIn(page, empleado);
    await page.goto("/inicio");
    await expectWidgets(
      page,
      ["quick-actions", "notifications", "my-vacation"],
      ["tracking-queue", "my-work", "sla-risk"],
    );
  });

  test("ADMIN_VACACIONES + FSR ve la unión", async ({ page }) => {
    await signIn(page, multi);
    await page.goto("/inicio");
    await expectWidgets(page, [
      "my-work",
      "my-active-trip",
      "vacation-approvals",
      "upcoming-absences",
    ]);
  });
});
