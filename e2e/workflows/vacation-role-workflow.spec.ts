import { expect } from "@playwright/test";
import { db } from "../fixtures/db";
import { fillStable, fillStableAll } from "../fixtures/forms";
import { gotoReady } from "../fixtures/navigation";
import {
  cancelVacationUi,
  closeSessions,
  createVacationUi,
  decideVacationUi,
  editVacationUi,
  handoff,
  openVacationEdit,
  roleSession,
  vacationRow,
} from "../fixtures/workflow-ui";
import { test } from "../fixtures/workflows";

test.describe.configure({ mode: "default" });
test.setTimeout(240_000);

const request = (id: string) =>
  db().vacation.findUniqueOrThrow({ where: { id }, include: { status: true } });
async function reserved(periodId: string) {
  const aggregate = await db().vacation.aggregate({
    where: {
      periodId,
      active: true,
      status: { code: { in: ["PENDIENTE", "APROBADA"] } },
    },
    _sum: { businessDaysUsed: true },
  });
  return aggregate._sum.businessDaysUsed ?? 0;
}

test("vacation employee reads and replaces its own near-exhausted pending reservation", async ({
  browser,
  world,
}, info) => {
  const sessions = [];
  try {
    const employee = await roleSession(browser, world.actors.employee, info);
    sessions.push(employee);
    const page = employee.page;
    const initialReason = `Own pending ${world.namespace}`;
    const created = await createVacationUi(
      page,
      world,
      world.actors.employee,
      world.range(7, 2),
      initialReason,
    );
    await expect(page.getByText("Días de vacaciones").first()).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por nombre...")).toHaveCount(0);
    await handoff(page, info, "vacation-employee-request-and-balance");
    const currentGrant = await db().vacationPeriod.findUniqueOrThrow({
      where: {
        userId_cycleYear: {
          userId: world.actors.employee.id,
          cycleYear: Number(world.today.slice(0, 4)),
        },
      },
    });
    expect(currentGrant.availableFrom?.getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
    const grantBefore = { ...currentGrant };
    const allotted = currentGrant.overrideDays ?? currentGrant.ruleDays;
    const almostFull = world.range(7, allotted - 1);
    const dialog = await openVacationEdit(
      page,
      initialReason,
      world.actors.employee,
    );
    await fillStable(
      dialog.getByLabel("Fecha de fin", { exact: true }),
      almostFull.end,
    );
    await dialog.getByLabel("Período de saldo").selectOption(currentGrant.id);
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => reserved(currentGrant.id)).toBe(allotted - 1);
    const before = await request(created.id);
    const full = world.range(7, allotted);
    const changedReason = `Own replacement ${world.namespace}`;
    await editVacationUi(
      page,
      initialReason,
      world.actors.employee,
      full,
      changedReason,
    );
    const after = await request(created.id);
    expect(after.userId).toBe(created.userId);
    expect(after.status.code).toBe("PENDIENTE");
    expect(after.chargedDates).toEqual(full.chargedDates);
    expect(after.businessDaysUsed).toBe(allotted);
    expect(await reserved(currentGrant.id)).toBe(allotted);
    expect(
      await db().vacationPeriod.findUniqueOrThrow({
        where: { id: currentGrant.id },
      }),
    ).toEqual(grantBefore);
    const evidence = await db().businessCorrection.findMany({
      where: { entityType: "Vacation", entityId: created.id },
      orderBy: { createdAt: "asc" },
    });
    expect(evidence).toHaveLength(2);
    expect(evidence[1].actorId).toBe(world.actors.employee.id);
    expect(evidence[1].before).toMatchObject({
      operation: "PENDING_EDIT",
      userId: before.userId,
      businessDaysUsed: allotted - 1,
    });
    expect(evidence[1].after).toMatchObject({
      operation: "PENDING_EDIT",
      userId: after.userId,
      businessDaysUsed: allotted,
    });
    await handoff(page, info, "vacation-employee-atomic-replacement");
    const reasonOnly = `Own reason-only edit ${world.namespace}`;
    await editVacationUi(
      page,
      changedReason,
      world.actors.employee,
      full,
      reasonOnly,
    );
    const reasonEdited = await request(created.id);
    expect(reasonEdited.chargedDates).toEqual(after.chargedDates);
    expect(reasonEdited.periodId).toBe(after.periodId);
    expect(reasonEdited.businessDaysUsed).toBe(after.businessDaysUsed);
    await cancelVacationUi(page, reasonOnly);
    expect((await request(created.id)).active).toBe(false);
    expect(await reserved(currentGrant.id)).toBe(0);
    await handoff(page, info, "vacation-employee-pending-cancellation-release");
  } finally {
    await closeSessions(sessions, info);
  }
});

