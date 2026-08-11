import { expect, test } from "@playwright/test";
import { ACCOUNTS, authFile, ROLES, SEED_PASSWORD } from "./fixtures/auth";

/**
 * E2E coverage for spec/01-auth-rbac.md.
 *
 * Notes / known behavior surfaced while writing these tests:
 * - The login form (src/components/login/login-form.component.tsx) maps EVERY
 *   NextAuth error to the same generic Spanish message, so the "Account is not
 *   active" vs "Invalid credentials" distinction from RF-100 is not observable
 *   at the UI layer — it lives in authorize()/getAuthenticatedUser(). It is
 *   covered by unit tests, not here.
 * - The middleware route map (checkRouteAccess) is intentionally independent
 *   from the DB RBAC (RF-101). These tests assert the middleware behavior, which
 *   is what a browser actually hits.
 */

// ---------------------------------------------------------------------------
// RF-100 · Login por credenciales (logged-out context)
// ---------------------------------------------------------------------------
test.describe("RF-100 · Login por credenciales", () => {
  test("valid credentials land the user on their defaultPath", async ({
    page,
  }) => {
    const { email, defaultPath } = ACCOUNTS.admin;

    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await page.waitForURL(`**${defaultPath}`);
    await expect(page).toHaveURL(new RegExp(`${defaultPath}$`));
  });

  test("invalid credentials show the generic error and stay on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill("admin@opusinspection.com");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown email shows the same generic error (no user enumeration)", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody@opusinspection.com");
    await page.locator("#password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// RF-104 · Rutas públicas
// ---------------------------------------------------------------------------
test.describe("RF-104 · Rutas públicas", () => {
  for (const route of ["/login", "/unauthorized"]) {
    test(`${route} is reachable without authentication`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}$`));
    });
  }

  // /signup is public at the middleware level, but the page itself redirects to
  // /login: account creation is admin-managed (RF-109), there is no self-signup.
  test("/signup redirects to /login (self-signup is disabled)", async ({
    page,
  }) => {
    await page.goto("/signup");
    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/message=/);
  });
});

// ---------------------------------------------------------------------------
// RF-106 · Rutas protegidas sin sesión → redirect a /login con callbackUrl
// ---------------------------------------------------------------------------
test.describe("RF-106 · Protección de rutas sin sesión", () => {
  test("protected route redirects to /login preserving callbackUrl", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);
  });
});

// ---------------------------------------------------------------------------
// RF-104 / RF-106 · defaultPath redirect por rol (authenticated)
// ---------------------------------------------------------------------------
for (const role of ROLES) {
  test.describe(`RF-104 · defaultPath de ${role}`, () => {
    test.use({ storageState: authFile(role) });

    test(`visiting "/" redirects ${role} to ${ACCOUNTS[role].defaultPath}`, async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(
        new RegExp(`${ACCOUNTS[role].defaultPath}$`),
      );
    });
  });
}

// ---------------------------------------------------------------------------
// RF-103 · Acceso omnipotente del rol ADMINISTRADOR
// ---------------------------------------------------------------------------
test.describe("RF-103 · Bypass total de ADMINISTRADOR", () => {
  test.use({ storageState: authFile("admin") });

  for (const route of ["/fsr", "/client", "/guest", "/parts", "/reports"]) {
    test(`admin can access ${route}`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route}`));
      await expect(page).not.toHaveURL(/\/unauthorized/);
      await expect(page).not.toHaveURL(/\/login/);
    });
  }
});

// ---------------------------------------------------------------------------
// RF-106 · Denegación de rutas fuera del mapa del rol → /unauthorized
// ---------------------------------------------------------------------------
test.describe("RF-106 · Denegación por rol", () => {
  const denials: Array<{ role: "client" | "guest"; route: string }> = [
    { role: "client", route: "/fsr" }, // FSR-only dashboard
    { role: "client", route: "/parts" }, // parts not in CLIENT map
    { role: "guest", route: "/reports" }, // reports not in GUEST map
    { role: "guest", route: "/client" }, // client dashboard not in GUEST map
  ];

  for (const { role, route } of denials) {
    test.describe(`${role} → ${route}`, () => {
      test.use({ storageState: authFile(role) });

      test(`is redirected to /unauthorized`, async ({ page }) => {
        await page.goto(route);
        await expect(page).toHaveURL(/\/unauthorized/);
        await expect(
          page.getByRole("heading", { name: "Acceso Denegado" }),
        ).toBeVisible();
      });
    });
  }
});
