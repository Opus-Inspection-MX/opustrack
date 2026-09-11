import { expect, type Page } from "@playwright/test";

/**
 * Navega y espera la hidratación de React.
 *
 * El HTML del servidor ya trae los botones, pero sin sus handlers hasta que
 * el cliente hidrata (`HydrationMarker` en `src/app/layout.tsx` pone
 * `data-hydrated` en `<html>`). Un clic en esa ventana no hace nada — el
 * caso visto en CI fue el "Más" de la tab bar que nunca abrió el menú.
 * Úsalo en todo spec que haga clic justo después de navegar.
 */
export async function gotoReady(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "networkidle" });
  await expect(
    page.locator('html[data-hydrated="true"]'),
    `${path}: React hidratado`,
  ).toBeAttached({ timeout: 15_000 });
}
