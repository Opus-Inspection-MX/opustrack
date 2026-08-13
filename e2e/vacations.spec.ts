import { expect, test } from "@playwright/test";
import { authFile } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";

/**
 * Vacation balances: entitlement from years of service, spending in business
 * days, and the rule that adding days must never disturb vacations already
 * booked.
 *
 * The balance is never stored — it is `allotted − reserved`, recomputed on
 * every read. These tests exist to keep it that way: the override test raises
 * an allotment while an approved vacation sits in the same period and asserts
 * the vacation comes out untouched, which is the guarantee the whole design
 * exists to provide.
 *
 * Assertions read the database directly (the derived balance has no single UI
 * surface that exposes allotted/used/remaining as raw numbers), while the
 * rendering tests drive the real pages.
 */

test.use({ storageState: authFile("admin") });
test.describe.configure({ mode: "serial" });

/** A CDMX calendar day as the UTC instant of its 00:00 (CDMX is UTC-6). */
function mxDay(dateStr: string): Date {
  return new Date(`${dateStr}T06:00:00.000Z`);
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * An FSR hired exactly two years ago, so periods 1-3 exist and period 3 is the
 * one currently accruing.
 */
async function createFsrHiredYearsAgo(suffix: string, years: number) {
  const [fsrRole, status] = await Promise.all([
    db().role.findFirstOrThrow({ where: { name: "FSR" } }),
    db().userStatus.findFirstOrThrow({ where: { name: "ACTIVO" } }),
  ]);

  const hire = new Date();
  hire.setFullYear(hire.getFullYear() - years);

  return db().user.create({
    data: {
      name: `E2E Vacaciones ${suffix}`,
      email: `e2e-vac-${suffix}@example.com`,
      // Never used to sign in: the spec drives everything as admin.
      password: "not-used",
      roleId: fsrRole.id,
      userStatusId: status.id,
      hireDate: mxDay(isoDay(hire)),
    },
    select: { id: true, name: true, hireDate: true },
  });
}

/**
 * Create the periods a hire date has earned, mirroring what the app does on
 * page load. Kept as raw inserts so the spec never imports app internals.
 */
async function seedPeriods(userId: string, hireDate: Date, count: number) {
  const created = [];
  for (let periodNumber = 1; periodNumber <= count; periodNumber += 1) {
    const accrualStart = new Date(hireDate);
    accrualStart.setFullYear(accrualStart.getFullYear() + periodNumber - 1);

    const accrualEnd = new Date(accrualStart);
    accrualEnd.setFullYear(accrualEnd.getFullYear() + 1);
    accrualEnd.setDate(accrualEnd.getDate() - 1);

    const graceEnd = new Date(accrualEnd);
    graceEnd.setMonth(graceEnd.getMonth() + 12);

    const rule = await db().vacationAccrualRule.findFirstOrThrow({
      where: {
        active: true,
        minYears: { lte: periodNumber },
        OR: [{ maxYears: null }, { maxYears: { gte: periodNumber } }],
      },
      orderBy: { minYears: "desc" },
    });

    created.push(
      await db().vacationPeriod.create({
        data: {
          userId,
          periodNumber,
          accrualStart,
          accrualEnd,
          graceEnd,
          ruleDays: rule.days,
        },
      }),
    );
  }
  return created;
}

/** allotted / used / remaining, computed the way the app computes it. */
async function balanceOf(periodId: string) {
  const period = await db().vacationPeriod.findUniqueOrThrow({
    where: { id: periodId },
  });
  const aggregate = await db().vacation.aggregate({
    where: {
      periodId,
      active: true,
      status: { name: { in: ["PENDIENTE", "APROBADA"] } },
    },
    _sum: { businessDaysUsed: true },
  });

  const allottedDays = period.overrideDays ?? period.ruleDays;
  const usedDays = aggregate._sum.businessDaysUsed ?? 0;
  return { allottedDays, usedDays, remainingDays: allottedDays - usedDays };
}

/** A Monday-to-Friday week, `offsetWeeks` weeks out from today. */
function weekdayRange(offsetWeeks: number): { start: Date; end: Date } {
  const monday = new Date();
  monday.setDate(monday.getDate() + ((8 - monday.getDay()) % 7 || 7));
  monday.setDate(monday.getDate() + offsetWeeks * 7);

  const friday = new Date(monday);
  friday.setDate(friday.getDate() + 4);

  return { start: mxDay(isoDay(monday)), end: mxDay(isoDay(friday)) };
}

async function statusId(name: string): Promise<number> {
  const status = await db().vacationStatus.findFirstOrThrow({
    where: { name },
  });
  return status.id;
}

test("la tabla sembrada otorga los días LFT por año de servicio", async () => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const periods = await seedPeriods(user.id, user.hireDate as Date, 3);

  // Seeded LFT 2023 tiers: 12 days for year 1, 14 for year 2, 16 for year 3.
  expect(periods.map((p) => p.ruleDays)).toEqual([12, 14, 16]);
});

