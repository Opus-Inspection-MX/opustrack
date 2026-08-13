import { expect, type Locator, type Page, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db } from "./fixtures/db";
import { createTrackingFixture, type TrackingFixture } from "./fixtures/flows";
import {
  fillStable,
  pickFromCombobox,
  pickFromSelect,
  selectByFieldId,
} from "./fixtures/forms";

/**
 * Seguimiento de Atención (RF-513 … RF-517).
 *
 * The operational screen: filters, folio search, assignment creation and inline
 * editing of incidents and assignments, all on one table.
 *
 * The rule with teeth is RF-514/RF-025: assigning an FSR from here *enables*
 * them on the incident rather than demanding they already were. The picker
 * offers every FSR — the Cliente link only decides who is badged and sorted
 * first — and it is multi-select, so an assignment keeps all of its people.
 */

test.use({ storageState: authFile("admin") });

// Serial: every test edits the same incident and its assignment.
test.describe.configure({ mode: "serial" });

const PAGE = "/admin/tracking";

let fixture: TrackingFixture;

test.beforeAll(async () => {
  fixture = await createTrackingFixture();
});

/** Search by folio and wait for the table to hold exactly that incident. */
async function searchFolio(page: Page, folio: string) {
  await fillStable(page.locator("#folio"), folio);
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(incidentRow(page)).toBeVisible();
}

/** The row of the fixture incident. */
function incidentRow(page: Page) {
  return page
    .getByRole("row")
    .filter({ hasText: `INC-${fixture.incidentId}` })
    .first();
}

/**
 * Expand the fixture incident and return its detail panel.
 *
 * The detail row is the sibling right after the incident row; scoping to it
 * matters because "Edición Rápida" appears once for the incident and once per
 * assignment.
 */
async function expandIncident(page: Page) {
  await incidentRow(page).getByRole("button").first().click();

  const details = page
    .getByRole("row")
    .filter({ hasText: "Detalles del Incidente" });
  await expect(details).toBeVisible();
  return details;
}

/**
 * Open the inline editor of the fixture's assignment.
 *
 * The expanded panel is ONE table row holding both the incident details and its
 * assignments, so "Edición Rápida" appears twice inside it: the incident's
 * first, the assignment's second. Filtering rows by the `AS-n` folio does not
 * disambiguate — the collapsed summary row shows that folio too.
 */
async function editAssignment(details: Locator) {
  await details.getByRole("button", { name: "Edición Rápida" }).nth(1).click();
  await expect(details.getByText("Editar Asignación")).toBeVisible();
}

/**
 * Toggle one FSR in the assignment's multi-select.
 *
 * Searched by email, not by name: the seed ships "FSR User", "FSR User 2" and
 * "FSR User 3", so a name substring resolves to three options and trips
 * Playwright's strict mode. The email is unique and the component searches on
 * `label + sublabel`, so one option survives the filter.
 */
async function pickFsr(page: Page, email: string) {
  await pickFromCombobox(page, {
    trigger: page.locator(`#wo-fsr-${fixture.assignmentId}`),
    searchPlaceholder: "Buscar FSR...",
    search: email,
    closeAfter: true,
  });
}

/** Active rows linking one FSR to the fixture's assignment. */
function countAssignee(userId: string) {
  return db().assignmentAssignee.count({
    where: { assignmentId: fixture.assignmentId, userId, active: true },
  });
}

test("carga el seguimiento con el incidente y su asignación", async ({
  page,
}) => {
  await page.goto(PAGE);

  await expect(
    page.getByRole("heading", { name: "Seguimiento de Atención" }),
  ).toBeVisible();

  await searchFolio(page, `INC-${fixture.incidentId}`);

  const row = incidentRow(page);
  await expect(row).toContainText(fixture.incidentTitle);
  await expect(row).toContainText(fixture.clienteName);
  await expect(row).toContainText(`AS-${fixture.assignmentFolio}`);
});

test("busca el folio en sus tres formas (RF-513)", async ({ page }) => {
  await page.goto(PAGE);

  // INC-n → the incident id.
  await searchFolio(page, `INC-${fixture.incidentId}`);
  await expect(incidentRow(page)).toContainText(fixture.incidentTitle);

  // AS-n → the assignment folio, which resolves to its incident.
  await searchFolio(page, `AS-${fixture.assignmentFolio}`);
  await expect(incidentRow(page)).toContainText(fixture.incidentTitle);

  // Bare digits → either of the two. The incident id is the one that matches
  // here; what the test pins is that the search does not come back empty.
  await searchFolio(page, String(fixture.incidentId));
  await expect(incidentRow(page)).toContainText(fixture.incidentTitle);
});