test("vacation FSR and administrator create edit approve reject and cancel eligible requests", async ({
  browser,
  world,
}, info) => {
  const sessions = [];
  try {
    const fsr = await roleSession(browser, world.actors.fsrB, info);
    sessions.push(fsr);
    const admin = await roleSession(browser, world.actors.vacationAdmin, info);
    sessions.push(admin);
    const employee = await roleSession(browser, world.actors.employee, info);
    sessions.push(employee);
    let ownReason = `FSR own ${world.namespace}`;
    const own = await createVacationUi(
      fsr.page,
      world,
      world.actors.fsrB,
      world.range(8, 2),
      ownReason,
    );
    const editedOwnReason = `FSR own edited ${world.namespace}`;
    await editVacationUi(
      fsr.page,
      ownReason,
      world.actors.fsrB,
      world.range(8, 3),
      editedOwnReason,
    );
    ownReason = editedOwnReason;
    const pending = await request(own.id);
    expect(pending.userId).toBe(world.actors.fsrB.id);
    expect(pending.businessDaysUsed).toBe(3);
    await handoff(fsr.page, info, "vacation-fsr-own-pending-edit");
    await decideVacationUi(admin.page, ownReason, true);
    const approved = await request(own.id);
    expect(approved.approvedById).toBe(world.actors.vacationAdmin.id);
    expect(approved.approvedAt).not.toBeNull();
    expect(approved.chargedDates).toEqual(pending.chargedDates);
    expect(await reserved(approved.periodId as string)).toBe(
      pending.businessDaysUsed,
    );
    await handoff(admin.page, info, "vacation-admin-approved-fsr-request");
    await gotoReady(fsr.page, "/vacations");
    await expect(vacationRow(fsr.page, ownReason)).toContainText("Aprobada");
    await expect(
      vacationRow(fsr.page, ownReason).getByRole("button", {
        name: "Editar solicitud",
      }),
    ).toHaveCount(0);
    await cancelVacationUi(fsr.page, ownReason);
    const ownCancelled = await request(own.id);
    expect(ownCancelled).toMatchObject({
      active: false,
      approvedById: approved.approvedById,
      approvedAt: approved.approvedAt,
    });
    expect(await reserved(approved.periodId as string)).toBe(0);
    await handoff(fsr.page, info, "vacation-fsr-future-approved-cancelled");

    const behalfReason = `Admin behalf ${world.namespace}`;
    const behalf = await createVacationUi(
      admin.page,
      world,
      world.actors.employee,
      world.range(10, 2),
      behalfReason,
      true,
    );
    expect(behalf.createdById).toBe(world.actors.vacationAdmin.id);
    const editedReason = `Admin edited ${world.namespace}`;
    await editVacationUi(
      admin.page,
      behalfReason,
      world.actors.employee,
      world.range(10, 3),
      editedReason,
    );
    expect((await request(behalf.id)).userId).toBe(world.actors.employee.id);
    await gotoReady(employee.page, "/vacations");
    await expect(vacationRow(employee.page, editedReason)).toContainText(
      "Pendiente",
    );
    await handoff(
      employee.page,
      info,
      "vacation-employee-reads-admin-on-behalf-edit",
    );
    await decideVacationUi(admin.page, editedReason, false);
    const rejected = await request(behalf.id);
    expect(rejected.approvedById).toBe(world.actors.vacationAdmin.id);
    expect(await reserved(rejected.periodId as string)).toBe(0);
    await handoff(
      admin.page,
      info,
      "vacation-admin-on-behalf-edited-and-rejected",
    );
    const approvedReason = `Admin eligible cancel ${world.namespace}`;
    const future = await createVacationUi(
      admin.page,
      world,
      world.actors.employee,
      world.range(20, 2),
      approvedReason,
      true,
    );
    await decideVacationUi(admin.page, approvedReason, true);
    const futureApproved = await request(future.id);
    await cancelVacationUi(admin.page, approvedReason);
    const cancelled = await request(future.id);
    expect(cancelled).toMatchObject({
      active: false,
      approvedAt: futureApproved.approvedAt,
      approvedById: futureApproved.approvedById,
    });
    expect(cancelled.chargedDates).toEqual(futureApproved.chargedDates);
    expect(await reserved(futureApproved.periodId as string)).toBe(0);
    const pendingReason = `Admin pending cancel ${world.namespace}`;
    const adminPending = await createVacationUi(
      admin.page,
      world,
      world.actors.employee,
      world.range(30, 1),
      pendingReason,
      true,
    );
    await cancelVacationUi(admin.page, pendingReason);
    expect((await request(adminPending.id)).active).toBe(false);
    await handoff(admin.page, info, "vacation-admin-cancellation-release");
  } finally {
    await closeSessions(sessions, info);
  }
});

