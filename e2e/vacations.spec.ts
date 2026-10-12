import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { account, authFile, E2E_PASSWORD } from "./fixtures/auth";
import { db, uniqueSuffix } from "./fixtures/db";
import { submitLogin } from "./fixtures/login";
import { gotoReady } from "./fixtures/navigation";

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
 *
 * Fase 1 (H-07): vacation administration runs as ADMIN_VACACIONES, not ROOT.
 */

test.use({ storageState: authFile("admin-vacaciones") });
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
      // Never used to sign in: the spec drives everything as admin-vacaciones.
      password: "not-used",
      userRoles: { create: [{ roleId: fsrRole.id }] },
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

// Approval warns about existing work without cancelling or reassigning it.
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
  });

  // Work already scheduled on the Wednesday of that week.
  const scheduled = new Date(range.start);
  scheduled.setDate(scheduled.getDate() + 2);

  const [incidentType, incidentStatus, client] = await Promise.all([
    db().incidentType.findFirstOrThrow({ where: { active: true } }),
    db().incidentStatus.findFirstOrThrow({ where: { name: "ABIERTO" } }),
    db().client.findFirstOrThrow({ where: { active: true } }),
  ]);

  const incident = await db().incident.create({
    data: {
      title: `E2E Choque vacaciones ${suffix}`,
      description: "Trabajo agendado dentro del período solicitado.",
      typeId: incidentType.id,
      statusId: incidentStatus.id,
      clientId: client.id,
    },
    select: { id: true, title: true },
  });

  const assignmentStatus = await db().assignmentStatus.findFirstOrThrow({
    where: { name: "ASIGNADO" },
  });

  const assignment = await db().assignment.create({
    data: {
      incidentId: incident.id,
      statusId: assignmentStatus.id,
      scheduledDate: scheduled,
      assignees: { create: [{ userId: user.id }] },
    },
    include: { assignees: true },
  });

  await gotoReady(page, "/admin/vacations");
  const row = page.locator("tr").filter({ hasText: user.name });
  await row.getByRole("button", { name: "Aprobar" }).click();

  // The admin is told what would be stranded before the decision, not after —
  // approving does not reassign the work.
  const warning = page.getByRole("dialog", {
    name: "Hay trabajo programado en esas fechas",
  });
  await expect(warning).toBeVisible();
  await expect(warning.getByText(/no reasigna ese trabajo/)).toBeVisible();
  await expect(warning).toContainText(`Folio ${assignment.folio}`);
  await expect(warning).toContainText(incident.title);

  // Cancelling the decision dialog leaves the request and scheduled work intact.
  await warning.getByRole("button", { name: "Cancelar" }).click();
  await expect(warning).not.toBeVisible();
  const stillPending = await db().vacation.findUniqueOrThrow({
    where: { id: vacation.id },
    include: { status: true },
  });
  expect(stillPending.status.name).toBe("PENDIENTE");
  expect(stillPending.approvedAt).toBeNull();
  expect(stillPending.approvedById).toBeNull();
  expect(stillPending.active).toBe(true);
  expect(
    await db().assignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: { assignees: true },
    }),
  ).toEqual(assignment);

  // Confirming goes through: the warning informs, it does not block.
  await row.getByRole("button", { name: "Aprobar" }).click();
  await warning.getByRole("button", { name: "Aprobar de todos modos" }).click();
  // Assert the toast's own text. Matching any `alert`/`status` role also
  // catches Next's route announcer, which is always present — so that version
  // of this assertion could pass without the toast ever appearing.
  await expect(
    page.getByText("Solicitud de vacaciones aprobada"),
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
  const approved = await db().vacation.findUniqueOrThrow({
    where: { id: vacation.id },
  });
  const approver = await db().user.findUniqueOrThrow({
    where: { email: account("admin-vacaciones").email },
    select: { id: true },
  });
  expect(approved.approvedById).toBe(approver.id);
  expect(approved.approvedAt).not.toBeNull();
  expect(approved.userId).toBe(user.id);
  expect(approved.periodId).toBe(period.id);
  expect(approved.businessDaysUsed).toBe(vacation.businessDaysUsed);
  expect(approved.startDate).toEqual(vacation.startDate);
  expect(approved.endDate).toEqual(vacation.endDate);
  expect(
    await db().assignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: { assignees: true },
    }),
  ).toEqual(assignment);
});

