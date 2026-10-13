import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Prisma } from "@prisma/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  approveVacation,
  createVacation,
  deleteVacation,
  rejectVacation,
  updateVacation,
} from "@/lib/actions/vacations";
import { prisma } from "@/lib/database/prisma.singleton";
import { getPeriodBalance } from "@/lib/services/vacation-periods";
import { vacationChargedDates } from "@/lib/services/vacation-periods-policy";
import { mxDateString, mxDayRange } from "@/lib/utils/datetime";

const scheduling = vi.hoisted(() => ({
  identity: (): string | undefined => undefined,
  afterRead: async (_model: string, _method: string) => {},
  auditFailure: false,
}));
vi.mock("next-auth", () => ({
  getServerSession: async () => ({
    user: { id: scheduling.identity() },
    expires: new Date(Date.now() + 3600000).toISOString(),
  }),
}));
// Pause actual transaction reads, without replacing database behavior or retries.
vi.mock("@/lib/database/serializable-transaction", async (original) => {
  const production =
    await original<typeof import("@/lib/database/serializable-transaction")>();
  return {
    serializableTransaction: <T>(
      run: (tx: Prisma.TransactionClient) => Promise<T>,
    ) =>
      production.serializableTransaction((tx) =>
        run(
          new Proxy(tx, {
            get(target, model, receiver) {
              const delegate = Reflect.get(target, model, receiver);
              if (
                typeof model !== "string" ||
                !delegate ||
                typeof delegate !== "object"
              )
                return delegate;
              return new Proxy(delegate, {
                get(modelTarget, method) {
                  const query = Reflect.get(modelTarget, method);
                  if (typeof query !== "function") return query;
                  return async (...args: unknown[]) => {
                    if (
                      scheduling.auditFailure &&
                      model === "businessCorrection" &&
                      method === "create"
                    )
                      throw new Error("Injected audit storage failure");
                    const result = await query.apply(modelTarget, args);
                    await scheduling.afterRead(model, String(method));
                    return result;
                  };
                },
              });
            },
          }),
        ),
      ),
  };
});

const sessions = new AsyncLocalStorage<string>();
scheduling.identity = () => sessions.getStore();
const as = <T>(actor: string, action: () => Promise<T>) =>
  sessions.run(actor, action);
const inputDate = (key: string) => new Date(`${key}T00:00:00Z`);
async function waitForBarrier(ready: Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Pending-edit race barrier timed out")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
let adminId: string;
let dates: string[];
async function person(code: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code } });
  const status = await prisma.userStatus.findFirstOrThrow({
    where: { active: true },
  });
  return prisma.user.create({
    data: {
      name: "Pending edit integration",
      email: `edit-${randomUUID()}@test.local`,
      password: "unused-test-hash",
      userStatusId: status.id,
      hireDate: mxDayRange(
        `${Number(mxDateString(new Date()).slice(0, 4)) - 5}-01-01`,
      ).gte,
      userRoles: { create: { roleId: role.id } },
    },
  });
}
async function funded(days = 3) {
  const user = await person("EMPLEADO");
  const year = Number(mxDateString(new Date()).slice(0, 4));
  const period = await prisma.vacationPeriod.create({
    data: {
      userId: user.id,
      periodNumber: 5,
      cycleYear: year,
      availableFrom: mxDayRange(`${year}-01-01`).gte,
      accrualStart: mxDayRange(`${year}-01-01`).gte,
      accrualEnd: mxDayRange(`${year}-12-31`).lte,
      graceEnd: mxDayRange(`${year + 2}-12-31`).lte,
      ruleDays: days,
    },
  });
  return { user, period };
}
async function request(
  userId: string,
  periodId: string,
  start = dates[0],
  end = dates[1],
) {
  const result = await as(userId, () =>
    createVacation({
      periodId,
      startDate: inputDate(start),
      endDate: inputDate(end),
      reason: "Original request",
    }),
  );
  if (!result.success) throw new Error(result.error);
  return result.data;
}
beforeAll(async () => {
  adminId = (await person("ADMIN_VACACIONES")).id;
  const start = inputDate(mxDateString(new Date()));
  start.setUTCDate(start.getUTCDate() + 2);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 30);
  dates = await prisma.$transaction((tx) =>
    vacationChargedDates(
      mxDayRange(start.toISOString().slice(0, 10)).gte,
      mxDayRange(end.toISOString().slice(0, 10)).lte,
      tx,
    ),
  );
  expect(dates.length).toBeGreaterThan(10);
});
afterEach(() => {
  scheduling.afterRead = async () => {};
  scheduling.auditFailure = false;
});