test("vacation started retroactive approval requires correction and retains original evidence", async ({
  browser,
  world,
}, info) => {
  const sessions = [];
  try {
    const admin = await roleSession(browser, world.actors.vacationAdmin, info);
    sessions.push(admin);
    const employee = await roleSession(browser, world.actors.employee, info);
    sessions.push(employee);
    const reason = `Retroactive authorized absence ${world.namespace}`;
    const range = world.range(-2, 7);
    const created = await createVacationUi(
      admin.page,
      world,
      world.actors.employee,
      range,
      reason,
      true,
    );
    await decideVacationUi(admin.page, reason, true);
    const approved = await request(created.id);
    const grantBefore = await db().vacationPeriod.findUniqueOrThrow({
      where: { id: approved.periodId as string },
    });
    await expect(
      vacationRow(admin.page, reason).getByRole("button", {
        name: "Cancelar solicitud",
      }),
    ).toHaveCount(0);
    await expect(vacationRow(admin.page, reason)).toContainText("ya comenzó");
    await gotoReady(employee.page, "/vacations");
    const own = vacationRow(employee.page, reason);
    await expect(own).toContainText("Aprobada");
    await expect(
      own.getByRole("button", {
        name: /Cancelar solicitud|Editar solicitud|Corregir/,
      }),
    ).toHaveCount(0);
    expect(await request(created.id)).toEqual(approved);
    await handoff(
      employee.page,
      info,
      "vacation-started-cancellation-unavailable",
    );
    const row = vacationRow(admin.page, reason);
    await row
      .getByRole("button", { name: "Corregir período iniciado" })
      .click();
    await fillStable(row.getByLabel("Último día de ausencia"), world.today);
    await expect(
      row.getByRole("button", { name: "Guardar corrección" }),
    ).toBeDisabled();
    const correctionReason = `Separate shortening reason ${world.namespace}`;
    await fillStable(
      row.getByLabel("Motivo de la corrección"),
      correctionReason,
    );
    await row.getByRole("button", { name: "Guardar corrección" }).click();
    await expect(
      admin.page.getByText("Corrección registrada", { exact: true }),
    ).toBeVisible();
    const corrected = await request(created.id);
    expect(corrected.approvedAt).toEqual(approved.approvedAt);
    expect(corrected.approvedById).toBe(approved.approvedById);
    expect(corrected.reason).toBe(approved.reason);
    expect(corrected.startDate).toEqual(approved.startDate);
    expect(corrected.chargedDates).toEqual(approved.chargedDates);
    expect(corrected.businessDaysUsed).toBe(
      approved.chargedDates.filter((day) => day <= world.today).length,
    );
    expect(corrected.businessDaysUsed).toBeLessThan(
      approved.businessDaysUsed as number,
    );
    const correction = await db().businessCorrection.findFirstOrThrow({
      where: {
        entityType: "Vacation",
        entityId: created.id,
        reason: correctionReason,
      },
    });
    expect(correction.actorId).toBe(world.actors.vacationAdmin.id);
    expect(correction.before).toMatchObject({
      chargedDates: approved.chargedDates,
    });
    expect(corrected.correctionHistory).toEqual(approved.correctionHistory);
    expect(
      await db().vacationPeriod.findUniqueOrThrow({
        where: { id: grantBefore.id },
      }),
    ).toEqual(grantBefore);
    await handoff(admin.page, info, "vacation-started-correction-snapshots");
  } finally {
    await closeSessions(sessions, info);
  }
});