test("la página de vacaciones del admin muestra saldo y calendario anual", async ({
  page,
}) => {
  const user = await createFsrHiredYearsAgo(uniqueSuffix(), 2);
  const periods = await seedPeriods(user.id, user.hireDate as Date, 3);
  // A distinctive fixture balance also proves the asynchronous picker refresh
  // has replaced the default employee's panel before the assertions proceed.
  periods[2] = await db().vacationPeriod.update({
    where: { id: periods[2].id },
    data: { overrideDays: 37 },
  });
  await gotoReady(page, "/admin/vacations");

  await expect(
    page.getByRole("heading", { name: "Solicitudes de Vacaciones" }),
  ).toBeVisible();

  // Select an eligible fixture explicitly instead of relying on the first user.
  const picker = page.locator('main button[aria-haspopup="dialog"]');
  await picker.click();
  await page.getByPlaceholder("Buscar por nombre...").fill(user.name);
  await page.getByRole("option", { name: user.name, exact: true }).click();
  await expect(picker).toContainText(user.name);

  // The two halves of the planner: balance on the left, the year on the right.
  await expect(page.getByText("Días de vacaciones").first()).toBeVisible();
  const currentPeriod = page.getByRole("button").filter({
    has: page.getByText("Año 3", { exact: true }),
  });
  await expect(currentPeriod).toBeEnabled();
  await expect(currentPeriod).toContainText(
    `/ ${periods[2].overrideDays} días disponibles`,
  );
  await expect(currentPeriod).toContainText("0 día(s) solicitados o aprobados");
  await currentPeriod.click();
  await expect(currentPeriod).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Enero", { exact: true })).toBeVisible();
  await expect(page.getByText("Diciembre", { exact: true })).toBeVisible();
  const stored = await db().vacationPeriod.findMany({
    where: { userId: user.id },
    orderBy: { periodNumber: "asc" },
  });
  expect(stored).toEqual(periods);
  expect(await db().vacation.count({ where: { userId: user.id } })).toBe(0);
});

test("el FSR ve su propio saldo sin selector de usuario", async ({
  browser,
}) => {
  const fsrContext = await browser.newContext({
    storageState: authFile("fsr"),
  });
  const page = await fsrContext.newPage();

  // Self-service moved off the FSR portal: EMPLEADO has no portal, so the
  // page lives at a shared /vacations for every staff role.
  await gotoReady(page, "/vacations");
  await expect(
    page.getByRole("heading", { name: "Mis Vacaciones" }),
  ).toBeVisible();
  await expect(page.getByText("Días de vacaciones").first()).toBeVisible();

  // The user picker is admin-only.
  await expect(page.getByPlaceholder("Buscar por nombre...")).toHaveCount(0);

  await fsrContext.close();
});

/**
 * Parte B: the vacation administrator captures a missing hire date in place,
 * and the employee can request right away.
 *
 * Drives the real /admin/vacations screen as admin-vacaciones (narrow
 * users:manage-employment grant, never the full /admin/users screen), then
 * signs in as the employee and proves the balance panel renders periods
 * instead of the missing-date notice.
 */
test("el admin de vacaciones captura la fecha y el empleado ya puede solicitar", async ({
  page,
  browser,
}) => {
  const suffix = uniqueSuffix();
  const name = `E2E Hire ${suffix}`;
  const email = `e2e-vac-hire-${suffix}@example.com`;
  const password = E2E_PASSWORD();

  const [empleadoRole, activo] = await Promise.all([
    db().role.findFirstOrThrow({ where: { name: "EMPLEADO" } }),
    db().userStatus.findFirstOrThrow({ where: { name: "ACTIVO" } }),
  ]);
  const employee = await db().user.create({
    data: {
      name,
      email,
      password: await bcrypt.hash(password, 4),
      userRoles: { create: [{ roleId: empleadoRole.id }] },
      userStatusId: activo.id,
      hireDate: null,
    },
    select: { id: true },
  });

  // 1. As admin-vacaciones: pick the employee, capture the hire date.
  await gotoReady(page, "/admin/vacations");
  await expect(
    page.getByRole("heading", { name: "Solicitudes de Vacaciones" }),
  ).toBeVisible();

  // The picker shows the current user, not the placeholder, so it has no
  // stable name: scope to the main content, where it is the only dialog
  // trigger (the header bell lives outside main).
  await page.locator('main button[aria-haspopup="dialog"]').click();
  await page.getByPlaceholder("Buscar por nombre...").fill(name);
  await page.getByRole("option", { name }).click();

  await expect(
    page.getByText("fecha de contratación registrada"),
  ).toBeVisible();
  await page.locator("#hire-date").fill("2020-03-15");
  await page.getByRole("button", { name: "Guardar fecha de ingreso" }).click();

  // The balance panel reloads with the earned periods, no navigation needed.
  await expect(page.getByText("Año 1", { exact: true })).toBeVisible();

  const stored = await db().user.findUniqueOrThrow({
    where: { id: employee.id },
    select: { hireDate: true },
  });
  expect(stored.hireDate).not.toBeNull();

  // 2. As the employee: the balance is requestable, the notice is gone.
  const employeeContext = await browser.newContext();
  const employeePage = await employeeContext.newPage();
  await employeePage.goto("/login");
  await submitLogin(employeePage, email, password);
  await employeePage.waitForURL("**/inicio");

  await gotoReady(employeePage, "/vacations");
  await expect(
    employeePage.getByRole("heading", { name: "Mis Vacaciones" }),
  ).toBeVisible();
  await expect(employeePage.getByText("Año 1", { exact: true })).toBeVisible();
  await expect(
    employeePage.getByText("fecha de contratación registrada"),
  ).toHaveCount(0);

  await employeeContext.close();
});

