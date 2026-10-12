import { expect, type Page, test } from "@playwright/test";
import bcrypt from "bcrypt";
import moment from "moment-timezone";
import { APP_TZ } from "../src/lib/utils/datetime";
import { account, authFile, E2E_PASSWORD } from "./fixtures/auth";
import { db, disconnectDb, shortId, uniqueSuffix } from "./fixtures/db";
import { submitLogin } from "./fixtures/login";
import { gotoReady } from "./fixtures/navigation";

// Only prerequisites and teardown write directly to the DB. Every transition
// under test goes through the real forms and authenticated Server Actions.
test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

const userIds: string[] = [];
const vehicleIds: string[] = [];
const EXCEPTION_REASON = "Authorized E2E dispatch, including holiday coverage";
const ODOMETER_PHOTO = {
  name: "odometer.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  ),
};

async function createUser(roleNames: string[]) {
  const suffix = uniqueSuffix();
  const roles = await db().role.findMany({
    where: { name: { in: roleNames }, active: true },
  });
  expect(roles).toHaveLength(roleNames.length);
  const status = await db().userStatus.findFirstOrThrow({
    where: { name: "ACTIVO", active: true },
  });
  const user = await db().user.create({
    data: {
      name: `E2E Invariant ${suffix}`,
      email: `e2e-invariant-${suffix}@example.com`,
      password: await bcrypt.hash(E2E_PASSWORD(), 4),
      userStatusId: status.id,
      // January anniversary ensures the current calendar grant is activated.
      hireDate: moment.tz(APP_TZ).subtract(5, "years").startOf("year").toDate(),
      userRoles: { create: roles.map((role) => ({ roleId: role.id })) },
    },
  });
  userIds.push(user.id);
  return user;
}

async function createVehicle() {
  const status = await db().vehicleStatus.findUniqueOrThrow({
    where: { code: "AVAILABLE", active: true },
  });
  const vehicle = await db().vehicle.create({
    data: {
      make: "E2E",
      model: "Business invariants",
      year: 2024,
      licensePlate: `BI-${shortId()}`,
      statusId: status.id,
      operationalStatusCode: "AVAILABLE",
    },
  });
  vehicleIds.push(vehicle.id);
  return vehicle;
}

async function readTrip(id: string) {
  return db().vehicleTrip.findUniqueOrThrow({
    where: { id },
    include: { status: true },
  });
}

async function expectReleased(vehicleId: string) {
  const vehicle = await db().vehicle.findUniqueOrThrow({
    where: { id: vehicleId },
    include: { status: true },
  });
  expect(vehicle.status.code).toBe("AVAILABLE");
  expect(vehicle.operationalStatusCode).toBe("AVAILABLE");
  expect(vehicle.assignedFsrId).toBeNull();
  expect(
    await db().vehicleTrip.count({
      where: { vehicleId, active: true, status: { code: "EN_CURSO" } },
    }),
  ).toBe(0);
}

async function startTrip(
  page: Page,
  vehicle: { id: string; licensePlate: string },
  actorId: string,
  reading: number,
) {
  await gotoReady(page, "/fsr/vehicle-trips/start");
  await page.locator("#vehicle").click();
  await page
    .getByRole("option", { name: new RegExp(vehicle.licensePlate) })
    .click();
  await page.locator("#startOdometer").fill(String(reading));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(ODOMETER_PHOTO);
  await page
    .getByLabel("Motivo de excepción operacional")
    .fill(EXCEPTION_REASON);
  await page
    .getByRole("button", { name: "Iniciar Viaje", exact: true })
    .click();
  await page.waitForURL("**/fsr/vehicle-trips");
  await expect
    .poll(() =>
      db().vehicleTrip.count({
        where: {
          vehicleId: vehicle.id,
          fsrId: actorId,
          status: { code: "EN_CURSO" },
        },
      }),
    )
    .toBe(1);
  const trip = await db().vehicleTrip.findFirstOrThrow({
    where: {
      vehicleId: vehicle.id,
      fsrId: actorId,
      status: { code: "EN_CURSO" },
    },
    include: { status: true },
  });
  expect(trip.startOdometer).toBe(reading);
  expect(trip.startPhotoUrl).toBeTruthy();
  expect(trip.startCapturedAt).not.toBeNull();
  expect(trip.createdById).toBe(actorId);
  expect(trip.startExceptionReason).toBe(EXCEPTION_REASON);
  const claimed = await db().vehicle.findUniqueOrThrow({
    where: { id: vehicle.id },
    include: { status: true },
  });
  expect(claimed.status.code).toBe("IN_USE");
  expect(claimed.operationalStatusCode).toBe("AVAILABLE");
  return trip;
}

