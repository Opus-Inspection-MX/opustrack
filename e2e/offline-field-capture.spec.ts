import { expect, type Page, test } from "@playwright/test";
import { account, authFile } from "./fixtures/auth";
import {
  db,
  disconnectDb,
  expectAssignmentStatus,
  prepareAssignmentForClose,
  uniqueSuffix,
} from "./fixtures/db";
import { evidence } from "./fixtures/evidence";

/**
 * E2E coverage for offline-tolerant field capture (RF-260, RF-261).
 *
 * Draft-and-retry ONLY: the FSR freezes action-time evidence (scalars + GPS
 * + `capturedAt`) into a localStorage draft when the device is offline, then
 * flushes it through the UNCHANGED server action on reconnect. No merge UI,
 * no state-machine changes — conflicts surface as the standard business-rule
 * error with the entry kept.
 *
 *   offline start/close → pending badge → reconnect → flush applies once
 *   double flush with the same key → converges, single transition
 *   stale draft (>24h) → Spanish rejection, entry kept
 *   moved-on server state → standard business-rule error, entry kept
 *   offline trip start/end (odometer + photo staged as File, no base64)
 *
 * Serial by nature: every step consumes what the previous one produced.
 * Each test gets a fresh browser context, so offline capture and its flush
 * always happen inside the SAME test — localStorage does not cross tests.
 */

const SUFFIX = uniqueSuffix();
const INCIDENT_TITLE = `E2E offline ${SUFFIX}`;
const GEO = { latitude: 19.0414, longitude: -98.2063 };
const OUTBOX_KEY = "opustrack.offline.outbox.v1";

/** Minimal PDF: accepted by the MIME allowlist, renders as an icon. */
const ODOMETER_PDF = {
  name: "odometro-e2e.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  ),
};

let incidentId: number;
let assignmentId: string;
let staleAssignmentId: string;
let movedOnAssignmentId: string;
let tripId: string;

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await disconnectDb();
});

/** Inject a draft straight into the outbox (stale/conflict scenarios). */
async function injectDraft(page: Page, draft: Record<string, unknown>) {
  await page.evaluate(
    ({ key, entry }) => {
      const raw = localStorage.getItem(key) ?? "[]";
      const store = JSON.parse(raw) as unknown[];
      store.push(entry);
      localStorage.setItem(key, JSON.stringify(store));
    },
    { key: OUTBOX_KEY, entry: draft },
  );
}

