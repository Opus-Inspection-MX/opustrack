import { expect, test } from "@playwright/test";
import { NOTIFICATION_TYPES } from "../src/lib/notifications/notification-types";
import { account, authFile } from "./fixtures/auth";
import {
  db,
  disconnectDb,
  expectAssignmentForIncident,
  expectAssignmentStatus,
  expectIncidentStatus,
  expectNoNotification,
  expectNotification,
  findIncidentByTitle,
  prepareAssignmentForClose,
  uniqueSuffix,
} from "./fixtures/db";
import {
  comboboxByLabel,
  fillFieldById,
  pickFromCombobox,
} from "./fixtures/forms";

/**
 * E2E coverage for the business flow described in spec/00-overview.md:
 *
 *   Cliente reporta incidente
 *     → Admin lo programa y crea la asignación
 *       → FSR da Visto, inicia en sitio, y cierra
 *         → el incidente se cierra AUTOMÁTICAMENTE
 *
 * The chain is driven through the real UI of each role. What the UI cannot show
 * — the incident status derived from its assignments, and the notification rows
 * — is asserted against the database.
 *
 * Serial by nature: every step consumes what the previous one produced.
 */

const SUFFIX = uniqueSuffix();
const INCIDENT_TITLE = `E2E ciclo de vida ${SUFFIX}`;
const SCHEDULE_TITLE = `E2E programación ${SUFFIX}`;

/** Shared across steps. */
let incidentId: number;
let assignmentId: string;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await disconnectDb();
});

// ---------------------------------------------------------------------------
// 1 · El CLIENTE reporta el incidente (RF-200, RF-465)
// ---------------------------------------------------------------------------
test.describe("1 · El cliente reporta el incidente", () => {
  test.use({ storageState: authFile("client") });

  test("crea el incidente y queda ABIERTO", async ({ page }) => {
    await page.goto("/client/new");

    await fillFieldById(page, "title", INCIDENT_TITLE);
    await fillFieldById(
      page,
      "description",
      "Incidente generado por la suite e2e del ciclo de vida.",
    );

    // Radix Select: trigger, then the listbox option.
    await page.getByText("Selecciona el tipo de incidente").click();
    await page.getByRole("option").first().click();

    await page.getByRole("button", { name: "Enviar Reporte" }).click();

    // On success the page navigates back to the client dashboard.
    await page.waitForURL("**/client");

    const incident = await findIncidentByTitle(INCIDENT_TITLE);
    expect(incident, "el incidente debe existir").not.toBeNull();
    incidentId = (incident as NonNullable<typeof incident>).id;

    expect(incident?.statusName).toBe("ABIERTO");
    // A CLIENT always reports on behalf of its own Cliente.
    expect(incident?.clienteId).not.toBeNull();
    expect(incident?.reportedById).not.toBeNull();
  });

  test("notifica a los administradores, no a quien lo reportó", async () => {
    await expectNotification({
      userEmail: account("admin").email,
      type: NOTIFICATION_TYPES.INCIDENT_CREATED,
      entityId: String(incidentId),
    });

    // emit() always excludes the actor (notify-events.ts).
    await expectNoNotification({
      userEmail: account("client").email,
      type: NOTIFICATION_TYPES.INCIDENT_CREATED,
      entityId: String(incidentId),
    });
  });
});

