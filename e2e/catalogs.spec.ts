import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import {
  CATALOGS,
  type CatalogField,
  type CatalogSpec,
} from "./fixtures/catalogs";
import { db, uniqueSuffix } from "./fixtures/db";
import {
  fieldById,
  fillByLabel,
  fillStable,
  pickFromCombobox,
  pickFromSelect,
  selectByFieldId,
  submitButton,
} from "./fixtures/forms";

/**
 * CRUD of every admin catalog, driven through the real UI.
 *
 * One parameterised suite instead of sixteen specs: the catalogs share the same
 * list component and the same route shape, so only the form differs — and that
 * lives in `fixtures/catalogs.ts`. Adding a catalog means adding an entry.
 *
 * Runs on Chromium only (see the `catalogs` project in playwright.config.ts):
 * catalog CRUD is not browser-sensitive, and sixteen catalogs across five
 * browsers would triple the suite for no extra signal.
 */

test.use({ storageState: authFile("admin") });

/** Unique per run, so the suite can be re-run without recreating the database. */
const SUFFIX = uniqueSuffix();

async function fillField(
  page: Page,
  field: CatalogField,
  suffix: string,
): Promise<void> {
  switch (field.kind) {
    case "text":
    case "number":
      await fillStable(fieldById(page, field.id), field.value(suffix));
      break;
    case "label":
      await fillByLabel(page, field.label, field.value(suffix));
      break;
    case "select":
      await pickFromSelect(page, selectByFieldId(page, field.id), field.option);
      break;
    case "combobox":
      await pickFromCombobox(page, {
        trigger: selectByFieldId(page, field.id),
        searchPlaceholder: field.searchPlaceholder,
        search: field.search,
        option: field.option,
      });
      break;
  }
}

/**
 * The table row containing `text`.
 *
 * Scoping every action to its row is not a nicety: using `.first()` on the
 * action buttons meant that if the search had not filtered yet, the click
 * landed on whatever row was on top. That renamed the real `ACTIVO` user
 * status and soft-deleted `PENDIENTE` during development of this spec.
 */
function rowWith(page: Page, text: string) {
  return page.getByRole("row").filter({ hasText: text });
}

/**
 * Type into the search box and wait until the list actually reflects it.
 *
 * The search is debounced, so the rows on screen right after typing still
 * belong to the previous query. Acting on them is how a delete ended up
 * clicking a row that was about to disappear.
 */
async function searchFor(page: Page, catalog: CatalogSpec, term: string) {
  await search(page, catalog, term);
  await expect(rowWith(page, term)).toHaveCount(1);
}

/**
 * Type into the CatalogTable search box.
 *
 * The input is `type="search"`, so its ARIA role is `searchbox` — not
 * `textbox`. Its accessible name comes from the `aria-label` the component
 * sets to the placeholder.
 */
async function search(page: Page, catalog: CatalogSpec, term: string) {
  const box = page.getByRole("searchbox", { name: catalog.searchPlaceholder });
  await fillStable(box, term);
}

for (const catalog of CATALOGS) {
  test.describe(`Catálogo · ${catalog.key}`, () => {
    // Each step consumes what the previous one created.
    test.describe.configure({ mode: "serial" });

    const name = catalog.name(SUFFIX);
    const renamed = `${name} EDITADO`;

    if (catalog.prepare) {
      test.beforeAll(async () => {
        await catalog.prepare?.();
      });
    }

    test("crea un registro", async ({ page }) => {
      await page.goto(`${catalog.path}/new`);

      for (const field of catalog.fields) {
        await fillField(page, field, SUFFIX);
      }

      await submitButton(page).click();

      // Every catalog redirects back to its list on success.
      await page.waitForURL(new RegExp(`${catalog.path}$`));
      await search(page, catalog, name);
      await expect(rowWith(page, name)).toHaveCount(1);
    });

    test("lo encuentra con el buscador", async ({ page }) => {
      await page.goto(catalog.path);
      await search(page, catalog, name);

      await expect(rowWith(page, name)).toHaveCount(1);
      // The search narrowed the list rather than just highlighting.
      await expect(page.getByRole("row")).toHaveCount(2); // encabezado + 1
    });

    test("lo edita", async ({ page }) => {
      await page.goto(catalog.path);
      await search(page, catalog, name);

      await rowWith(page, name).getByRole("link", { name: "Editar" }).click();
      await page.waitForURL(/\/edit$/);

      if (catalog.identity.kind === "text") {
        await fillStable(page.locator(`#${catalog.identity.id}`), renamed);
      } else {
        await fillByLabel(page, catalog.identity.label, renamed);
      }

      await submitButton(page).click();
      await page.waitForURL(new RegExp(`${catalog.path}$`));

      await search(page, catalog, renamed);
      await expect(rowWith(page, renamed)).toHaveCount(1);
    });

    test("lo elimina", async ({ page }) => {
      await page.goto(catalog.path);
      await searchFor(page, catalog, renamed);

      await rowWith(page, renamed)
        .getByRole("button", { name: "Eliminar" })
        .click();

      // CatalogTable asks for confirmation first. ConfirmDialog is built on
      // `ui/dialog` (role="dialog", not "alertdialog"). CatalogTable overrides
      // the confirm label per catalog, so match either; scoping to the dialog
      // keeps it off the row buttons behind it.
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: /^(Eliminar|Confirmar)$/ })
        .click();

      // The dialog closes when the server action resolves.
      await expect(dialog).toBeHidden();

      // Confirmed against the database, not the list. Asserting through the UI
      // is racy here — the search is debounced, the table keeps its own client
      // state, and the action ends in a redirect — which made this step pass
      // alone and fail in the full run, on a different catalog each time. The
      // UI performs the action; the database proves it persisted.
      await expect
        .poll(
          async () => {
            const model = (
              db() as unknown as Record<
                string,
                {
                  findFirst: (
                    args: unknown,
                  ) => Promise<{ active: boolean } | null>;
                }
              >
            )[catalog.model];
            const row = await model.findFirst({ where: { name: renamed } });
            return row?.active ?? null;
          },
          { timeout: 15_000 },
        )
        .toBe(false);
    });
  });
}