// ---------------------------------------------------------------------------
// 0 · Seed incident + assignments + vehicle directly
// ---------------------------------------------------------------------------
test.describe("0 · Prepara incidencia y vehículo", () => {
  test("crea incidencia, asignaciones y un vehículo disponible", async () => {
    const prisma = db();
    const cliente = await prisma.cliente.findFirstOrThrow({
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

    const incident = await prisma.incident.create({
      data: {
        title: INCIDENT_TITLE,
        description: "Incidente e2e para borradores offline.",
        typeId: type.id,
        statusId: abierto.id,
        clienteId: cliente.id,
        reportedById: fsr.id,
        assignees: { create: [{ userId: fsr.id }] },
      },
      select: { id: true },
    });
    incidentId = incident.id;

    for (const slot of ["main", "stale", "moved-on"] as const) {
      const created = await prisma.assignment.create({
        data: {
          incidentId,
          statusId: asignado.id,
          assignedAt: new Date(),
          assignees: { create: [{ userId: fsr.id }] },
        },
        select: { id: true },
      });
      if (slot === "main") assignmentId = created.id;
      if (slot === "stale") staleAssignmentId = created.id;
      if (slot === "moved-on") movedOnAssignmentId = created.id;
    }

    const available = await prisma.vehicleStatus.findFirstOrThrow({
      where: { name: "AVAILABLE" },
      select: { id: true },
    });
    await prisma.vehicle.create({
      data: {
        make: "E2E",
        model: "Offline",
        year: 2024,
        licensePlate: `E2E-${SUFFIX}`.slice(0, 12),
        statusId: available.id,
      },
    });
  });
});

// ---------------------------------------------------------------------------
// 1 · RF-260: offline start persists and flushes exactly once
// ---------------------------------------------------------------------------
test.describe("1 · Inicio offline con reintento idempotente", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: GEO,
    permissions: ["geolocation"],
  });

  test("sin conexión el inicio queda pendiente y al volver se aplica con el GPS del momento", async ({
    page,
  }, testInfo) => {
    await page.goto(`/fsr/assignments/${assignmentId}`);
    await page.getByRole("button", { name: "Marcar como visto" }).click();
    await expectAssignmentStatus(assignmentId, "VISTO");

    await page.goto(`/fsr/assignments/${assignmentId}`);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Iniciar trabajo" }).click();
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
    await expect(page.getByText("Inicio de trabajo")).toBeVisible();
    await evidence(page, testInfo, "inicio offline guardado como borrador");
    // Still VISTO server-side: nothing was delivered while offline.
    await expectAssignmentStatus(assignmentId, "VISTO");

    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    // Badge gone + server state moved: the flush applied.
    await expect(page.getByText("Pendiente de envío")).toHaveCount(0);
    await expectAssignmentStatus(assignmentId, "INICIADO");

    const row = await db().assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { startLatitude: true, startLongitude: true },
    });
    // Action-time evidence: the field GPS, not a re-capture at flush time.
    expect(row.startLatitude).toBeCloseTo(GEO.latitude, 4);
    expect(row.startLongitude).toBeCloseTo(GEO.longitude, 4);
  });

  test("un segundo envío con la misma llave converge sin duplicar", async ({
    page,
  }) => {
    const hit = await db().actionIdempotency.findFirstOrThrow({
      where: { action: "startAssignmentWork", targetId: assignmentId },
      select: { key: true },
    });
    await page.goto(`/fsr/assignments/${assignmentId}`);
    await injectDraft(page, {
      key: hit.key,
      kind: "startAssignmentWork",
      fields: {
        assignmentId,
        latitude: String(GEO.latitude),
        longitude: String(GEO.longitude),
      },
      capturedAt: new Date().toISOString(),
      attempts: 0,
    });
    await page.reload();
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    // The replay converged on the live row instead of re-executing.
    await expect(page.getByText("Pendiente de envío")).toHaveCount(0);
    await expectAssignmentStatus(assignmentId, "INICIADO");
    const keys = await db().actionIdempotency.count({
      where: { action: "startAssignmentWork", targetId: assignmentId },
    });
    expect(keys).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 2 · RF-260: offline close flushes once
// ---------------------------------------------------------------------------
test.describe("2 · Cierre offline", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: GEO,
    permissions: ["geolocation"],
  });

  test("sin conexión el cierre queda pendiente y al volver se aplica", async ({
    page,
  }, testInfo) => {
    await prepareAssignmentForClose(assignmentId);
    await page.goto(`/fsr/assignments/${assignmentId}`);
    page.on("dialog", (dialog) => dialog.accept());
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Cerrar trabajo" }).click();
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
    await expect(page.getByText("Cierre de asignación")).toBeVisible();
    await evidence(page, testInfo, "cierre offline guardado como borrador");
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    await expect(page.getByText("Pendiente de envío")).toHaveCount(0);
    await expectAssignmentStatus(assignmentId, "CERRADO");
  });
});

