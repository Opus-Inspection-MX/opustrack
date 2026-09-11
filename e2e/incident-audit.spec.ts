import { expect, test } from "@playwright/test";
import { account, authFile } from "./fixtures/auth";
import {
  db,
  disconnectDb,
  expectAssignmentStatus,
  expectIncidentStatus,
  prepareAssignmentForClose,
  uniqueSuffix,
} from "./fixtures/db";
import { evidence } from "./fixtures/evidence";

/**
 * E2E coverage for the incident audit trail (RF-219):
 *
 *   FSR closes the work through the real UI
 *     → a STATUS_CHANGED event lands in IncidentEvent
 *       → the admin "Historial" timeline renders it
 *   Admin cancels another incident through the real UI
 *     → a CANCELLED event with the reason is recorded and rendered
 *
 * Reopen (REOPENED), assignee sync, bulk import and the ADMIN_OVERRIDE
 * mechanism are pinned by unit tests; the browser has no reopen/override
 * affordance yet (the §1.3 permission ships separately), so those paths stay
 * out of this spec on purpose.
 *
 * Serial by nature: every step consumes what the previous one produced.
 */

const SUFFIX = uniqueSuffix();
const CLOSE_TITLE = `E2E bitácora cierre ${SUFFIX}`;
const CANCEL_TITLE = `E2E bitácora cancela ${SUFFIX}`;
const CANCEL_REASON = `Duplicado e2e ${SUFFIX}`;

let closeIncidentId: number;
let cancelIncidentId: number;
let assignmentId: string;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await disconnectDb();
});

