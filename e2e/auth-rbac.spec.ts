import { expect, test } from "@playwright/test";
import { account, authFile, defaultPathFor, ROLES } from "./fixtures/auth";
import { submitLogin } from "./fixtures/login";

/**
 * E2E coverage for spec/01-auth-rbac.md.
 *
 * Notes / known behavior surfaced while writing these tests:
 * - The login form (src/components/login/login-form.component.tsx) maps EVERY
 *   NextAuth error to the same generic Spanish message, so the "Account is not
 *   active" vs "Invalid credentials" distinction from RF-100 is not observable
 *   at the UI layer — it lives in authorize()/getAuthenticatedUser(). It is
 *   covered by unit tests, not here.
 * - Route access is database-driven: the role's `Permission.routePath` values
 *   travel in the JWT and the middleware evaluates them with
 *   `src/lib/authz/route-access.ts`. These tests assert the middleware behavior,
 *   which is what a browser actually hits, so they also cover the DB rules.
 *   Adding or revoking a `route:*` permission changes these expectations.
 */

// ---------------------------------------------------------------------------
// RF-100 · Login por credenciales (logged-out context)
// ---------------------------------------------------------------------------
test.describe("RF-100 · Login por credenciales", () => {
  test("valid credentials land the user on their defaultPath", async ({
    page,
  }) => {
    const { email, password, defaultPath } = account("admin");

    await page.goto("/login");
    await submitLogin(page, email, password);

    await page.waitForURL(`**${defaultPath}`);
    await expect(page).toHaveURL(new RegExp(`${defaultPath}$`));
  });

  test("invalid credentials show the generic error and stay on /login", async ({
    page,
  }) => {
    await page.goto("/login");
    await submitLogin(page, account("admin").email, "wrong-password");

    await expect(page.getByText(/Credenciales inválidas/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("unknown email shows the same generic error (no user enumeration)", async ({
    page,
  }) => {
    await page.goto("/login");
    await submitLogin(
      page,
      "nobody-definitely-not-a-user@e2e.invalid",
      account("admin").password,
    );

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

    test(`visiting "/" redirects ${role} to ${defaultPathFor(role)}`, async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${defaultPathFor(role)}$`));
    });
  });
}

// ---------------------------------------------------------------------------
// RF-103 · Acceso omnipotente del superusuario (ROOT)
// ---------------------------------------------------------------------------
test.describe("RF-103 · Bypass total de ROOT", () => {
  test.use({ storageState: authFile("admin") });

  // Only real routes: asserting on a non-existent path passes trivially because
  // a 404 page still has the requested URL and is neither /unauthorized nor
  // /login. The previous list used /parts and /reports, which do not exist.
  for (const route of [
    "/fsr",
    "/client",
    "/guest",
    "/profile",
    "/admin/reports/incident-program",
  ]) {
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
  const denials: Array<{ role: "fsr" | "client" | "guest"; route: string }> = [
    { role: "fsr", route: "/admin" }, // admin dashboard
    { role: "fsr", route: "/admin/reports/incident-program" }, // admin sub-route
    // A route permission must not leak across a path segment: FSR holds "/fsr",
    // which grants "/fsr/..." but never "/fsr-admin".
    { role: "fsr", route: "/fsr-admin" },
    { role: "client", route: "/fsr" }, // FSR-only dashboard
    { role: "client", route: "/admin" }, // admin dashboard
    { role: "guest", route: "/admin" }, // admin dashboard
    { role: "guest", route: "/client" }, // client dashboard
  ];

  for (const { role, route } of denials) {
    test.describe(`${role} → ${route}`, () => {
      test.use({ storageState: authFile(role) });

      test(`is redirected to /unauthorized`, async ({ page }) => {
        await page.goto(route);
        await expect(page).toHaveURL(/\/unauthorized/);
        // Matched by text, not by role: the page renders its title through
        // shadcn's CardTitle, which is a <div> — there is no heading element.
        await expect(page.getByText("Acceso Denegado")).toBeVisible();
      });
    });
  }
});

// ---------------------------------------------------------------------------
// RF-106 · Ruta compartida /profile — concedida por el permiso `route:profile`
// ---------------------------------------------------------------------------
test.describe("RF-106 · Acceso compartido a /profile", () => {
  for (const role of ROLES) {
    test.describe(`${role}`, () => {
      test.use({ storageState: authFile(role) });

      test("can reach /profile", async ({ page }) => {
        await page.goto("/profile");
        await expect(page).not.toHaveURL(/\/unauthorized/);
        await expect(page).not.toHaveURL(/\/login/);
      });
    });
  }
});