test("un folio inexistente no devuelve resultados", async ({ page }) => {
  await page.goto(PAGE);

  await fillStable(page.locator("#folio"), "INC-99999999");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("No se encontraron incidentes")).toBeVisible();
});

test("filtra por Cliente y por estado", async ({ page }) => {
  await page.goto(PAGE);

  await pickFromSelect(
    page,
    selectByFieldId(page, "clienteId"),
    `${fixture.clienteName} (${fixture.clienteCode})`,
  );
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(incidentRow(page)).toBeVisible();

  // Narrowing further by the incident's own status keeps it on screen…
  await pickFromSelect(page, selectByFieldId(page, "statusId"), "ABIERTO");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(incidentRow(page)).toBeVisible();

  // …and the filters can be cleared back to the unfiltered list.
  await page.getByRole("button", { name: "Limpiar Filtros" }).click();
  await expect(page.locator("#folio")).toHaveValue("");
});

test("un rango de fechas que excluye el incidente lo saca de la lista", async ({
  page,
}) => {
  await page.goto(PAGE);

  await fillStable(page.locator("#startDate"), "2020-01-01");
  await fillStable(page.locator("#endDate"), "2020-01-31");
  await page.getByRole("button", { name: "Buscar" }).click();

  await expect(page.getByText("No se encontraron incidentes")).toBeVisible();
});

test("edita el incidente en línea y persiste (RF-516)", async ({ page }) => {
  const newTitle = `${fixture.incidentTitle} EDITADO`;

  await page.goto(PAGE);
  await searchFolio(page, `INC-${fixture.incidentId}`);

  const details = await expandIncident(page);
  await details.getByRole("button", { name: "Edición Rápida" }).first().click();

  await fillStable(details.locator("#title"), newTitle);
  await details.getByRole("button", { name: "Guardar" }).first().click();

  // The table reloads through a callback, not a revalidation — the database is
  // what proves the write landed.
  await expect
    .poll(
      async () => {
        const incident = await db().incident.findUnique({
          where: { id: fixture.incidentId },
          select: { title: true },
        });
        return incident?.title ?? null;
      },
      { timeout: 15_000 },
    )
    .toBe(newTitle);

  fixture.incidentTitle = newTitle;
});

test("asigna un FSR a la asignación (RF-515)", async ({ page }) => {
  await page.goto(PAGE);
  await searchFolio(page, `INC-${fixture.incidentId}`);
  const details = await expandIncident(page);

  await editAssignment(details);

  await pickFsr(page, fixture.enabledFsrEmail);
  await details.getByRole("button", { name: "Guardar" }).first().click();

  await expect
    .poll(() => countAssignee(fixture.enabledFsrId), { timeout: 15_000 })
    .toBe(1);
});

test("asignar a un FSR ajeno al Cliente lo habilita en la incidencia (RF-514)", async ({
  page,
}) => {
  await page.goto(PAGE);
  await searchFolio(page, `INC-${fixture.incidentId}`);
  const details = await expandIncident(page);

  await editAssignment(details);

  // The outsider covers a different Cliente and was never enabled on this
  // incident. The picker still offers him — the Cliente link is a badge, not a
  // filter — and saving grants the enablement instead of rejecting it. Before,
  // the same person could be chosen when *creating* an assignment and was
  // refused when *editing* one, which is the error operators reported.
  await pickFsr(page, fixture.outsiderFsrEmail);
  await details.getByRole("button", { name: "Guardar" }).first().click();

  await expect
    .poll(() => countAssignee(fixture.outsiderFsrId), { timeout: 15_000 })
    .toBe(1);

  // The enablement was created, not required.
  expect(
    await db().incidentAssignee.count({
      where: {
        incidentId: fixture.incidentId,
        userId: fixture.outsiderFsrId,
        active: true,
      },
    }),
  ).toBe(1);
});

test("reabrir el editor y guardar sin tocar nada conserva a TODOS los FSR", async ({
  page,
}) => {
  // The previous two tests left both FSRs on the assignment. The editor used to
  // load only `assignees[0]` and send a one-element array, and the server
  // deactivates whoever is missing from that array — so merely opening and
  // saving silently dropped everyone but the first.
  expect(await countAssignee(fixture.enabledFsrId)).toBe(1);
  expect(await countAssignee(fixture.outsiderFsrId)).toBe(1);

  await page.goto(PAGE);
  await searchFolio(page, `INC-${fixture.incidentId}`);
  const details = await expandIncident(page);

  await editAssignment(details);
  await details.getByRole("button", { name: "Guardar" }).first().click();
  await expect(details.getByText("Editar Asignación")).toBeHidden();

  expect(await countAssignee(fixture.enabledFsrId)).toBe(1);
  expect(await countAssignee(fixture.outsiderFsrId)).toBe(1);
});
