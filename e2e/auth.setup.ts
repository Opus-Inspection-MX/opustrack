import fs from "node:fs";
import path from "node:path";
import { expect, test as setup } from "@playwright/test";
import { account, authFile, ROLES } from "./fixtures/auth";
import { submitLogin } from "./fixtures/login";

/**
 * Authentication setup. Runs once (as the `setup` project dependency) before the
 * browser test projects. It logs in each role through the real login UI and
 * persists the resulting session cookies as storage state, so specs can reuse an
 * authenticated context without re-typing credentials every test.
 *
 * Requires the app running and the accounts provisioned by `db.setup.ts`
 * (this project depends on it).
 */
for (const role of ROLES) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    const { email, password, defaultPath } = account(role);

    await page.goto("/login");
    await submitLogin(page, email, password);

    // On success the form does a hard navigation to "/", and the middleware
    // redirects to the role's defaultPath.
    await page.waitForURL(`**${defaultPath}`);
    await expect(page).toHaveURL(new RegExp(`${defaultPath}$`));

    const file = authFile(role);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.context().storageState({ path: file });
  });
}
