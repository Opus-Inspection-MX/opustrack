import { expect, type Page, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db } from "./fixtures/db";
import { createScheduleFixture, type ScheduleFixture } from "./fixtures/flows";
import {
  fillStable,
  pickFromCombobox,
  selectByFieldId,
} from "./fixtures/forms";

/**
 * Asignación de Programación (RF-400 … RF-409).
 *
 * The screen the administrator plans from: a calendar, a dialog to create a
 * programación, another to select one, and — with one selected — a dialog that
 * creates incidents inside it.
 *
 * It is the one screen driven by REST endpoints instead of Server Actions, so
 * nothing here is revalidated by the framework: every assertion that matters is
 * confirmed against the database.
 */

test.use({ storageState: authFile("admin") });

// Serial: the tests build on one programación, and two workers editing the
// same schedule race each other.
test.describe.configure({ mode: "serial" });

const PAGE = "/admin/programacion";

let fixture: ScheduleFixture;
let scheduleTitle: string;

/** `YYYY-MM-DD` in the browser's local time, which is what a `type=date` reads. */
function localDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * The dialog on screen — all three are `ResponsiveDialog`.
 *
 * NOT `getByRole("dialog")`: Radix gives `PopoverContent` that same role and
 * leaves it in the DOM after closing, so as soon as a combobox has been opened
 * the role resolves to two elements and every assertion on the modal dies of a
 * strict-mode violation. `data-slot` names the actual dialog surface.
 */
function dialog(page: Page) {
  return page.locator('[data-slot="dialog-content"]');
}

/**
 * Open `SelectScheduleDialog` and pick the programación by title.
 *
 * Each test gets its own page, so the selection — which lives in React state,
 * not the URL — has to be redone by whoever needs it.
 */
async function selectSchedule(page: Page, title: string): Promise<void> {
  await page.getByRole("button", { name: "Seleccionar Programación" }).click();

  const modal = dialog(page);
  await expect(modal).toBeVisible();
  // Filtering first keeps the row click off whatever the previous runs left in
  // the list — the same mistake that renamed real catalog rows.
  await fillStable(modal.getByPlaceholder("Buscar programación..."), title);

  const row = modal.getByRole("row").filter({ hasText: title });
  await expect(row).toHaveCount(1);
  await row.click();

  await modal.getByRole("button", { name: "Seleccionar", exact: true }).click();
  await expect(modal).toBeHidden();

  // The selection is confirmed by the contextual controls it unlocks (RF-408).
  await expect(
    page.getByRole("button", { name: "Limpiar Selección" }),
  ).toBeVisible();
}

test.beforeAll(async () => {
  fixture = await createScheduleFixture();
  scheduleTitle = `E2E Programación ${fixture.suffix}`;
});

test("el calendario carga con la semana actual", async ({ page }) => {
  await page.goto(PAGE);

  await expect(
    page.getByRole("heading", { name: "Asignación de Programación" }),
  ).toBeVisible();
  // `CardTitle` renders a div, not a heading — the panel is matched by text.
  await expect(page.getByText("Actividades Programadas")).toBeVisible();

  // A week range is the default, and the contextual button reflects it.
  await expect(
    page.getByRole("button", { name: "Nueva Programación" }),
  ).toBeVisible();
});

test("crea una programación con Cliente (RF-402)", async ({ page }) => {
  await page.goto(PAGE);
  await page.getByRole("button", { name: "Nueva Programación" }).click();

  const modal = dialog(page);
  await expect(modal).toBeVisible();

  await fillStable(modal.locator("#title"), scheduleTitle);
  await fillStable(
    modal.locator("#description"),
    "Programación creada por la suite e2e.",
  );

  await pickFromCombobox(page, {
    trigger: selectByFieldId(page, "clienteId"),
    searchPlaceholder: "Buscar Cliente...",
    search: fixture.clienteCode,
    option: `${fixture.clienteName} (${fixture.clienteCode})`,
  });

  // A range wide enough that an incident created "today" falls inside it.
  await fillStable(modal.locator("#scheduledAt"), localDate(-1));
  await fillStable(modal.locator("#endDate"), localDate(7));

  await modal.getByRole("button", { name: "Crear Programación" }).click();
  await expect(modal).toBeHidden();

  // The dialog POSTs to /api/schedules and only calls router.refresh(); nothing
  // in the UI proves the row landed, so the database does.
  await expect
    .poll(
      async () => {
        const schedule = await db().schedule.findFirst({
          where: { title: scheduleTitle, active: true },
          select: {
            id: true,
            endDate: true,
            clientes: {
              where: { active: true },
              select: { clienteId: true },
            },
          },
        });
        return schedule
          ? {
              hasEnd: schedule.endDate !== null,
              clientes: schedule.clientes.map((c) => c.clienteId),
            }
          : null;
      },
      { timeout: 15_000 },
    )
    .toEqual({ hasEnd: true, clientes: [fixture.clienteId] });
});