async function endTrip(page: Page, id: string, reading: number) {
  const started = await readTrip(id);
  await gotoReady(page, `/fsr/vehicle-trips/${id}/end`);
  await page.locator("#endOdometer").fill(String(reading));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(ODOMETER_PHOTO);
  await page
    .getByRole("button", { name: "Finalizar Viaje", exact: true })
    .click();
  await page.waitForURL("**/fsr/vehicle-trips");
  await expect
    .poll(async () => (await readTrip(id)).status.code)
    .toBe("COMPLETADO");
  const trip = await readTrip(id);
  expect(trip.endOdometer).toBe(reading);
  expect(trip.kmDriven).toBe(reading - trip.startOdometer);
  expect(trip.endPhotoUrl).toBeTruthy();
  expect(trip.endCapturedAt).not.toBeNull();
  expect(trip.endCapturedAt?.getTime()).toBeGreaterThanOrEqual(
    trip.startCapturedAt?.getTime() ?? trip.startedAt.getTime(),
  );
  for (const key of [
    "fsrId",
    "startOdometer",
    "startPhotoUrl",
    "startPhotoProvider",
    "startCapturedAt",
    "startedAt",
    "startExceptionReason",
  ] as const) {
    expect(trip[key], `preserved completed trip ${key}`).toEqual(started[key]);
  }
  await expectReleased(trip.vehicleId);
  return trip;
}