describe("atomic pending edits against real PostgreSQL", () => {
  it("rolls back replacement when append-only audit storage fails", async () => {
    const { user, period } = await funded();
    const old = await request(user.id, period.id);
    scheduling.auditFailure = true;
    await expect(
      as(user.id, () =>
        updateVacation(old.id, {
          startDate: inputDate(dates[0]),
          endDate: inputDate(dates[2]),
          periodId: period.id,
        }),
      ),
    ).rejects.toThrow("Injected audit storage failure");
    expect(await prisma.vacation.findUnique({ where: { id: old.id } })).toEqual(
      old,
    );
    expect((await getPeriodBalance(period.id)).usedDays).toBe(2);
    expect(
      await prisma.businessCorrection.count({ where: { entityId: old.id } }),
    ).toBe(0);
  });

  it("preserves charge dates and prior evidence on an administrator reason-only edit", async () => {
    const { user, period } = await funded();
    const old = await request(user.id, period.id);
    expect(
      await as(adminId, () =>
        updateVacation(old.id, {
          startDate: inputDate(dates[0]),
          endDate: inputDate(dates[1]),
          reason: "Clarified reason",
        }),
      ),
    ).toMatchObject({ success: true });
    const current = await prisma.vacation.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(current.chargedDates).toEqual(old.chargedDates);
    expect(current.periodId).toBe(old.periodId);
    expect(current.businessDaysUsed).toBe(old.businessDaysUsed);
    expect(current.correctionHistory).toEqual(old.correctionHistory);
    expect(current.approvedAt).toEqual(old.approvedAt);
    expect((await getPeriodBalance(period.id)).usedDays).toBe(2);
  });
  it.each(["approve", "reject", "cancel"] as const)(
    "preserves a %s winner after a stale edit read",
    async (decision) => {
      const { user, period } = await funded();
      const old = await request(user.id, period.id);
      let arrived!: () => void;
      let release!: () => void;
      const read = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      const resume = new Promise<void>((resolve) => {
        release = resolve;
      });
      let paused = false;
      scheduling.afterRead = async (model, method) => {
        if (
          sessions.getStore() === user.id &&
          model === "vacation" &&
          method === "findUnique" &&
          !paused
        ) {
          paused = true;
          arrived();
          await waitForBarrier(resume);
        }
      };
      const edit = as(user.id, () =>
        updateVacation(old.id, {
          startDate: inputDate(dates[0]),
          endDate: inputDate(dates[2]),
          periodId: period.id,
          reason: "Losing draft",
        }),
      );
      try {
        await waitForBarrier(read);
        const winner = await as(adminId, () =>
          decision === "approve"
            ? approveVacation(old.id)
            : decision === "reject"
              ? rejectVacation(old.id)
              : deleteVacation(old.id),
        );
        expect(winner.success).toBe(true);
      } finally {
        release();
      }
      expect((await edit).success).toBe(false);
      const final = await prisma.vacation.findUniqueOrThrow({
        where: { id: old.id },
        include: { status: true },
      });
      expect(final.reason).toBe(old.reason);
      expect(final.chargedDates).toEqual(old.chargedDates);
      expect(final.businessDaysUsed).toBe(2);
      expect(final.active).toBe(decision !== "cancel");
      if (decision !== "cancel") {
        expect(final.status.code).toBe(
          decision === "approve" ? "APROBADA" : "RECHAZADA",
        );
        expect(final.approvedById).toBe(adminId);
        expect(final.approvedAt).not.toBeNull();
      }
      expect(
        await prisma.businessCorrection.count({ where: { entityId: old.id } }),
      ).toBe(0);
      expect((await getPeriodBalance(period.id)).usedDays).toBe(
        decision === "approve" ? 2 : 0,
      );
    },
  );

  it("replaces own reservation, retains historical ledger and grant, and audits one before/after", async () => {
    const { user, period } = await funded(5);
    const history = await prisma.historicalVacationConsumption.create({
      data: {
        userId: user.id,
        cycleYear: period.cycleYear as number,
        fundingPeriodId: period.id,
        sourceDigest: randomUUID().replaceAll("-", "").repeat(2),
        sourceSheet: "PendingEdit",
        sourceRow: 1,
        sourceEntitledDays: 5,
        sourceTakenDays: 2,
        sourceRemainingDays: 3,
        identityVerified: true,
        reviewStatus: "APPROVED",
      },
    });
    const old = await request(user.id, period.id);
    expect((await getPeriodBalance(period.id)).remainingDays).toBe(1);
    const result = await as(user.id, () =>
      updateVacation(old.id, {
        startDate: inputDate(dates[0]),
        endDate: inputDate(dates[2]),
        periodId: period.id,
        reason: "Replacement",
      }),
    );
    expect(result).toMatchObject({
      success: true,
      data: { userId: user.id, businessDaysUsed: 3 },
    });
    expect(
      await prisma.historicalVacationConsumption.findUnique({
        where: { id: history.id },
      }),
    ).toEqual(history);
    expect(
      await prisma.vacationPeriod.findUnique({ where: { id: period.id } }),
    ).toEqual(period);
    expect((await getPeriodBalance(period.id)).remainingDays).toBe(0);
    const receipts = await prisma.businessCorrection.findMany({
      where: { entityId: old.id },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      actorId: user.id,
      before: { operation: "PENDING_EDIT", businessDaysUsed: 2 },
      after: { operation: "PENDING_EDIT", businessDaysUsed: 3 },
    });
    const current = await prisma.vacation.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(
      (
        await as(user.id, () =>
          updateVacation(old.id, {
            startDate: inputDate(dates[0]),
            endDate: inputDate(dates[3]),
            periodId: period.id,
          }),
        )
      ).success,
    ).toBe(false);
    expect(await prisma.vacation.findUnique({ where: { id: old.id } })).toEqual(
      current,
    );
    expect(
      await prisma.businessCorrection.count({ where: { entityId: old.id } }),
    ).toBe(1);
  });

  it("allows only one competing reservation expansion to consume the last day", async () => {
    const { user, period } = await funded();
    const first = await request(user.id, period.id, dates[0], dates[0]);
    const second = await request(user.id, period.id, dates[4], dates[4]);
    let arrivals = 0;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    scheduling.afterRead = async (model, method) => {
      if (model !== "vacation" || method !== "findUnique" || arrivals >= 2)
        return;
      arrivals += 1;
      if (arrivals === 2) release();
      await waitForBarrier(ready);
    };
    const results = await Promise.all([
      as(user.id, () =>
        updateVacation(first.id, {
          startDate: inputDate(dates[0]),
          endDate: inputDate(dates[1]),
          periodId: period.id,
        }),
      ),
      as(user.id, () =>
        updateVacation(second.id, {
          startDate: inputDate(dates[4]),
          endDate: inputDate(dates[5]),
          periodId: period.id,
        }),
      ),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    expect(arrivals).toBe(2);
    expect((await getPeriodBalance(period.id)).usedDays).toBe(3);
    for (const [index, original] of [first, second].entries()) {
      if (!results[index].success)
        expect(
          await prisma.vacation.findUnique({ where: { id: original.id } }),
        ).toEqual(original);
    }
    expect(
      await prisma.businessCorrection.count({
        where: { entityId: { in: [first.id, second.id] } },
      }),
    ).toBe(1);
  });

  it("replays exact additive grants without changing unrelated grants", async () => {
    const sql = readFileSync(
      "prisma/migrations/20261012000001_vacations_update_permission/migration.sql",
      "utf8",
    );
    const unrelated = await prisma.rolePermission.findMany({
      where: { permission: { name: { not: "vacations:update" } } },
      orderBy: { id: "asc" },
    });
    for (let replay = 0; replay < 2; replay += 1) {
      for (const statement of sql
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean))
        await prisma.$executeRawUnsafe(statement);
    }
    const grants = await prisma.rolePermission.findMany({
      where: { permission: { name: "vacations:update" }, active: true },
      include: { role: true },
    });
    expect(grants.map((grant) => grant.role.code).sort()).toEqual([
      "ADMIN_VACACIONES",
      "EMPLEADO",
      "FSR",
      "ROOT",
    ]);
    expect(
      await prisma.rolePermission.findMany({
        where: { permission: { name: { not: "vacations:update" } } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(unrelated);
  });
});