// ---------------------------------------------------------------------------
// 2 y 3 · El ADMIN programa y asigna (RF-400, RF-250, RF-452)
// ---------------------------------------------------------------------------
test.describe("2 · El admin programa y asigna", () => {
  test.use({ storageState: authFile("admin") });

  test("crea la programación del mes", async ({ page }) => {
    await page.goto("/admin/schedules/new");

    await fillFieldById(page, "title", SCHEDULE_TITLE);
    await fillFieldById(page, "scheduledAt", "2026-08-17T09:00");

    await pickFromCombobox(page, {
      trigger: comboboxByLabel(page, "Clientes"),
      closeAfter: true,
    });

    await page.getByRole("button", { name: "Crear Programación" }).click();
    await page.waitForURL(/\/admin\/schedules$/);

    const schedule = await db().schedule.findFirst({
      where: { title: SCHEDULE_TITLE, active: true },
      select: { id: true, clientes: { select: { clienteId: true } } },
    });

    expect(schedule, "la programación debe existir").not.toBeNull();
    expect(schedule?.clientes.length).toBeGreaterThan(0);

    // Link the incident to it — the programación screen does this through a
    // dialog that is covered by its own module; here we only need the relation
    // so the assignment step reflects a programmed incident.
    await db().incident.update({
      where: { id: incidentId },
      data: { scheduleId: schedule?.id },
    });

    const linked = await findIncidentByTitle(INCIDENT_TITLE);
    expect(linked?.scheduleId).toBe(schedule?.id);
  });

  test("crea la asignación y el incidente pasa a ASIGNADO", async ({
    page,
  }) => {
    await page.goto("/admin/assignments/new");

    await pickFromCombobox(page, {
      trigger: comboboxByLabel(page, "Incidente *"),
      searchPlaceholder: "Buscar incidente...",
      search: INCIDENT_TITLE,
      option: INCIDENT_TITLE,
    });

    const fsrName = (
      await db().user.findUniqueOrThrow({
        where: { email: account("fsr").email },
        select: { name: true },
      })
    ).name;

    await pickFromCombobox(page, {
      trigger: comboboxByLabel(page, "Asignados *"),
      searchPlaceholder: "Buscar FSR...",
      search: fsrName,
      option: fsrName,
      closeAfter: true,
    });

    await page
      .getByRole("button", { name: /Crear Asignación|Guardar/ })
      .click();
    await page.waitForURL("**/admin/assignments**");

    assignmentId = await expectAssignmentForIncident(incidentId);

    // The state machine owns the status: first assignee ⇒ ASIGNADO.
    await expectAssignmentStatus(assignmentId, "ASIGNADO");
    // …and the incident derives from it.
    await expectIncidentStatus(incidentId, "ASIGNADO");
  });

  test("notifica al FSR asignado", async () => {
    await expectNotification({
      userEmail: account("fsr").email,
      type: NOTIFICATION_TYPES.ASSIGNMENT_ASSIGNED,
      entityId: assignmentId,
    });
  });
});

// ---------------------------------------------------------------------------
// 4, 5 y 6 · El FSR ejecuta y cierra (RF-251..RF-254, RF-463, RF-467)
// ---------------------------------------------------------------------------
test.describe("3 · El FSR ejecuta el trabajo", () => {
  test.use({
    storageState: authFile("fsr"),
    // startAssignmentWork/closeAssignment capture GPS before transitioning.
    geolocation: { latitude: 19.0414, longitude: -98.2063 },
    permissions: ["geolocation"],
  });

  test("da Visto y el incidente pasa a VISTO", async ({ page }) => {
    await page.goto(`/fsr/assignments/${assignmentId}`);

    await page.getByRole("button", { name: "Marcar como visto" }).click();

    const assignment = await expectAssignmentStatus(assignmentId, "VISTO");
    expect(assignment.seenAt, "seenAt se registra al dar visto").not.toBeNull();
    expect(assignment.seenById).not.toBeNull();

    await expectIncidentStatus(incidentId, "VISTO");
  });

  test("inicia el trabajo y captura GPS", async ({ page }) => {
    await page.goto(`/fsr/assignments/${assignmentId}`);

    // handleStartWork/handleCloseWork use window.confirm(); Playwright
    // dismisses dialogs by default, which would cancel the transition.
    page.on("dialog", (dialog) => dialog.accept());

    await page.getByRole("button", { name: "Iniciar trabajo" }).click();

    const assignment = await expectAssignmentStatus(assignmentId, "INICIADO");
    expect(assignment.startLatitude, "GPS de inicio").not.toBeNull();
    expect(assignment.startLongitude).not.toBeNull();

    await expectIncidentStatus(incidentId, "INICIADO");
  });

  test("cierra el trabajo y el incidente se cierra automáticamente", async ({
    page,
  }) => {
    // Preconditions the page enforces before enabling "Cerrar trabajo".
    await prepareAssignmentForClose(assignmentId);

    await page.goto(`/fsr/assignments/${assignmentId}`);
    page.on("dialog", (dialog) => dialog.accept());

    const closeButton = page.getByRole("button", { name: "Cerrar trabajo" });
    await expect(closeButton).toBeEnabled();
    await closeButton.click();

    const assignment = await expectAssignmentStatus(assignmentId, "CERRADO");
    expect(assignment.finishedAt, "finishedAt al cerrar").not.toBeNull();
    expect(assignment.endLatitude, "GPS de cierre").not.toBeNull();

    // The point of the whole spec: the incident closes on its own because
    // every one of its assignments closed (syncIncidentState).
    const incident = await expectIncidentStatus(incidentId, "CERRADO");
    expect(incident.resolvedAt, "resolvedAt del incidente").not.toBeNull();
  });

  test("notifica el cierre a admin y al reportante", async () => {
    await expectNotification({
      userEmail: account("admin").email,
      type: NOTIFICATION_TYPES.ASSIGNMENT_COMPLETED,
      entityId: assignmentId,
    });

    await expectNotification({
      userEmail: account("client").email,
      type: NOTIFICATION_TYPES.INCIDENT_CLOSED,
      entityId: String(incidentId),
    });
  });
});
