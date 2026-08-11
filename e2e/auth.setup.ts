import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { ACCOUNTS, authFile, ROLES, SEED_PASSWORD } from "./fixtures/auth";

/**
 * Authentication setup. Runs once (as the `setup` project dependency) before the
 * browser test projects. It logs in each seeded role through the real login UI
 * and persists the resulting session cookies as storage state, so specs can
 * reuse an authenticated context without re-typing credentials every test.
 *
 * Requires the app running with a seeded database (users listed in fixtures/auth.ts).
 */
for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, defaultPath } = ACCOUNTS[role];

    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Iniciar Sesión" }).click();

    // On success the form does a hard navigation to "/", and the middleware
    // redirects to the role's defaultPath.
    await page.waitForURL(`**${defaultPath}`);
    await expect(page).toHaveURL(new RegExp(`${defaultPath}$`));

    const file = authFile(role);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.context().storageState({ path: file });
  });
}
