import { expect, type Page, test } from "@playwright/test";
import { account, authFile } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { createTrackingFixture, type TrackingFixture } from "./fixtures/flows";
import { fillStable, pickFromCombobox } from "./fixtures/forms";

/**
 * Business rules reaching the user — in a PRODUCTION build.
 *
 * This spec exists because of a bug that is invisible in development: Next
 * replaces the message of anything a Server Action throws with "An error
 * occurred in the Server Components render. The specific message is omitted in
 * production builds…". Every rule in the app used to be thrown, so on Vercel the
 * user got a generic error — or, for the catalog deletes, nothing at all.
 *
 * The suite runs against `next start` (see `webServer` in playwright.config),
 * which is the only reason these assertions mean anything. Under `next dev` the
 * message arrives either way and the tests would pass without a fix.
 */

test.use({ storageState: authFile("admin") });
test.describe.configure({ mode: "serial" });

/**
 * The toast for a rejection.
 *
 * A destructive toast is `role="alert"` — assertive, because the user has to
 * read it to know what to change. Informational ones are `role="status"`.
 */
function errorToast(page: Page, text: string | RegExp) {
  return page.getByRole("alert").filter({ hasText: text });
}

test("un catálogo con hijos no se elimina, y el usuario ve por qué", async ({
  page,
}) => {
  const suffix = uniqueSuffix();

  // A status of its own, with no children yet: the list will render its delete
  // button enabled, because the count it shows is zero.
  const status = await db().incidentStatus.create({
    data: { name: `E2E Estado ${suffix}`, color: "#888888" },
    select: { id: true, name: true },
  });

  await page.goto("/admin/incident-status");
  await fillStable(page.getByRole("searchbox"), status.name);

  const row = page.getByRole("row").filter({ hasText: status.name });
  await expect(row).toHaveCount(1);

  // Now give it a child, AFTER the page has loaded. This is the scenario the
  // server guard exists for: the client-side hint that disables the button is
  // computed from data fetched earlier and is now stale, so the only thing
  // standing between the user and an orphaned incident is the action itself.
  const [type, cliente] = await Promise.all([
    db().incidentType.findFirstOrThrow({ where: { active: true } }),
    db().cliente.findFirstOrThrow({ where: { active: true } }),
  ]);
  await db().incident.create({
    data: {
      title: `E2E Incidente del estado ${suffix}`,
      description: "Hace que el estado no se pueda eliminar.",
      typeId: type.id,
      statusId: status.id,
      clienteId: cliente.id,
    },
  });

  await row.getByRole("button", { name: "Eliminar" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^(Eliminar|Confirmar)$/ }).click();

  await expect(errorToast(page, /No se puede eliminar/)).toBeVisible();
  // With the real number of children, not a generic sentence.
  await expect(errorToast(page, /1 incidente\(s\)/)).toBeVisible();

  const after = await db().incidentStatus.findUnique({
    where: { id: status.id },
    select: { active: true },
  });
  expect(after?.active).toBe(true);
});

test("la contraseña actual equivocada se explica, no se generaliza", async ({
  page,
}) => {
  // A password change bumps sessionVersion to invalidate the existing JWTs, so
  // the counter is the proof the update never ran. Read before, not assumed:
  // the e2e accounts are provisioned by db.setup.ts and start wherever it left
  // them.
  const before = await db().user.findUniqueOrThrow({
    where: { email: account("admin").email },
    select: { sessionVersion: true },
  });

  await page.goto("/admin/profile");
  await page.getByRole("button", { name: "Cambiar Contraseña" }).click();

  await fillStable(page.locator("#currentPassword"), "contrasena-incorrecta");
  await fillStable(page.locator("#newPassword"), "OtraPassword123!");
  await fillStable(page.locator("#confirmPassword"), "OtraPassword123!");

  await page.getByRole("button", { name: "Cambiar Contraseña" }).last().click();

  await expect(
    errorToast(page, /La contraseña actual es incorrecta/i),
  ).toBeVisible();

  const after = await db().user.findUniqueOrThrow({
    where: { email: account("admin").email },
    select: { sessionVersion: true },
  });
  expect(after.sessionVersion).toBe(before.sessionVersion);
});

test.describe("regla de negocio devuelta desde Seguimiento", () => {
  let fixture: TrackingFixture;
  /**
   * An FSR created just for this test.
   *
   * It cannot be one of the seed's shared FSRs: the test deactivates it
   * mid-flight, and the tracking spec runs against those same accounts.
   */
  let doomedFsr: { id: string; email: string };

  test.beforeAll(async () => {
    fixture = await createTrackingFixture();

    const suffix = uniqueSuffix();
    const [fsrRole, activeStatus] = await Promise.all([
      db().role.findUniqueOrThrow({ where: { name: "FSR" } }),
      db().userStatus.findFirstOrThrow({ where: { name: "ACTIVO" } }),
    ]);
    doomedFsr = await db().user.create({
      data: {
        email: `e2e.fsr.${suffix}@opusinspection.com`,
        name: `E2E FSR Efímero ${suffix}`,
        // Never signed in with; the account exists only to be picked.
        password: "no-usable",
        roleId: fsrRole.id,
        userStatusId: activeStatus.id,
      },
      select: { id: true, email: true },
    });
  });

  test("muestra el motivo exacto en un toast", async ({ page }) => {
    await page.goto("/admin/tracking");

    await fillStable(page.locator("#folio"), `INC-${fixture.incidentId}`);
    await page.getByRole("button", { name: "Buscar" }).click();

    const row = page
      .getByRole("row")
      .filter({ hasText: `INC-${fixture.incidentId}` })
      .first();
    await expect(row).toBeVisible();
    await row.getByRole("button").first().click();

    const details = page
      .getByRole("row")
      .filter({ hasText: "Detalles del Incidente" });
    await details
      .getByRole("button", { name: "Edición Rápida" })
      .nth(1)
      .click();

    // Searched by email: the seed's FSR names share a prefix, so a name
    // substring matches several options and trips strict mode.
    await pickFromCombobox(page, {
      trigger: page.locator(`#wo-fsr-${fixture.assignmentId}`),
      searchPlaceholder: "Buscar FSR...",
      search: doomedFsr.email,
      closeAfter: true,
    });

    // The account is deactivated AFTER the picker loaded it — the same stale
    // client the catalog test above exercises. The option is still on screen,
    // so the only thing left is the server guard, and its message has to
    // survive the trip: a production build of Next replaces the message of
    // anything a Server Action throws, so this rule is RETURNED, not thrown.
    await db().user.update({
      where: { id: doomedFsr.id },
      data: { active: false },
    });

    await details.getByRole("button", { name: "Guardar" }).first().click();

    // Not `alert()` any more, and not React's sanitized message either.
    await expect(errorToast(page, /no tienen rol FSR/)).toBeVisible();

    // And nothing was written.
    expect(
      await db().assignmentAssignee.count({
        where: {
          assignmentId: fixture.assignmentId,
          userId: doomedFsr.id,
          active: true,
        },
      }),
    ).toBe(0);
  });
});