test("la selecciona y ajusta el rango del calendario (RF-403)", async ({
  page,
}) => {
  await page.goto(PAGE);
  await selectSchedule(page, scheduleTitle);

  // The activities panel now scopes itself to the selected programación.
  await expect(page.getByText(`Programación: ${scheduleTitle}`)).toBeVisible();
});

test("crea un incidente dentro de la programación, con Centro (RF-407)", async ({
  page,
}) => {
  const incidentTitle = `E2E Incidente Programado ${fixture.suffix}`;

  await page.goto(PAGE);
  await selectSchedule(page, scheduleTitle);

  await page
    .getByRole("button", { name: "Nuevo Incidente en Programación" })
    .click();

  const modal = dialog(page);
  await expect(modal).toBeVisible();
  // The title shows twice: in the dialog description and in the summary box.
  await expect(modal.getByText(scheduleTitle).first()).toBeVisible();

  await fillStable(modal.locator("#title"), incidentTitle);
  await fillStable(
    modal.locator("#description"),
    "Incidente creado desde la programación por la suite e2e.",
  );
  await selectByFieldId(page, "typeId").click();
  await page.getByRole("option").first().click();

  // Centro is required: without it the incident is stored with clienteId null
  // and the multi-tenant scoping hides it from every non-admin role.
  await selectByFieldId(page, "clienteId").click();
  await page
    .getByRole("option", {
      name: `${fixture.clienteCode} — ${fixture.clienteName}`,
      exact: true,
    })
    .click();

  await fillStable(modal.locator("#scheduledDate"), localDate());
  await modal.getByRole("button", { name: "Crear Incidente" }).click();
  await expect(modal).toBeHidden();

  const incident = await expectIncident(incidentTitle);
  expect(incident.clienteId).toBe(fixture.clienteId);
  expect(incident.scheduleId).not.toBeNull();

  const schedule = await db().schedule.findFirstOrThrow({
    where: { title: scheduleTitle, active: true },
    select: { id: true },
  });
  expect(incident.scheduleId).toBe(schedule.id);

  // And it shows up in the activities panel of that programación.
  await page.reload();
  await selectSchedule(page, scheduleTitle);
  await expect(page.getByText(incidentTitle).first()).toBeVisible();
});

test("el botón principal cambia según haya programación seleccionada (RF-408)", async ({
  page,
}) => {
  await page.goto(PAGE);

  // Without a selection it creates a programación…
  await page.getByRole("button", { name: "Nueva Programación" }).click();
  await expect(
    dialog(page).getByRole("heading", { name: "Nueva Programación" }),
  ).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog(page)).toBeHidden();

  // …and with one, an incident inside it.
  await selectSchedule(page, scheduleTitle);
  await expect(
    page.getByRole("button", { name: "Nueva Programación" }),
  ).toBeHidden();

  await page
    .getByRole("button", { name: "Nuevo Incidente en Programación" })
    .click();
  await expect(
    dialog(page).getByRole("heading", {
      name: "Nuevo Incidente en Programación",
    }),
  ).toBeVisible();
});

test("limpia la selección y vuelve al modo programación", async ({ page }) => {
  await page.goto(PAGE);
  await selectSchedule(page, scheduleTitle);

  await page.getByRole("button", { name: "Limpiar Selección" }).click();

  await expect(
    page.getByRole("button", { name: "Limpiar Selección" }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Nuevo Incidente en Programación" }),
  ).toBeHidden();
});

/** Poll until the incident created through the REST endpoint is visible. */
async function expectIncident(title: string) {
  let found: {
    clienteId: string | null;
    scheduleId: string | null;
  } | null = null;

  await expect(async () => {
    found = await db().incident.findFirst({
      where: { title, active: true },
      select: { clienteId: true, scheduleId: true },
      orderBy: { id: "desc" },
    });
    expect(found, `incidente "${title}"`).not.toBeNull();
  }).toPass({ timeout: 15_000 });

  return found as unknown as {
    clienteId: string | null;
    scheduleId: string | null;
  };
}
