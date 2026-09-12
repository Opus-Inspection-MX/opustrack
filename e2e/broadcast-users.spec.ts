import { expect, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { fillFieldById } from "./fixtures/forms";
import { gotoReady } from "./fixtures/navigation";

/**
 * Direct-user broadcasts (Parte C), through the real composer.
 *
 * An operations admin addresses ONE specific user: that user sees the
 * broadcast in `/notifications` while another user sees nothing. The
 * reach rule itself (role + shared Client) is pinned at the action layer
 * in `src/test/integration/broadcasts-users.int.test.ts` — here the point
 * is the composer mode, the dispatch, and the per-user delivery.
 */

test.describe.configure({ mode: "serial" });

const SUFFIX = uniqueSuffix();
const TITLE = `E2E Directa ${SUFFIX}`;

test.describe("difusión a un usuario específico", () => {
  test.use({ storageState: authFile("admin-operacion") });

  test("componer y enviar a un FSR concreto", async ({ page }) => {
    const fsr = await db().user.findFirstOrThrow({
      where: { email: process.env.E2E_FSR_EMAIL },
      select: { email: true },
    });

    await gotoReady(page, "/admin/notifications");
    await fillFieldById(page, "title", TITLE);
    await fillFieldById(page, "message", "Aviso directo de la suite e2e.");
    await page.getByRole("radio", { name: "Usuarios específicos" }).check();
    await fillFieldById(page, "broadcast-user-search", fsr.email);
    await page
      .getByRole("button", { name: /^Agregar a / })
      .first()
      .click();
    await expect(page.getByText("Seleccionados (1)")).toBeVisible();
    await expect(
      page.locator("p", { hasText: "Destinatarios estimados:" }),
    ).toContainText("1");
    await page.getByRole("button", { name: "Enviar ahora" }).click();

    // The sent broadcast lands in the history table.
    await expect(page.getByText(TITLE).first()).toBeVisible();
  });
});

test.describe("entrega por usuario", () => {
  test.use({ storageState: authFile("fsr") });

  test("el destinatario la ve en /notifications", async ({ page }) => {
    await gotoReady(page, "/notifications");
    await expect(page.getByText(TITLE)).toBeVisible();
  });
});

test.describe("aislamiento por usuario", () => {
  test.use({ storageState: authFile("reporter") });

  test("otro usuario no la recibe", async ({ page }) => {
    await gotoReady(page, "/notifications");
    await expect(page.getByText(TITLE)).toHaveCount(0);
  });
});