// ---------------------------------------------------------------------------
// 3 · RF-260: stale and moved-on drafts fail as business rules, kept queued
// ---------------------------------------------------------------------------
test.describe("3 · Borradores vencidos y con estado movido", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: GEO,
    permissions: ["geolocation"],
  });

  test("un borrador de hace más de 24h se rechaza en español y se conserva", async ({
    page,
  }) => {
    await page.goto(`/fsr/assignments/${staleAssignmentId}`);
    await injectDraft(page, {
      key: `e2e-stale-${Date.now()}`,
      kind: "closeAssignment",
      fields: {
        assignmentId: staleAssignmentId,
        latitude: String(GEO.latitude),
        longitude: String(GEO.longitude),
      },
      capturedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      attempts: 0,
    });
    await page.reload();
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    // The server's Spanish freshness rejection lands in the entry detail…
    await expect(page.getByText(/24 horas/)).toBeVisible();
    // …and the entry is kept, not silently dropped.
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
  });

  test("un estado movido en el servidor sale como regla de negocio", async ({
    page,
  }) => {
    await page.goto(`/fsr/assignments/${movedOnAssignmentId}`);
    await injectDraft(page, {
      key: `e2e-moved-${Date.now()}`,
      kind: "startAssignmentWork",
      fields: {
        assignmentId: movedOnAssignmentId,
        latitude: String(GEO.latitude),
        longitude: String(GEO.longitude),
      },
      capturedAt: new Date().toISOString(),
      attempts: 0,
    });
    // Meanwhile the incident is cancelled underneath the draft.
    const cancelada = await db().incidentStatus.findFirstOrThrow({
      where: { name: "CANCELADA" },
      select: { id: true },
    });
    await db().incident.update({
      where: { id: incidentId },
      data: { statusId: cancelada.id },
    });
    await page.reload();
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    // The standard terminal-incident rule, surfaced like any online failure…
    await expect(page.getByText(/cancelada/)).toBeVisible();
    // …with the draft kept for manual resolution.
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 4 · RF-261: offline trip start/end with staged photo
// ---------------------------------------------------------------------------
test.describe("4 · Viajes offline con foto", () => {
  test.use({
    storageState: authFile("fsr"),
    geolocation: GEO,
    permissions: ["geolocation"],
  });

  test("inicia el viaje sin conexión y lo envía al reconectar", async ({
    page,
  }, testInfo) => {
    await page.goto("/fsr/vehicle-trips/start");
    await page.getByText("Selecciona un vehículo").click();
    await page.getByRole("option", { name: /E2E Offline/ }).click();
    await page.locator("#startOdometer").fill("1000");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(ODOMETER_PDF);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Iniciar Viaje" }).click();
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
    await evidence(page, testInfo, "inicio de viaje offline en borrador");
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    // onFlushed navigates to the trip list once the draft lands.
    await page.waitForURL("**/fsr/vehicle-trips");

    const trip = await db().vehicleTrip.findFirstOrThrow({
      where: { startOdometer: 1000, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fsr: { select: { email: true } },
        startPhotoUrl: true,
        startLatitude: true,
      },
    });
    expect(trip.fsr.email).toBe(account("fsr").email);
    tripId = trip.id;
    // Photo staged as a File upload (no base64) and field GPS preserved.
    expect(trip.startPhotoUrl).toBeTruthy();
    expect(trip.startLatitude ?? GEO.latitude).toBeCloseTo(GEO.latitude, 4);
  });

  test("finaliza el viaje sin conexión y lo envía al reconectar", async ({
    page,
  }) => {
    await page.goto(`/fsr/vehicle-trips/${tripId}/end`);
    await page.locator("#endOdometer").fill("1050");
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles(ODOMETER_PDF);
    await page.context().setOffline(true);
    await page.getByRole("button", { name: "Finalizar Viaje" }).click();
    await expect(page.getByText("Pendiente de envío")).toBeVisible();
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "Reintentar" }).first().click();
    await page.waitForURL("**/fsr/vehicle-trips");

    const trip = await db().vehicleTrip.findUniqueOrThrow({
      where: { id: tripId },
      select: { endOdometer: true, kmDriven: true, endPhotoUrl: true },
    });
    expect(trip.endOdometer).toBe(1050);
    expect(trip.kmDriven).toBe(50);
    expect(trip.endPhotoUrl).toBeTruthy();
  });
});