test("vacation cross-owner navigation and stale pending drafts cannot mutate decisions", async ({
  browser,
  world,
}, info) => {
  const sessions = [];
  try {
    const owner = await roleSession(browser, world.actors.employee, info);
    sessions.push(owner);
    const other = await roleSession(browser, world.actors.otherEmployee, info);
    sessions.push(other);
    const admin = await roleSession(browser, world.actors.vacationAdmin, info);
    sessions.push(admin);
    const reason = `Private pending ${world.namespace}`;
    const created = await createVacationUi(
      owner.page,
      world,
      world.actors.employee,
      world.range(12, 2),
      reason,
    );
    await gotoReady(other.page, "/vacations");
    await expect(other.page.getByText(reason, { exact: true })).toHaveCount(0);
    await expect(
      other.page.getByRole("button", {
        name: /Editar solicitud|Cancelar solicitud|Aprobar|Corregir/,
      }),
    ).toHaveCount(0);
    // Exercise real denied routes, not invented /vacations/[id] pages.
    for (const route of ["/admin/vacations", "/admin/vacations/new"]) {
      await gotoReady(other.page, route);
      await expect(other.page).toHaveURL(/\/unauthorized\/?$/);
      await expect(
        other.page.getByText("Acceso Denegado", { exact: true }),
      ).toBeVisible();
    }
    expect(await request(created.id)).toMatchObject({
      userId: world.actors.employee.id,
      reason,
      active: true,
      approvedAt: null,
    });
    await handoff(other.page, info, "vacation-cross-owner-route-denial");
    const draft = await openVacationEdit(
      owner.page,
      reason,
      world.actors.employee,
    );
    await fillStable(
      draft.getByLabel(/^Motivo/),
      `Stale draft ${world.namespace}`,
    );
    await decideVacationUi(admin.page, reason, true);
    const winner = await request(created.id);
    await draft
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(draft.getByRole("alert")).toContainText(/pendiente/i);
    await expect(draft.getByLabel(/^Motivo/)).toHaveValue(
      `Stale draft ${world.namespace}`,
    );
    expect(await request(created.id)).toEqual(winner);
    expect(
      await db().businessCorrection.count({
        where: { entityId: created.id, entityType: "Vacation" },
      }),
    ).toBe(0);
    await handoff(
      owner.page,
      info,
      "vacation-stale-draft-retained-after-approval",
    );
  } finally {
    await closeSessions(sessions, info);
  }
});

test("vacation invalid range overlap and insufficient balance retain the existing reservation", async ({
  browser,
  world,
}, info) => {
  const sessions = [];
  try {
    const owner = await roleSession(browser, world.actors.employee, info);
    sessions.push(owner);
    const reason = `Validation pending ${world.namespace}`;
    const created = await createVacationUi(
      owner.page,
      world,
      world.actors.employee,
      world.range(7, 2),
      reason,
    );
    const overlap = await createVacationUi(
      owner.page,
      world,
      world.actors.employee,
      world.range(14, 2),
      `Overlap blocker ${world.namespace}`,
    );
    const before = await request(created.id);
    const dialog = await openVacationEdit(
      owner.page,
      reason,
      world.actors.employee,
    );
    await fillStable(
      dialog.getByLabel("Fecha de fin", { exact: true }),
      world.range(1, 1).end,
    );
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(/posterior/i);
    expect(await request(created.id)).toEqual(before);
    await fillStableAll([
      [
        dialog.getByLabel("Fecha de inicio", { exact: true }),
        world.range(14, 2).start,
      ],
      [
        dialog.getByLabel("Fecha de fin", { exact: true }),
        world.range(14, 2).end,
      ],
    ]);
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      /solap|traslap|superpon|existe/i,
    );
    expect(await request(created.id)).toEqual(before);
    // Valid non-overlapping range, beyond every single earned grant's balance.
    await fillStableAll([
      [
        dialog.getByLabel("Fecha de inicio", { exact: true }),
        world.range(30, 40).start,
      ],
      [
        dialog.getByLabel("Fecha de fin", { exact: true }),
        world.range(30, 40).end,
      ],
    ]);
    const earnedGrant = await db().vacationPeriod.findUniqueOrThrow({
      where: {
        userId_cycleYear: {
          userId: world.actors.employee.id,
          cycleYear: Number(world.today.slice(0, 4)),
        },
      },
    });
    await dialog.getByLabel("Período de saldo").selectOption(earnedGrant.id);
    await dialog
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(dialog.getByRole("alert")).toContainText(
      /saldo|días|período/i,
    );
    await expect(
      dialog.getByLabel("Fecha de fin", { exact: true }),
    ).toHaveValue(world.range(30, 40).end);
    expect(await request(created.id)).toEqual(before);
    expect((await request(overlap.id)).active).toBe(true);
    expect(
      await db().businessCorrection.count({
        where: { entityId: created.id, entityType: "Vacation" },
      }),
    ).toBe(0);
    await handoff(
      owner.page,
      info,
      "vacation-invalid-replacement-draft-and-reservation-preserved",
    );
  } finally {
    await closeSessions(sessions, info);
  }
});