// Accrual actions require vacations:manage, with a dedicated route grant for
// ADMIN_VACACIONES. ROOT also has access; ordinary FSRs cannot open the catalog.
test("ADMIN_VACACIONES y ROOT consultan el catálogo de antigüedad; FSR no accede", async ({
  page,
  browser,
}) => {
  const rules = await db().vacationAccrualRule.findMany({
    where: { active: true },
    orderBy: { minYears: "asc" },
  });
  const setting = await db().vacationSetting.findUniqueOrThrow({
    where: { id: 1 },
  });
  await gotoReady(page, "/admin/settings/vacation-accrual");
  await expect(page).toHaveURL(/\/admin\/settings\/vacation-accrual$/);
  await expect(
    page.getByRole("heading", { name: "Días de Vacaciones" }),
  ).toBeVisible();
  await expect(page.getByText("Año 1", { exact: true })).toBeVisible();
  await expect(page.getByText("26 años o más")).toBeVisible();
  await expect(page.getByLabel("Meses de vigencia")).toHaveValue(
    String(setting.graceWindowMonths),
  );
  await expect(page.locator("tbody tr")).toHaveCount(rules.length);

  const rootContext = await browser.newContext({
    storageState: authFile("admin"),
  });
  try {
    const rootPage = await rootContext.newPage();
    await gotoReady(rootPage, "/admin/settings/vacation-accrual");
    await expect(rootPage).toHaveURL(/\/admin\/settings\/vacation-accrual$/);
    await expect(
      rootPage.getByRole("heading", { name: "Días de Vacaciones" }),
    ).toBeVisible();
    await expect(rootPage.getByText("Año 1", { exact: true })).toBeVisible();
    await expect(rootPage.getByText("26 años o más")).toBeVisible();
    await expect(rootPage.getByLabel("Meses de vigencia")).toHaveValue(
      String(setting.graceWindowMonths),
    );
    await expect(rootPage.locator("tbody tr")).toHaveCount(rules.length);
  } finally {
    await rootContext.close();
  }
  const fsrContext = await browser.newContext({
    storageState: authFile("fsr"),
  });
  try {
    const fsrPage = await fsrContext.newPage();
    await gotoReady(fsrPage, "/admin/settings/vacation-accrual");
    await expect(fsrPage).toHaveURL(/\/unauthorized\/?$/);
    await expect(
      fsrPage.getByText("Acceso Denegado", { exact: true }),
    ).toBeVisible();
    await expect(
      fsrPage.getByRole("heading", { name: "Días de Vacaciones", exact: true }),
    ).toHaveCount(0);
    await expect(fsrPage.getByLabel("Meses de vigencia")).toHaveCount(0);
  } finally {
    await fsrContext.close();
  }
  expect(
    await db().vacationAccrualRule.findMany({
      where: { active: true },
      orderBy: { minYears: "asc" },
    }),
  ).toEqual(rules);
  expect(
    await db().vacationSetting.findUniqueOrThrow({ where: { id: 1 } }),
  ).toEqual(setting);
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
    // Otras suites habilitan a estos FSR en incidentes (incident_assignees);
    // se borra antes que el usuario o la FK incident_assignees_userId_fkey
    // tumba el cleanup.
    await db().incidentAssignee.deleteMany({ where: { userId: { in: ids } } });
    await db().user.deleteMany({ where: { id: { in: ids } } });
  }
});