// ---------------------------------------------------------------------------
// 0 · Seed two incidents directly (catalogs + users come from the e2e seed)
// ---------------------------------------------------------------------------
test.describe("0 · Prepara incidencias", () => {
  test("crea una incidencia para cerrar y otra para cancelar", async () => {
    const prisma = db();

    const client = await prisma.client.findFirstOrThrow({
      where: { active: true, NOT: { code: "SIN-CENTRO" } },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    const fsr = await prisma.user.findUniqueOrThrow({
      where: { email: account("fsr").email },
      select: { id: true },
    });
    const type = await prisma.incidentType.findFirstOrThrow({
      where: { active: true },
      select: { id: true },
    });
    const abierto = await prisma.incidentStatus.findFirstOrThrow({
      where: { active: true, name: "ABIERTO" },
      select: { id: true },
    });
    const asignado = await prisma.assignmentStatus.findFirstOrThrow({
      where: { active: true, name: "ASIGNADO" },
      select: { id: true },
    });

    // Report scope fails closed: the FSR fixture account is assigned to a
    // single seeded Client, so link him to the picked one (the same step
    // createTrackingFixture takes). Without it the FSR page denies with
    // "Sin acceso a los datos de este Cliente" and the action buttons never
    // render.
    await prisma.userClientAssignment.upsert({
      where: { userId_clientId: { userId: fsr.id, clientId: client.id } },
      update: { active: true },
      create: { userId: fsr.id, clientId: client.id },
    });

    const toClose = await prisma.incident.create({
      data: {
        title: CLOSE_TITLE,
        description: "Incidente e2e para la bitácora de cierre.",
        typeId: type.id,
        statusId: abierto.id,
        clientId: client.id,
        reportedById: fsr.id,
        assignees: { create: [{ userId: fsr.id }] },
      },
      select: { id: true },
    });
    closeIncidentId = toClose.id;

    const assignment = await prisma.assignment.create({
      data: {
        incidentId: closeIncidentId,
        statusId: asignado.id,
        assignedAt: new Date(),
        assignees: { create: [{ userId: fsr.id }] },
      },
      select: { id: true },
    });
    assignmentId = assignment.id;

    const toCancel = await prisma.incident.create({
      data: {
        title: CANCEL_TITLE,
        description: "Incidente e2e para la bitácora de cancelación.",
        typeId: type.id,
        statusId: abierto.id,
        clientId: client.id,
        reportedById: fsr.id,
      },
      select: { id: true },
    });
    cancelIncidentId = toCancel.id;

    // Seeded rows bypass the actions, so no CREATED events exist for them:
    // the trail starts with what the UI does below.
    const seeded = await prisma.incidentEvent.count({
      where: { incidentId: { in: [closeIncidentId, cancelIncidentId] } },
    });
    expect(seeded).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 1 · El FSR ejecuta y cierra a través de la UI real
// ---------------------------------------------------------------------------
test.describe("1 · El FSR cierra el trabajo", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: { latitude: 19.0414, longitude: -98.2063 },
    permissions: ["geolocation"],
  });

  test("da Visto e inicia el trabajo", async ({ page }) => {
    // Two serial 15s DB polls plus GPS and navigations exhaust the default
    // 30s budget on slower runners.
    test.setTimeout(60_000);
    // Register before any navigation: dialogs are dismissed by default, which
    // would cancel the transition if the handler attached late.
    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`/fsr/assignments/${assignmentId}`);
    await page.getByRole("button", { name: "Marcar como visto" }).click();
    await expectAssignmentStatus(assignmentId, "VISTO");

    await page.goto(`/fsr/assignments/${assignmentId}`);
    await page.getByRole("button", { name: "Iniciar trabajo" }).click();
    await expectAssignmentStatus(assignmentId, "INICIADO");
  });

  test("cierra el trabajo y el cierre queda en la bitácora", async ({
    page,
  }, testInfo) => {
    await prepareAssignmentForClose(assignmentId);

    page.on("dialog", (dialog) => dialog.accept());
    await page.goto(`/fsr/assignments/${assignmentId}`);

    const closeButton = page.getByRole("button", { name: "Cerrar trabajo" });
    await expect(closeButton).toBeEnabled();
    await closeButton.click();

    await evidence(page, testInfo, "trabajo cerrado desde la UI del FSR");

    await expectAssignmentStatus(assignmentId, "CERRADO");
    const incident = await expectIncidentStatus(closeIncidentId, "CERRADO");
    expect(incident.resolvedAt, "resolvedAt del incidente").not.toBeNull();

    const events = await db().incidentEvent.findMany({
      where: { incidentId: closeIncidentId },
      orderBy: { createdAt: "asc" },
    });
    const closing = events.find(
      (e) => e.eventType === "STATUS_CHANGED" && e.toStatus === "CERRADO",
    );
    expect(closing, "el cierre emite STATUS_CHANGED → CERRADO").toBeDefined();
    expect(
      (closing?.payload as { resolvedAt?: string } | null)?.resolvedAt,
      "el evento conserva el resolvedAt",
    ).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// 2 · El admin lee la bitácora y cancela la otra incidencia
// ---------------------------------------------------------------------------
test.describe("2 · El admin lee la bitácora y cancela", () => {
  test.use({ storageState: authFile("admin") });

  test("el Historial muestra el cierre", async ({ page }, testInfo) => {
    await page.goto(`/admin/incidents/${closeIncidentId}`);

    // CardTitle renders a div, not a heading, so a role query can never
    // match: assert on the text the timeline actually renders.
    await expect(page.getByText("Historial").first()).toBeVisible();
    await expect(page.getByText("Cambio de estado").first()).toBeVisible();
    await expect(page.getByText(/CERRADO/).first()).toBeVisible();

    await evidence(page, testInfo, "historial con el evento de cierre");
  });

  test("cancela con motivo y queda en la bitácora", async ({
    page,
  }, testInfo) => {
    await page.goto(`/admin/incidents/${cancelIncidentId}`);

    await page.getByRole("button", { name: "Cancelar incidencia" }).click();
    await page.getByLabel(/Razón/).fill(CANCEL_REASON);
    await page.getByRole("button", { name: "Confirmar cancelación" }).click();

    await expectIncidentStatus(cancelIncidentId, "CANCELADA");
    const cancelledRow = await db().incident.findUniqueOrThrow({
      where: { id: cancelIncidentId },
      select: { cancellationReason: true },
    });

    const cancelled = await db().incidentEvent.findFirst({
      where: { incidentId: cancelIncidentId, eventType: "CANCELLED" },
    });
    expect(cancelled, "la cancelación emite CANCELLED").not.toBeNull();
    expect(cancelled?.actorId).not.toBeNull();
    expect(
      (cancelled?.payload as { reason?: string } | null)?.reason,
      "el motivo queda registrado",
    ).toBe(CANCEL_REASON);
    expect(cancelledRow.cancellationReason).toBe(CANCEL_REASON);

    await page.goto(`/admin/incidents/${cancelIncidentId}`);
    await expect(page.getByText("Historial").first()).toBeVisible();
    await expect(page.getByText("Incidencia cancelada").first()).toBeVisible();
    await expect(page.getByText(CANCEL_REASON).first()).toBeVisible();

    await evidence(page, testInfo, "historial con el evento de cancelación");
  });
});