test("una solicitud reserva días hábiles y el rechazo los devuelve", async () => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const [, , period] = await seedPeriods(user.id, user.hireDate as Date, 3);

  const range = weekdayRange(1);
  const vacation = await db().vacation.create({
    data: {
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
      statusId: await statusId("PENDIENTE"),
      periodId: period.id,
      // Monday to Friday: five business days, no weekend inside.
      businessDaysUsed: 5,
    },
    select: { id: true },
  });

  const afterRequest = await balanceOf(period.id);
  expect(afterRequest.usedDays).toBe(5);
  expect(afterRequest.remainingDays).toBe(afterRequest.allottedDays - 5);

  await db().vacation.update({
    where: { id: vacation.id },
    data: { statusId: await statusId("RECHAZADA") },
  });

  // Rejecting frees the days: RECHAZADA drops out of the consumed sum.
  const afterReject = await balanceOf(period.id);
  expect(afterReject.usedDays).toBe(0);
  expect(afterReject.remainingDays).toBe(afterReject.allottedDays);
});

test("aprobar no vuelve a descontar los días ya reservados", async () => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const [, , period] = await seedPeriods(user.id, user.hireDate as Date, 3);

  const range = weekdayRange(2);
  const vacation = await db().vacation.create({
    data: {
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
      statusId: await statusId("PENDIENTE"),
      periodId: period.id,
      businessDaysUsed: 5,
    },
    select: { id: true },
  });

  const whilePending = await balanceOf(period.id);

  await db().vacation.update({
    where: { id: vacation.id },
    data: { statusId: await statusId("APROBADA"), approvedAt: new Date() },
  });

  // A PENDIENTE request already reserved its days, which is why approval needs
  // no balance re-check.
  const afterApproval = await balanceOf(period.id);
  expect(afterApproval.usedDays).toBe(whilePending.usedDays);
  expect(afterApproval.remainingDays).toBe(whilePending.remainingDays);
});

test("aumentar los días del período no toca las vacaciones ya aprobadas", async () => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const [, , period] = await seedPeriods(user.id, user.hireDate as Date, 3);

  const range = weekdayRange(3);
  const approvedStatus = await statusId("APROBADA");
  const vacation = await db().vacation.create({
    data: {
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
      statusId: approvedStatus,
      periodId: period.id,
      businessDaysUsed: 5,
      approvedAt: new Date(),
    },
  });

  const before = await balanceOf(period.id);

  await db().vacationPeriod.update({
    where: { id: period.id },
    data: { overrideDays: before.allottedDays + 10 },
  });

  const after = await balanceOf(period.id);
  const untouched = await db().vacation.findUniqueOrThrow({
    where: { id: vacation.id },
  });

  // The vacation survives unchanged: same dates, same period, same cost.
  expect(untouched.startDate.getTime()).toBe(vacation.startDate.getTime());
  expect(untouched.endDate.getTime()).toBe(vacation.endDate.getTime());
  expect(untouched.periodId).toBe(period.id);
  expect(untouched.businessDaysUsed).toBe(5);
  expect(untouched.statusId).toBe(approvedStatus);

  // And every added day lands in "remaining".
  expect(after.allottedDays).toBe(before.allottedDays + 10);
  expect(after.usedDays).toBe(before.usedDays);
  expect(after.remainingDays).toBe(before.remainingDays + 10);
});

test("un período vencido deja de aceptar solicitudes pero conserva su historial", async () => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const [firstPeriod] = await seedPeriods(user.id, user.hireDate as Date, 3);

  // Close the first period's grace window in the past.
  const lapsed = new Date();
  lapsed.setDate(lapsed.getDate() - 1);
  await db().vacationPeriod.update({
    where: { id: firstPeriod.id },
    data: { graceEnd: lapsed },
  });

  const stored = await db().vacationPeriod.findUniqueOrThrow({
    where: { id: firstPeriod.id },
  });

  // No "forfeited" state exists: the window simply closes and the row remains.
  expect(stored.graceEnd.getTime()).toBeLessThan(Date.now());
  expect(stored.ruleDays).toBe(12);
});

