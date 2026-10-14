import { expect, type Page, test } from "@playwright/test";

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 568, height: 320 },
  { width: 667, height: 375 },
  { width: 360, height: 500 },
  { width: 360, height: 501 },
  { width: 360, height: 600 },
  { width: 360, height: 601 },
  { width: 360, height: 640 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test.use({ storageState: { cookies: [], origins: [] } });

async function expectViewportFit(page: Page) {
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
  }));
  expect(dimensions.width, "document width").toBeLessThanOrEqual(
    dimensions.viewportWidth + 1,
  );
  expect(dimensions.height, "document height").toBeLessThanOrEqual(
    dimensions.viewportHeight + 1,
  );

  for (const control of [
    page.getByLabel("Correo electrónico"),
    page.getByLabel("Contraseña", { exact: true }),
    page.getByRole("button", { name: "Iniciar Sesión", exact: true }),
    page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
  ]) {
    await expect(control).toBeInViewport({ ratio: 1 });
  }
}

for (const viewport of VIEWPORTS) {
  test(`login fits ${viewport.width}x${viewport.height}, including errors`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/login?callbackUrl=%2Finicio", {
      waitUntil: "networkidle",
    });
    await expectViewportFit(page);
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }),
    ).toHaveAttribute("href", "/forgot-password");

    // Exercise the existing failure UI without authenticating or changing data.
    const submissions: URLSearchParams[] = [];
    await page.route("**/api/auth/callback/credentials", (route) => {
      submissions.push(new URLSearchParams(route.request().postData() ?? ""));
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          url: `${new URL(page.url()).origin}/login?error=CredentialsSignin`,
        }),
      });
    });
    await page
      .getByRole("button", { name: "Iniciar Sesión", exact: true })
      .click();
    expect(submissions).toHaveLength(0);
    await page.getByLabel("Correo electrónico").fill("invalid@example.com");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("invalid-password");
    await page
      .getByRole("button", { name: "Iniciar Sesión", exact: true })
      .click();
    await expect(
      page.getByText(
        "Credenciales inválidas. Por favor, verifica tu correo y contraseña.",
      ),
    ).toBeVisible();
    expect(submissions).toHaveLength(1);
    expect(submissions[0].get("email")).toBe("invalid@example.com");
    expect(submissions[0].get("password")).toBe("invalid-password");
    expect(submissions[0].get("callbackUrl")).toBe("/inicio");
    await expect(page.getByLabel("Correo electrónico")).toBeEnabled();
    await expectViewportFit(page);
  });
}