test.describe("Vacation ownership and historical evidence", () => {
  test.use({ storageState: authFile("admin-vacaciones") });

  test("selected employee request is approved then shortened without rewriting its history", async ({
    page,
  }) => {
    const employee = await createUser(["EMPLEADO"]);
    const admin = await db().user.findUniqueOrThrow({
      where: { email: account("admin-vacaciones").email },
    });
    const today = moment.tz(APP_TZ).startOf("day");
    const todayKey = today.format("YYYY-MM-DD");
    const endKey = today.clone().add(7, "days").format("YYYY-MM-DD");
    const reason = `Original employee request ${uniqueSuffix()}`;

    await gotoReady(page, "/admin/vacations/new");
    await page.locator("#userId").selectOption(employee.id);
    await expect(page.locator("#userId")).toHaveValue(employee.id);
    await page.locator("#startDate").fill(todayKey);
    await page.locator("#endDate").fill(endKey);
    await page.locator("#reason").fill(reason);
    await page.getByRole("button", { name: "Enviar Solicitud" }).click();
    await page.waitForURL("**/admin/vacations");
    await expect
      .poll(() => db().vacation.count({ where: { userId: employee.id } }))
      .toBe(1);
    const pending = await db().vacation.findFirstOrThrow({
      where: { userId: employee.id },
      include: { status: true, period: true },
    });
    expect(pending.status.code).toBe("PENDIENTE");
    expect(pending.createdById).toBe(admin.id);
    expect(pending.userId).not.toBe(admin.id);
    expect(pending.period?.userId).toBe(employee.id);
    expect(pending.period?.cycleYear).not.toBeNull();
    expect(pending.period?.availableFrom?.getTime()).toBeLessThanOrEqual(
      today.valueOf(),
    );
    expect(pending.chargedDates.length).toBeGreaterThan(0);
    expect(pending.businessDaysUsed).toBe(pending.chargedDates.length);
    expect(moment(pending.startDate).tz(APP_TZ).format("YYYY-MM-DD")).toBe(
      todayKey,
    );
    expect(moment(pending.endDate).tz(APP_TZ).format("YYYY-MM-DD")).toBe(
      endKey,
    );
    expect(
      pending.chargedDates.every((date) => date >= todayKey && date <= endKey),
    ).toBe(true);

    const row = page.getByRole("row").filter({ hasText: employee.name });
    await row.getByRole("button", { name: "Aprobar", exact: true }).click();
    await expect(
      page.getByText("Solicitud de vacaciones aprobada", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(
        async () =>
          (
            await db().vacation.findUniqueOrThrow({
              where: { id: pending.id },
              include: { status: true },
            })
          ).status.code,
      )
      .toBe("APROBADA");
    const approved = await db().vacation.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(approved.approvedById).toBe(admin.id);
    expect(approved.approvedAt).not.toBeNull();
    expect(approved.businessDaysUsed).toBe(pending.businessDaysUsed);
    expect(approved.chargedDates).toEqual(pending.chargedDates);

    await row
      .getByRole("button", { name: "Corregir período iniciado" })
      .click();
    await row.getByLabel("Último día de ausencia").fill(todayKey);
    const correctionReason = "Employee returned early; retain today's absence";
    await row.getByLabel("Motivo de la corrección").fill(correctionReason);
    await row.getByRole("button", { name: "Guardar corrección" }).click();
    await expect(
      page.getByText("Corrección registrada", { exact: true }),
    ).toBeVisible();
    const corrected = await db().vacation.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(moment(corrected.endDate).tz(APP_TZ).format("YYYY-MM-DD")).toBe(
      todayKey,
    );
    expect(corrected.businessDaysUsed).toBe(
      approved.chargedDates.includes(todayKey) ? 1 : 0,
    );
    expect(corrected.businessDaysUsed).toBeLessThan(
      approved.businessDaysUsed as number,
    );
    for (const key of [
      "userId",
      "periodId",
      "startDate",
      "reason",
      "statusId",
      "approvedAt",
      "approvedById",
      "chargedDates",
      "correctionHistory",
    ] as const) {
      expect(corrected[key], `preserved vacation ${key}`).toEqual(
        approved[key],
      );
    }
    const receipts = await db().businessCorrection.findMany({
      where: { entityType: "Vacation", entityId: pending.id },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      actorId: admin.id,
      reason: correctionReason,
    });
    expect(receipts[0].before).toMatchObject({
      endDate: approved.endDate.toISOString(),
      businessDaysUsed: approved.businessDaysUsed,
      chargedDates: approved.chargedDates,
    });
    expect(receipts[0].after).toMatchObject({
      endDate: corrected.endDate.toISOString(),
      businessDaysUsed: corrected.businessDaysUsed,
      chargedDates: approved.chargedDates,
      reason,
    });
  });
});

test.describe("Isolated driver workflows", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    // A private actor avoids occupancy races with every shared FSR/admin spec.
    const driver = await createUser(["FSR", "ADMIN_OPERACION"]);
    await gotoReady(page, "/login");
    await submitLogin(page, driver.email, E2E_PASSWORD());
    await page.waitForURL("**/inicio");
  });

  test("cancelling an open trip releases occupancy and preserves photo, reading and reason", async ({
    page,
  }) => {
    const driverId = userIds[userIds.length - 1];
    const vehicle = await createVehicle();
    const started = await startTrip(page, vehicle, driverId, 1000);
    await gotoReady(page, `/fsr/vehicle-trips/${started.id}`);
    const reason = "Dispatch cancelled before departure";
    await page.getByLabel("Motivo de cancelación").fill(reason);
    await page
      .getByRole("button", { name: "Cancelar viaje con motivo" })
      .click();
    await expect(
      page.getByText("Viaje cancelado. Sus evidencias se conservaron.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(async () => (await readTrip(started.id)).status.code)
      .toBe("CANCELADO");
    const cancelled = await readTrip(started.id);
    expect(cancelled).toMatchObject({
      active: true,
      fsrId: driverId,
      cancellationReason: reason,
      updatedById: driverId,
      endOdometer: null,
      endPhotoUrl: null,
    });
    expect(cancelled.cancelledAt).not.toBeNull();
    for (const key of [
      "startOdometer",
      "startPhotoUrl",
      "startPhotoProvider",
      "startCapturedAt",
      "startedAt",
      "startExceptionReason",
    ] as const) {
      expect(cancelled[key], `preserved trip ${key}`).toEqual(started[key]);
    }
    await expectReleased(vehicle.id);
    await page.reload();
    await expect(page.getByText(reason, { exact: true })).toBeVisible();
    // A second real dispatch proves the driver and vehicle can be claimed again.
    const replacement = await startTrip(page, vehicle, driverId, 1000);
    expect(replacement.id).not.toBe(started.id);
    await endTrip(page, replacement.id, 1025);
    expect((await readTrip(started.id)).cancellationReason).toBe(reason);
  });

  test("completed trip survives an audited odometer epoch and a lower-reading new trip", async ({
    page,
    browser,
  }) => {
    const driverId = userIds[userIds.length - 1];
    const vehicle = await createVehicle();
    const started = await startTrip(page, vehicle, driverId, 2000);
    const historical = await endTrip(page, started.id, 2050);
    const admin = await db().user.findUniqueOrThrow({
      where: { email: account("admin-operacion").email },
    });
    const adminContext = await browser.newContext({
      storageState: authFile("admin-operacion"),
    });
    try {
      const adminPage = await adminContext.newPage();
      await gotoReady(adminPage, `/admin/vehicles/${vehicle.id}`);
      const reason = "Replaced odometer after completed dispatch";
      await adminPage.getByLabel("Nueva lectura (km)").fill("100");
      await adminPage
        .getByLabel("Motivo de corrección", { exact: true })
        .fill(reason);
      await adminPage
        .getByRole("button", { name: "Registrar corrección" })
        .click();
      await expect(
        adminPage.getByText(
          "Corrección del odómetro registrada con historial.",
          {
            exact: true,
          },
        ),
      ).toBeVisible();
      const corrected = await db().vehicle.findUniqueOrThrow({
        where: { id: vehicle.id },
      });
      expect(corrected.odometerBaseline).toBe(100);
      expect(corrected.odometerBaselineAt).not.toBeNull();
      const receipts = await db().businessCorrection.findMany({
        where: { entityType: "Vehicle", entityId: vehicle.id },
      });
      expect(receipts).toHaveLength(1);
      expect(receipts[0]).toMatchObject({
        actorId: admin.id,
        reason,
        before: { odometerBaseline: null, odometerBaselineAt: null },
        after: {
          odometerBaseline: 100,
          odometerBaselineAt: corrected.odometerBaselineAt?.toISOString(),
        },
      });
    } finally {
      await adminContext.close();
    }
    expect(await readTrip(historical.id)).toEqual(historical);
    const next = await startTrip(page, vehicle, driverId, 100);
    await endTrip(page, next.id, 125);
    expect(await readTrip(historical.id)).toEqual(historical);
    expect(
      await db().businessCorrection.count({
        where: { entityType: "Vehicle", entityId: vehicle.id },
      }),
    ).toBe(1);
  });
});

test.afterEach(async () => {
  // Exact IDs only; retain audit/receipt evidence and avoid broad prefix cleanup.
  if (vehicleIds.length) {
    await db().vehicleTrip.updateMany({
      where: { vehicleId: { in: vehicleIds } },
      data: { active: false },
    });
    await db().vehicle.updateMany({
      where: { id: { in: vehicleIds } },
      data: { active: false, assignedFsrId: null },
    });
  }
  if (userIds.length) {
    await db().vacation.updateMany({
      where: { userId: { in: userIds } },
      data: { active: false },
    });
    await db().user.updateMany({
      where: { id: { in: userIds } },
      data: { active: false },
    });
  }
  userIds.length = 0;
  vehicleIds.length = 0;
});

test.afterAll(disconnectDb);
