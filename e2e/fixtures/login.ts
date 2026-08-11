import type { Page } from "@playwright/test";
import { fillStableAll } from "./forms";

/**
 * Log in through the real login UI.
 *
 * Both inputs are filled and verified as a unit: they are React-controlled and
 * hydration can wipe one of them right after the other was typed. See forms.ts.
 */
export async function fillLoginForm(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await fillStableAll([
    [page.locator("#email"), email],
    [page.locator("#password"), password],
  ]);
}

/** Fill the login form and submit it. */
export async function submitLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await fillLoginForm(page, email, password);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
}
