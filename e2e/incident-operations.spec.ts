import { expect, test } from "@playwright/test";
import { account, authFile } from "./fixtures/auth";
import { db, disconnectDb, uniqueSuffix } from "./fixtures/db";
import { evidence } from "./fixtures/evidence";
import { fillFieldById } from "./fixtures/forms";

/**
 * Day-to-day incident operations, with photographic evidence of each step.
 *
 * `incident-lifecycle.spec.ts` proves the happy path end to end. What was never
 * covered is what an FSR actually spends the shift doing once the work is
 * assigned: writing down what was done, pausing and resuming, and an
 * administrator watching the same incident move from the tracking board.
 *
 * Every step photographs the screen (`evidence`), so the run leaves a folder
 * that documents the flow instead of only a green tick.
 */

const SUFFIX = uniqueSuffix();
const INCIDENT_TITLE = `E2E operativa ${SUFFIX}`;

let incidentId: number;
let assignmentId: string;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await disconnectDb();
});

/**
 * An incident already assigned to the e2e FSR.
 *
 * Set up directly rather than through the UI: the creation and assignment
 * screens are already covered by the lifecycle spec, and repeating them here
 * would make this file fail whenever those change.
 */
test.beforeAll(async () => {
  const prisma = db();
  const [type, incidentStatus, assignmentStatus, fsr] = await Promise.all([
    prisma.incidentType.findFirstOrThrow({ where: { active: true } }),
    prisma.incidentStatus.findFirstOrThrow({ where: { name: "ASIGNADO" } }),
    prisma.assignmentStatus.findFirstOrThrow({ where: { name: "ASIGNADO" } }),
    prisma.user.findFirstOrThrow({
      where: { email: account("fsr").email },
      select: { id: true },
    }),
  ]);

  // The incident must belong to a Cliente this FSR covers: reading an
  // assignment goes through `assertClienteAccess`, so any other center answers
  // "no tiene permiso" and the test would be about multi-tenancy, not about
  // documenting work.
  const assignment0 = await prisma.userClienteAssignment.findFirstOrThrow({
    where: { userId: fsr.id, active: true },
    select: { clienteId: true },
  });
  const cliente = { id: assignment0.clienteId };

  const incident = await prisma.incident.create({
    data: {
      title: INCIDENT_TITLE,
      description: "Incidente preparado por la suite de operativa.",
      typeId: type.id,
      statusId: incidentStatus.id,
      clienteId: cliente.id,
      assignees: { create: [{ userId: fsr.id }] },
    },
    select: { id: true },
  });
  incidentId = incident.id;

  const assignment = await prisma.assignment.create({
    data: {
      incidentId: incident.id,
      statusId: assignmentStatus.id,
      assignedAt: new Date(),
      assignees: { create: [{ userId: fsr.id }] },
    },
    select: { id: true },
  });
  assignmentId = assignment.id;
});

// ---------------------------------------------------------------------------
// El FSR documenta el trabajo
// ---------------------------------------------------------------------------
test.describe("El FSR documenta el trabajo", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: { latitude: 19.0414, longitude: -98.2063 },
    permissions: ["geolocation"],
  });

  test("ve su asignación con el incidente que la originó", async ({
    page,
  }, testInfo) => {
    await page.goto(`/fsr/assignments/${assignmentId}`);

    await expect(page.getByText(INCIDENT_TITLE).first()).toBeVisible();
    await evidence(page, testInfo, "asignacion recibida por el FSR");
  });

  test("registra una actividad y queda en el historial", async ({
    page,
  }, testInfo) => {
    const description = `Se reemplazó el sensor de la línea (${SUFFIX})`;

    await page.goto(`/fsr/assignments/${assignmentId}`);
    await page.getByRole("button", { name: "Agregar Actividad" }).click();
    await fillFieldById(page, "description", description);
    await evidence(page, testInfo, "actividad capturada antes de guardar");

    await page
      .getByRole("button", { name: /Guardar|Agregar/ })
      .last()
      .click();

    // Wait for the form to close before asserting anything. A bare
    // `getByText(description)` matched the TEXTAREA the text had just been
    // typed into, so the check passed while the save was still in flight and
    // the evidence photo showed "Guardando…" under a caption claiming the
    // activity was already in the history.
    await expect(page.getByLabel(/Descripción/)).toBeHidden({
      timeout: 15_000,
    });

    // The list is what the next shift reads, so the assertion is on the screen
    // and not only on the row in the database.
    const listed = page.getByText(description);
    await expect(listed).toBeVisible({ timeout: 15_000 });
    await evidence(
      page,
      testInfo,
      "actividad registrada en el historial",
      listed,
    );

    const stored = await db().assignmentActivity.findFirst({
      where: { assignmentId, description, active: true },
      select: { id: true },
    });
    expect(stored, "la actividad debe persistir").not.toBeNull();
  });

  test("pausa y retoma el trabajo", async ({ page }, testInfo) => {
    await page.goto(`/fsr/assignments/${assignmentId}`);

    // Work has to be running before it can be paused.
    await page.getByRole("button", { name: "Marcar como visto" }).click();
    await expect(
      page.getByRole("button", { name: "Iniciar trabajo" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Iniciar trabajo" }).click();

    const pause = page.getByRole("button", { name: /Pausar/ });
    await expect(pause).toBeVisible({ timeout: 15_000 });
    await pause.click();

    await expect(page.getByRole("button", { name: /Retomar/ })).toBeVisible({
      timeout: 15_000,
    });
    await evidence(page, testInfo, "trabajo pausado, pendiente de retomar");

    const paused = await db().assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { status: { select: { name: true } } },
    });
    expect(paused.status?.name).toBe("EN_PROGRESO");
  });
});

// ---------------------------------------------------------------------------
// El admin sigue el mismo incidente desde Seguimiento
// ---------------------------------------------------------------------------
test.describe("El admin lo sigue desde Seguimiento de Atención", () => {
  test.use({ storageState: authFile("admin") });

  test("encuentra el incidente por folio y ve su avance", async ({
    page,
  }, testInfo) => {
    await page.goto("/admin/tracking");
    await fillFieldById(page, "folio", `INC-${incidentId}`);
    await page.getByRole("button", { name: "Buscar" }).click();

    const row = page
      .getByRole("row")
      .filter({ hasText: `INC-${incidentId}` })
      .first();
    await expect(row).toBeVisible();
    await evidence(page, testInfo, "incidente localizado en seguimiento");

    await row.getByRole("button").first().click();
    await expect(
      page.getByRole("row").filter({ hasText: "Detalles del Incidente" }),
    ).toBeVisible();
    await evidence(page, testInfo, "detalle del incidente con su asignacion");
  });
});