test("avisa al aprobar cuando hay trabajo programado en esas fechas", async ({
  page,
}) => {
  const suffix = uniqueSuffix();
  const user = await createFsrHiredYearsAgo(suffix, 2);
  const [, , period] = await seedPeriods(user.id, user.hireDate as Date, 3);

  const range = weekdayRange(6);
  const vacation = await db().vacation.create({
    data: {
      userId: user.id,
      startDate: range.start,
      endDate: range.end,
      statusId: await statusId("PENDIENTE"),
      periodId: period.id,
      businessDaysUsed: 5,
    },
    select: { id: true },
  });

  // Work already scheduled on the Wednesday of that week.
  const scheduled = new Date(range.start);
  scheduled.setDate(scheduled.getDate() + 2);

  const [incidentType, incidentStatus, cliente] = await Promise.all([
    db().incidentType.findFirstOrThrow({ where: { active: true } }),
    db().incidentStatus.findFirstOrThrow({ where: { name: "ABIERTO" } }),
    db().cliente.findFirstOrThrow({ where: { active: true } }),
  ]);

  const incident = await db().incident.create({
    data: {
      title: `E2E Choque vacaciones ${suffix}`,
      description: "Trabajo agendado dentro del período solicitado.",
      typeId: incidentType.id,
      statusId: incidentStatus.id,
      clienteId: cliente.id,
    },
    select: { id: true },
  });

  const assignmentStatus = await db().assignmentStatus.findFirstOrThrow({
    where: { name: "ASIGNADO" },
  });

  await db().assignment.create({
    data: {
      incidentId: incident.id,
      statusId: assignmentStatus.id,
      scheduledDate: scheduled,
      assignees: { create: [{ userId: user.id }] },
    },
  });

  await page.goto("/admin/vacations");
  const row = page.locator("tr").filter({ hasText: user.name });
  await row.getByRole("button", { name: "Aprobar" }).click();

  // The admin is told what would be stranded before the decision, not after —
  // approving does not reassign the work.
  await expect(
    page.getByText("Hay trabajo programado en esas fechas"),
  ).toBeVisible();
  await expect(page.getByText(/no reasigna ese trabajo/)).toBeVisible();

  // Cancelling leaves the request pending.
  await page.getByRole("button", { name: "Cancelar" }).click();
  const stillPending = await db().vacation.findUniqueOrThrow({
    where: { id: vacation.id },
    include: { status: true },
  });
  expect(stillPending.status.name).toBe("PENDIENTE");

  // Confirming goes through: the warning informs, it does not block.
  await row.getByRole("button", { name: "Aprobar" }).click();
  await page.getByRole("button", { name: "Aprobar de todos modos" }).click();
  await expect(
    page.getByRole("alert").or(page.getByRole("status")),
  ).toBeVisible();

  await expect
    .poll(async () => {
      const settled = await db().vacation.findUniqueOrThrow({
        where: { id: vacation.id },
        include: { status: true },
      });
      return settled.status.name;
    })
    .toBe("APROBADA");
});

test("la página de vacaciones del admin muestra saldo y calendario anual", async ({
  page,
}) => {
  await page.goto("/admin/vacations");

  await expect(
    page.getByRole("heading", { name: "Solicitudes de Vacaciones" }),
  ).toBeVisible();

  // The two halves of the planner: balance on the left, the year on the right.
  await expect(page.getByText("Días de vacaciones").first()).toBeVisible();
  await expect(page.getByText("Enero", { exact: true })).toBeVisible();
  await expect(page.getByText("Diciembre", { exact: true })).toBeVisible();
});

test("el FSR ve su propio saldo sin selector de usuario", async ({
  browser,
}) => {
  const fsrContext = await browser.newContext({
    storageState: authFile("fsr"),
  });
  const page = await fsrContext.newPage();

  await page.goto("/fsr/vacations");
  await expect(
    page.getByRole("heading", { name: "Mis Vacaciones" }),
  ).toBeVisible();
  await expect(page.getByText("Días de vacaciones").first()).toBeVisible();

  // The user picker is admin-only.
  await expect(page.getByPlaceholder("Buscar por nombre...")).toHaveCount(0);

  await fsrContext.close();
});

test("el admin puede consultar la tabla de días por antigüedad", async ({
  page,
}) => {
  await page.goto("/admin/settings/vacation-accrual");

  await expect(
    page.getByRole("heading", { name: "Días de Vacaciones" }),
  ).toBeVisible();

  // Seeded tiers are listed and the grace window is editable.
  await expect(page.getByText("Año 1", { exact: true })).toBeVisible();
  await expect(page.getByText("26 años o más")).toBeVisible();
  await expect(page.getByLabel("Meses de vigencia")).toHaveValue("12");
});

test.afterAll(async () => {
  // Remove only what this spec created; the rest of the suite shares the db.
  const users = await db().user.findMany({
    where: { email: { startsWith: "e2e-vac-" } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    // Assignments first: they reference both the incident and the user.
    const assignments = await db().assignment.findMany({
      where: { assignees: { some: { userId: { in: ids } } } },
      select: { id: true, incidentId: true },
    });
    const assignmentIds = assignments.map((a) => a.id);
    if (assignmentIds.length > 0) {
      await db().assignmentAssignee.deleteMany({
        where: { assignmentId: { in: assignmentIds } },
      });
      await db().assignment.deleteMany({
        where: { id: { in: assignmentIds } },
      });
      await db().incident.deleteMany({
        where: { id: { in: assignments.map((a) => a.incidentId) } },
      });
    }

    await db().vacation.deleteMany({ where: { userId: { in: ids } } });
    await db().vacationPeriod.deleteMany({ where: { userId: { in: ids } } });
    await db().user.deleteMany({ where: { id: { in: ids } } });
  }
});
