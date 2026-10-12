import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { closeAssignment } from "@/lib/actions/assignments";
import { createAccrualRule } from "@/lib/actions/vacation-accrual-rules";
import {
  approveVacation,
  correctStartedVacation,
  createVacation,
  deleteVacation,
  rejectVacation,
  updatePeriodOverride,
} from "@/lib/actions/vacations";
import {
  cancelVehicleTrip,
  endVehicleTrip,
  startVehicleTrip,
} from "@/lib/actions/vehicle-trips";
import { correctVehicleOdometer, deleteVehicle } from "@/lib/actions/vehicles";
import { prisma } from "@/lib/database/prisma.singleton";
import { getPeriodBalance } from "@/lib/services/vacation-periods";
import { holidayRuleMatchesDate } from "@/lib/utils/availability";
import { mxDateString, mxDayRange } from "@/lib/utils/datetime";
import { MATRIX_BUSINESS_INVARIANTS } from "./coverage";
import { createWorld, type IntWorld } from "./fixtures";

const scheduling = vi.hoisted(() => ({
  identity: (): string | undefined => undefined,
  afterRead: async (_model: string, _method: string): Promise<void> => {},
}));

// Per-call sessions let different drivers race without a shared actAs identity.
vi.mock("next-auth", () => ({
  getServerSession: async () => ({
    user: { id: scheduling.identity() },
    expires: new Date(Date.now() + 3600_000).toISOString(),
  }),
}));

vi.mock("@/lib/storage/file-storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/storage/file-storage")>()),
  uploadFileFromBuffer: async () => ({
    url: `test://invariants/${randomUUID()}.jpg`,
    filename: "odo.jpg",
    size: 100,
    mimetype: "image/jpeg",
    provider: "filesystem",
  }),
  deleteFile: async () => {},
}));

// Scheduling instrumentation only: all queries, commits and retry handling
// still use the production helper and the real PostgreSQL transaction client.
vi.mock("@/lib/database/serializable-transaction", async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import("@/lib/database/serializable-transaction")
    >();
  return {
    serializableTransaction: <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
    ) =>
      original.serializableTransaction((tx) =>
        operation(
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
const as = <T>(id: string, action: () => Promise<T>) =>
  sessions.run(id, action);
let world: IntWorld;

/** Both first attempts finish the selected read before either may write.
 * Retries bypass the barrier. A deadline reports missing arrivals, not a hang. */
function overlapRead(model: string, method: string) {
  let arrivals = 0;
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  scheduling.afterRead = async (readModel, readMethod) => {
    if (readModel !== model || readMethod !== method || arrivals >= 2) return;
    arrivals += 1;
    if (arrivals === 2) release();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(new Error(`Missing barrier arrival: ${model}.${method}`)),
            5000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
  return () => expect(arrivals, `overlap at ${model}.${method}`).toBe(2);
}

beforeAll(async () => {
  world = await createWorld("invariants");
});
afterEach(() => {
  scheduling.afterRead = async () => {};
});

async function vehicle() {
  const status = await prisma.vehicleStatus.findUniqueOrThrow({
    where: { code: "AVAILABLE" },
  });
  return prisma.vehicle.create({
    data: {
      make: "Int",
      model: "Invariants",
      year: 2024,
      licensePlate: `INV-${randomUUID()}`,
      statusId: status.id,
    },
  });
}

function tripForm(
  kind: "start" | "end",
  id: string,
  reading: number,
  key = randomUUID(),
) {
  const form = new FormData();
  form.set(kind === "start" ? "vehicleId" : "tripId", id);
  form.set(kind === "start" ? "startOdometer" : "endOdometer", String(reading));
  form.set(
    "photo",
    new File([new Uint8Array(100)], "odo.jpg", { type: "image/jpeg" }),
  );
  form.set("capturedAt", new Date().toISOString());
  form.set("idempotencyKey", key);
  form.set(
    "startExceptionReason",
    "Authorized integration trip on an exceptional day",
  );
  return form;
}

async function openTrip(vehicleId: string, reading = 5000) {
  const result = await as(world.root.id, () =>
    startVehicleTrip(tripForm("start", vehicleId, reading)),
  );
  expect(result).toMatchObject({ success: true });
  if (!result.success) throw new Error(result.error);
  return result.data;
}

function oneWinner(results: { success: boolean }[]) {
  expect(results.filter((result) => result.success)).toHaveLength(1);
  expect(results.filter((result) => !result.success)).toHaveLength(1);
}

async function cancelOpenRootTrips() {
  const trips = await prisma.vehicleTrip.findMany({
    where: {
      fsrId: { in: [world.root.id, world.opsAll.id] },
      active: true,
      status: { code: "EN_CURSO" },
    },
  });
  for (const trip of trips) {
    expect(
      await as(world.root.id, () =>
        cancelVehicleTrip(trip.id, "Fixture cleanup through action"),
      ),
    ).toMatchObject({ success: true });
  }
}

describe("business invariant registration", () => {
  it("registers only actions exercised below", () => {
    expect([...MATRIX_BUSINESS_INVARIANTS].sort()).toEqual(
      [
        "assignments.ts :: closeAssignment",
        "vacation-accrual-rules.ts :: createAccrualRule",
        "vacations.ts :: approveVacation",
        "vacations.ts :: correctStartedVacation",
        "vacations.ts :: createVacation",
        "vacations.ts :: rejectVacation",
        "vacations.ts :: updatePeriodOverride",
        "vehicle-trips.ts :: cancelVehicleTrip",
        "vehicle-trips.ts :: endVehicleTrip",
        "vehicle-trips.ts :: startVehicleTrip",
        "vehicles.ts :: correctVehicleOdometer",
        "vehicles.ts :: deleteVehicle",
      ].sort(),
    );
  });
});

describe("vehicle trip invariants", () => {
  it("concurrent retries of one start key converge with an actor-bound receipt", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const key = randomUUID();
    const overlapped = overlapRead("vehicle", "findUnique");
    const results = await Promise.all(
      [1, 2].map(() =>
        as(world.root.id, () =>
          startVehicleTrip(tripForm("start", v.id, 5000, key)),
        ),
      ),
    );
    overlapped();
    expect(results).toMatchObject([{ success: true }, { success: true }]);
    const trips = await prisma.vehicleTrip.findMany({
      where: { vehicleId: v.id },
    });
    expect(trips).toHaveLength(1);
    for (const result of results)
      expect(result).toMatchObject({ data: { id: trips[0]?.id } });
    expect(
      await prisma.actionIdempotency.findUniqueOrThrow({ where: { key } }),
    ).toMatchObject({
      action: "startVehicleTrip",
      targetId: trips[0]?.id,
      actorId: world.root.id,
      requestTargetId: v.id,
    });
  });

  it("distinct keys and drivers cannot occupy the same vehicle", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const overlapped = overlapRead("vehicle", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () => startVehicleTrip(tripForm("start", v.id, 5000))),
      as(world.opsAll.id, () =>
        startVehicleTrip(tripForm("start", v.id, 5000)),
      ),
    ]);
    overlapped();
    oneWinner(results);
    expect(
      await prisma.vehicleTrip.count({
        where: { vehicleId: v.id, active: true, status: { code: "EN_CURSO" } },
      }),
    ).toBe(1);
    expect(
      await prisma.vehicle.findUniqueOrThrow({
        where: { id: v.id },
        include: { status: true },
      }),
    ).toMatchObject({ active: true, status: { code: "IN_USE" } });
  });

  it("distinct vehicles and keys cannot give one driver two open trips", async () => {
    await cancelOpenRootTrips();
    const vehicles = await Promise.all([vehicle(), vehicle()]);
    const overlapped = overlapRead("vehicle", "findUnique");
    const results = await Promise.all(
      vehicles.map((v) =>
        as(world.root.id, () =>
          startVehicleTrip(tripForm("start", v.id, 5000)),
        ),
      ),
    );
    overlapped();
    oneWinner(results);
    expect(
      await prisma.vehicleTrip.count({
        where: {
          fsrId: world.root.id,
          active: true,
          status: { code: "EN_CURSO" },
        },
      }),
    ).toBe(1);
    const rows = await prisma.vehicle.findMany({
      where: { id: { in: vehicles.map((v) => v.id) } },
      include: { status: true },
    });
    expect(rows.map((row) => row.status.code).sort()).toEqual([
      "AVAILABLE",
      "IN_USE",
    ]);
  });

  it("two different close keys have one winner and retain its evidence only", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const trip = await openTrip(v.id);
    const keys = [randomUUID(), randomUUID()];
    const overlapped = overlapRead("vehicleTrip", "findUnique");
    const results = await Promise.all(
      keys.map((key, index) =>
        as(world.root.id, () =>
          endVehicleTrip(tripForm("end", trip.id, 5100 + index * 100, key)),
        ),
      ),
    );
    overlapped();
    oneWinner(results);
    const winner = results.findIndex((result) => result.success);
    const row = await prisma.vehicleTrip.findUniqueOrThrow({
      where: { id: trip.id },
      include: { status: true, vehicle: { include: { status: true } } },
    });
    expect(row).toMatchObject({
      startOdometer: 5000,
      startPhotoUrl: trip.startPhotoUrl,
      endOdometer: 5100 + winner * 100,
      kmDriven: 100 + winner * 100,
      status: { code: "COMPLETADO" },
      vehicle: { status: { code: "AVAILABLE" } },
    });
    const receipts = await prisma.actionIdempotency.findMany({
      where: { key: { in: keys } },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      key: keys[winner],
      action: "endVehicleTrip",
      targetId: trip.id,
      actorId: world.root.id,
      requestTargetId: trip.id,
    });
  });

  it("close versus cancel resolves once without mixing terminal evidence", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const trip = await openTrip(v.id);
    const overlapped = overlapRead("vehicleTrip", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () => endVehicleTrip(tripForm("end", trip.id, 5100))),
      as(world.root.id, () =>
        cancelVehicleTrip(trip.id, "Dispatch recalled trip"),
      ),
    ]);
    overlapped();
    oneWinner(results);
    const row = await prisma.vehicleTrip.findUniqueOrThrow({
      where: { id: trip.id },
      include: { status: true },
    });
    expect(row.startPhotoUrl).toBe(trip.startPhotoUrl);
    expect(row.active).toBe(true);
    if (results[0]?.success) {
      expect(row).toMatchObject({
        status: { code: "COMPLETADO" },
        endOdometer: 5100,
        cancellationReason: null,
        cancelledAt: null,
      });
    } else {
      expect(row).toMatchObject({
        status: { code: "CANCELADO" },
        endOdometer: null,
        endPhotoUrl: null,
        endedAt: null,
        kmDriven: null,
        cancellationReason: "Dispatch recalled trip",
      });
      expect(row.cancelledAt).toBeInstanceOf(Date);
    }
    expect(
      await prisma.vehicle.findUniqueOrThrow({
        where: { id: v.id },
        include: { status: true },
      }),
    ).toMatchObject({ status: { code: "AVAILABLE" } });
  });

  it("start versus vehicle deletion never leaves an open child under an inactive parent", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const overlapped = overlapRead("vehicle", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () => startVehicleTrip(tripForm("start", v.id, 5000))),
      as(world.root.id, async () => {
        try {
          return await deleteVehicle(v.id);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "NEXT_REDIRECT:/admin/vehicles"
          )
            return { success: true as const };
          throw error;
        }
      }),
    ]);
    overlapped();
    oneWinner(results);
    const row = await prisma.vehicle.findUniqueOrThrow({
      where: { id: v.id },
      include: {
        trips: { where: { active: true, status: { code: "EN_CURSO" } } },
      },
    });
    expect(row.trips).toHaveLength(row.active ? 1 : 0);
  });

  it("odometer correction preserves cancelled evidence and starts a new physical epoch", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const trip = await openTrip(v.id);
    expect(
      await as(world.root.id, () =>
        correctVehicleOdometer(v.id, 100, "Replacement odometer"),
      ),
    ).toMatchObject({ success: false });
    expect(
      await as(world.root.id, () =>
        cancelVehicleTrip(trip.id, "Vehicle returned"),
      ),
    ).toMatchObject({ success: true });
    const before = await prisma.vehicleTrip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    const staleCapture = new Date(Date.now() - 60_000).toISOString();
    const corrected = await as(world.root.id, () =>
      correctVehicleOdometer(v.id, 100, "Replacement odometer"),
    );
    expect(corrected).toMatchObject({ success: true });
    expect(
      await prisma.vehicleTrip.findUniqueOrThrow({ where: { id: trip.id } }),
    ).toEqual(before);
    const stale = tripForm("start", v.id, 100);
    stale.set("capturedAt", staleCapture);
    expect(
      await as(world.root.id, () => startVehicleTrip(stale)),
    ).toMatchObject({ success: false });
    const next = await openTrip(v.id, 100);
    expect(next.startOdometer).toBe(100);
    const audit = await prisma.businessCorrection.findMany({
      where: { entityId: v.id, entityType: "Vehicle" },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      actorId: world.root.id,
      reason: "Replacement odometer",
      after: { odometerBaseline: 100 },
    });
  });

  it("start versus odometer correction cannot invalidate an open trip's epoch", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const form = tripForm("start", v.id, 5000);
    // Guarantee this evidence predates either transaction without fake timers.
    form.set("capturedAt", new Date(Date.now() - 60_000).toISOString());
    const overlapped = overlapRead("vehicle", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () => startVehicleTrip(form)),
      as(world.root.id, () =>
        correctVehicleOdometer(v.id, 100, "Replacement before departure"),
      ),
    ]);
    overlapped();
    oneWinner(results);
    const row = await prisma.vehicle.findUniqueOrThrow({
      where: { id: v.id },
      include: { trips: true },
    });
    expect(row.trips).toHaveLength(results[0]?.success ? 1 : 0);
    expect(row.odometerBaseline).toBe(results[0]?.success ? null : 100);
    expect(
      await prisma.businessCorrection.count({
        where: { entityType: "Vehicle", entityId: v.id },
      }),
    ).toBe(results[0]?.success ? 0 : 1);
  });

  it("idempotency replay is bound to actor, action and requested vehicle", async () => {
    await cancelOpenRootTrips();
    const v = await vehicle();
    const other = await vehicle();
    const key = randomUUID();
    const original = await as(world.root.id, () =>
      startVehicleTrip(tripForm("start", v.id, 5000, key)),
    );
    expect(original).toMatchObject({ success: true });
    if (!original.success) throw new Error(original.error);
    const replay = await as(world.root.id, () =>
      startVehicleTrip(tripForm("start", v.id, 5000, key)),
    );
    expect(replay).toMatchObject({
      success: true,
      data: { id: original.data.id },
    });
    expect(
      await as(world.opsAll.id, () =>
        startVehicleTrip(tripForm("start", v.id, 5000, key)),
      ),
    ).toMatchObject({ success: false });
    expect(
      await as(world.root.id, () =>
        startVehicleTrip(tripForm("start", other.id, 5000, key)),
      ),
    ).toMatchObject({ success: false });
    expect(
      await as(world.root.id, () =>
        endVehicleTrip(tripForm("end", original.data.id, 5100, key)),
      ),
    ).toMatchObject({ success: false });
    expect(
      await prisma.vehicleTrip.count({ where: { vehicleId: other.id } }),
    ).toBe(0);
    expect(
      await prisma.actionIdempotency.findUniqueOrThrow({ where: { key } }),
    ).toMatchObject({
      actorId: world.root.id,
      requestTargetId: v.id,
      action: "startVehicleTrip",
      targetId: original.data.id,
    });
  });
});

async function vacationAccount(days: number) {
  const year = Number(mxDateString(new Date()).slice(0, 4));
  const user = await prisma.user.create({
    data: {
      name: "Invariant employee",
      email: `inv-${randomUUID()}@test.local`,
      password: "unused-test-hash",
      userStatusId: (
        await prisma.userStatus.findUniqueOrThrow({ where: { code: "ACTIVO" } })
      ).id,
      hireDate: mxDayRange(`${year - 1}-01-01`).gte,
    },
  });
  const period = await prisma.vacationPeriod.create({
    data: {
      userId: user.id,
      periodNumber: 1,
      cycleYear: year,
      availableFrom: mxDayRange(`${year}-01-01`).gte,
      accrualStart: mxDayRange(`${year}-01-01`).gte,
      accrualEnd: mxDayRange(`${year}-12-31`).lte,
      graceEnd: mxDayRange(`${year + 1}-12-31`).lte,
      ruleDays: days,
    },
  });
  return { user, period };
}

async function chargeableDays(count: number, startOffset = 1) {
  const rules = await prisma.holiday.findMany({ where: { active: true } });
  const today = mxDateString(new Date());
  const result: string[] = [];
  for (
    let offset = startOffset;
    result.length < count && offset < startOffset + 90;
    offset += 1
  ) {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    const key = date.toISOString().slice(0, 10);
    if (
      date.getUTCDay() !== 0 &&
      !rules.some((rule) => holidayRuleMatchesDate(rule, key))
    )
      result.push(key);
  }
  expect(result).toHaveLength(count);
  return result;
}

function reserve(userId: string, periodId: string, day: string) {
  return as(world.root.id, () =>
    createVacation({
      userId,
      periodId,
      startDate: new Date(`${day}T00:00:00Z`),
      endDate: new Date(`${day}T00:00:00Z`),
      reason: "Integration reservation",
    }),
  );
}

describe("vacation accrual catalog invariant", () => {
  it("concurrent accrual rules with distinct starts and overlapping ranges cannot both commit", async () => {
    const seed = await prisma.vacationAccrualRule.findUniqueOrThrow({
      where: { minYears: 26 },
    });
    expect(seed).toMatchObject({ active: true, maxYears: null });
    const starts = [27, 29];
    // Soft deletion does not release the unique start-year constraint.
    expect(
      await prisma.vacationAccrualRule.count({
        where: { minYears: { in: starts } },
      }),
    ).toBe(0);
    const otherRules = await prisma.vacationAccrualRule.findMany({
      where: { id: { not: seed.id } },
      orderBy: { id: "asc" },
    });
    try {
      await prisma.vacationAccrualRule.update({
        where: { id: seed.id },
        data: { active: false },
      });
      const overlapped = overlapRead("vacationAccrualRule", "findMany");
      const attempts = await Promise.allSettled([
        as(world.root.id, () =>
          createAccrualRule({ minYears: 27, maxYears: 30, days: 32 }),
        ),
        as(world.root.id, () =>
          createAccrualRule({ minYears: 29, maxYears: 35, days: 34 }),
        ),
      ]);
      overlapped();
      // An overlap is an operator-facing rejection, not a SQL exception.
      expect(attempts.map((attempt) => attempt.status)).toEqual([
        "fulfilled",
        "fulfilled",
      ]);
      const results = attempts.flatMap((attempt) =>
        attempt.status === "fulfilled" ? [attempt.value] : [],
      );
      oneWinner(results);
      const loser = results.find((result) => !result.success);
      expect(loser).toMatchObject({
        success: false,
        error: expect.stringContaining("traslapa"),
      });
      const created = await prisma.vacationAccrualRule.findMany({
        where: { minYears: { in: starts }, active: true },
      });
      expect(created).toHaveLength(1);
      const winner = results.find((result) => result.success);
      expect(winner).toMatchObject({ success: true, data: created[0] });
      expect(created[0]?.createdById).toBe(world.root.id);
    } finally {
      // Fixture cleanup only: preserve all existing tiers and grant snapshots.
      try {
        await prisma.vacationAccrualRule.updateMany({
          where: { minYears: { in: starts } },
          data: { active: false },
        });
      } finally {
        await prisma.vacationAccrualRule.update({
          where: { id: seed.id },
          data: { active: seed.active },
        });
      }
    }
    expect(
      await prisma.vacationAccrualRule.findMany({
        where: { id: { in: otherRules.map((rule) => rule.id) } },
        orderBy: { id: "asc" },
      }),
    ).toEqual(otherRules);
  });
});

describe("vacation ledger invariants", () => {
  it("two nonoverlapping reservations cannot both spend the last day", async () => {
    const { user, period } = await vacationAccount(1);
    const days = await chargeableDays(2);
    const overlapped = overlapRead("vacation", "aggregate");
    const results = await Promise.all(
      days.map((day) => reserve(user.id, period.id, day)),
    );
    overlapped();
    oneWinner(results);
    expect(await getPeriodBalance(period.id)).toEqual({
      allottedDays: 1,
      usedDays: 1,
      remainingDays: 0,
    });
    const rows = await prisma.vacation.findMany({
      where: { periodId: period.id, active: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.chargedDates).toEqual([
      days[results.findIndex((result) => result.success)],
    ]);
  });

  it("approve versus reject has one decision and derives the corresponding balance", async () => {
    const { user, period } = await vacationAccount(1);
    const [day] = await chargeableDays(1);
    const request = await reserve(user.id, period.id, day as string);
    expect(request).toMatchObject({ success: true });
    if (!request.success) throw new Error(request.error);
    const overlapped = overlapRead("vacation", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () => approveVacation(request.data.id)),
      as(world.vacAdmin.id, () => rejectVacation(request.data.id)),
    ]);
    overlapped();
    oneWinner(results);
    const row = await prisma.vacation.findUniqueOrThrow({
      where: { id: request.data.id },
      include: { status: true },
    });
    expect(row).toMatchObject({
      status: { code: results[0]?.success ? "APROBADA" : "RECHAZADA" },
      approvedById: results[0]?.success ? world.root.id : world.vacAdmin.id,
      chargedDates: [day],
      businessDaysUsed: 1,
    });
    expect(row.approvedAt).toBeInstanceOf(Date);
    expect(await getPeriodBalance(period.id)).toMatchObject({
      usedDays: results[0]?.success ? 1 : 0,
      remainingDays: results[0]?.success ? 0 : 1,
    });
    const duplicate = await as(world.root.id, () => approveVacation(row.id));
    expect(duplicate).toMatchObject({ success: false });
    expect(
      await prisma.vacation.findUniqueOrThrow({
        where: { id: row.id },
        include: { status: true },
      }),
    ).toEqual(row);
  });

  it("reservation versus lowering the grant cannot overdraw the period", async () => {
    const { user, period } = await vacationAccount(1);
    const [day] = await chargeableDays(1);
    const overlapped = overlapRead("vacation", "aggregate");
    const results = await Promise.all([
      reserve(user.id, period.id, day as string),
      as(world.root.id, () => updatePeriodOverride(period.id, 0)),
    ]);
    overlapped();
    oneWinner(results);
    const balance = await getPeriodBalance(period.id);
    expect(balance.remainingDays).toBe(0);
    expect(balance.usedDays).toBe(results[0]?.success ? 1 : 0);
    expect(balance.allottedDays).toBe(balance.usedDays);
  });

  it("concurrent shortening retains consumed days, approval and original snapshot with one receipt", async () => {
    const { user, period } = await vacationAccount(20);
    const today = mxDateString(new Date());
    const future = await chargeableDays(2);
    const start = new Date(`${today}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - 7);
    const startKey = start.toISOString().slice(0, 10);
    const rules = await prisma.holiday.findMany({ where: { active: true } });
    const chargedDates: string[] = [];
    for (
      let date = new Date(start);
      date.toISOString().slice(0, 10) <= (future[1] as string);
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const key = date.toISOString().slice(0, 10);
      if (
        date.getUTCDay() !== 0 &&
        !rules.some((rule) => holidayRuleMatchesDate(rule, key))
      )
        chargedDates.push(key);
    }
    const original = await as(world.root.id, () =>
      createVacation({
        userId: user.id,
        periodId: period.id,
        startDate: new Date(`${startKey}T00:00:00Z`),
        endDate: new Date(`${future[1]}T00:00:00Z`),
        reason: "Reviewed retroactive absence",
      }),
    );
    expect(original).toMatchObject({ success: true });
    if (!original.success) throw new Error(original.error);
    expect(
      await as(world.root.id, () => approveVacation(original.data.id)),
    ).toMatchObject({ success: true });
    const before = await prisma.vacation.findUniqueOrThrow({
      where: { id: original.data.id },
    });
    expect(
      await as(world.root.id, () => deleteVacation(before.id)),
    ).toMatchObject({ success: false });
    const overlapped = overlapRead("vacation", "findUnique");
    const results = await Promise.all([
      as(world.root.id, () =>
        correctStartedVacation(
          before.id,
          new Date(`${today}T00:00:00Z`),
          "Early return",
        ),
      ),
      as(world.vacAdmin.id, () =>
        correctStartedVacation(
          before.id,
          new Date(`${today}T00:00:00Z`),
          "Reviewed early return",
        ),
      ),
    ]);
    overlapped();
    oneWinner(results);
    const retained = chargedDates.filter((day) => day <= today).length;
    const after = await prisma.vacation.findUniqueOrThrow({
      where: { id: before.id },
    });
    expect(after).toMatchObject({
      active: true,
      endDate: mxDayRange(today).lte,
      businessDaysUsed: retained,
      chargedDates: before.chargedDates,
      approvedAt: before.approvedAt,
      approvedById: before.approvedById,
      reason: before.reason,
      periodId: before.periodId,
    });
    expect(await getPeriodBalance(period.id)).toMatchObject({
      usedDays: retained,
      remainingDays: 20 - retained,
    });
    const receipts = await prisma.businessCorrection.findMany({
      where: { entityType: "Vacation", entityId: before.id },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      actorId: results[0]?.success ? world.root.id : world.vacAdmin.id,
      before: { businessDaysUsed: chargedDates.length, chargedDates },
      after: { businessDaysUsed: retained, chargedDates },
    });
  });
});

describe("incident aggregate invariant", () => {
  it("concurrent closes of one assignment with the same key converge without duplicate events or notifications", async () => {
    const incident = await prisma.incident.create({
      data: {
        title: `Invariant close replay ${randomUUID()}`,
        description: "Concurrent retries of one terminal occurrence",
        typeId: world.typeId,
        statusId: (
          await prisma.incidentStatus.findUniqueOrThrow({
            where: { code: "INICIADO" },
          })
        ).id,
        clientId: world.clientA.id,
        reportedById: world.reporterA.id,
        reporterName: "Integration reporter",
      },
    });
    const assignment = await prisma.assignment.create({
      data: {
        incidentId: incident.id,
        statusId: (
          await prisma.assignmentStatus.findUniqueOrThrow({
            where: { code: "INICIADO" },
          })
        ).id,
        odtFolio: `INV-REPLAY-${randomUUID()}`,
        startedAt: new Date(Date.now() - 60_000),
        startLatitude: 19.4,
        startLongitude: -99.1,
        assignees: { create: { userId: world.fsrA2.id } },
        attachments: {
          create: {
            filename: "evidence.jpg",
            filepath: "test://invariants/close-replay.jpg",
            mimetype: "image/jpeg",
            size: 100,
            provider: "filesystem",
          },
        },
      },
    });
    const key = randomUUID();
    const capturedAt = new Date().toISOString();
    const overlapped = overlapRead("assignment", "findUnique");
    const results = await Promise.all(
      [1, 2].map(() =>
        as(world.root.id, () => {
          const form = new FormData();
          form.set("assignmentId", assignment.id);
          form.set("latitude", "19.4");
          form.set("longitude", "-99.1");
          form.set("notes", "One completed occurrence");
          form.set("idempotencyKey", key);
          form.set("capturedAt", capturedAt);
          return closeAssignment(form);
        }),
      ),
    );
    overlapped();
    expect(results).toMatchObject([{ success: true }, { success: true }]);
    const closed = await prisma.assignment.findUniqueOrThrow({
      where: { id: assignment.id },
      include: { status: true },
    });
    expect(closed).toMatchObject({
      status: { code: "CERRADO" },
      notes: "One completed occurrence",
    });
    expect(closed.finishedAt).toBeInstanceOf(Date);
    for (const result of results) {
      expect(result).toMatchObject({
        success: true,
        data: {
          id: closed.id,
          statusId: closed.statusId,
          finishedAt: closed.finishedAt,
          endLatitude: closed.endLatitude,
          endLongitude: closed.endLongitude,
          notes: closed.notes,
        },
      });
    }
    const closedIncident = await prisma.incident.findUniqueOrThrow({
      where: { id: incident.id },
      include: { status: true },
    });
    expect(closedIncident).toMatchObject({ status: { code: "CERRADO" } });
    expect(closedIncident.resolvedAt).toBeInstanceOf(Date);
    const events = await prisma.incidentEvent.findMany({
      where: {
        incidentId: incident.id,
        eventType: "STATUS_CHANGED",
        toStatus: "CERRADO",
      },
    });
    expect(events).toHaveLength(1);
    const receipts = await prisma.actionIdempotency.findMany({
      where: { targetId: assignment.id, action: "closeAssignment" },
    });
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({
      key,
      actorId: world.root.id,
      action: "closeAssignment",
      requestTargetId: assignment.id,
      targetId: assignment.id,
    });
    const completed = await prisma.notification.findMany({
      where: { type: "assignment_completed", entityId: assignment.id },
    });
    // Assert delivery, not just uniqueness: zero notifications cannot pass.
    expect(
      completed.filter((row) => row.userId === world.fsrA2.id),
    ).toHaveLength(1);
    expect(new Set(completed.map((row) => row.userId)).size).toBe(
      completed.length,
    );
    const incidentClosed = await prisma.notification.findMany({
      where: { type: "incident_closed", entityId: String(incident.id) },
    });
    expect(incidentClosed.length).toBeGreaterThan(0);
    expect(new Set(incidentClosed.map((row) => row.userId)).size).toBe(
      incidentClosed.length,
    );
  });

  it("closing the last two siblings concurrently closes the incident once", async () => {
    const incident = await prisma.incident.create({
      data: {
        title: "Invariant siblings",
        description: "Concurrent final closures",
        typeId: world.typeId,
        statusId: (
          await prisma.incidentStatus.findUniqueOrThrow({
            where: { code: "EN_PROGRESO" },
          })
        ).id,
        clientId: world.clientA.id,
        reportedById: world.reporterA.id,
        reporterName: "Integration reporter",
      },
    });
    const status = await prisma.assignmentStatus.findUniqueOrThrow({
      where: { code: "INICIADO" },
    });
    const siblings = await Promise.all(
      [1, 2].map((index) =>
        prisma.assignment.create({
          data: {
            incidentId: incident.id,
            statusId: status.id,
            odtFolio: `INV-${index}`,
            startedAt: new Date(Date.now() - 60_000),
            startLatitude: 19.4,
            startLongitude: -99.1,
            assignees: { create: { userId: world.fsrA2.id } },
            attachments: {
              create: {
                filename: "evidence.jpg",
                filepath: `test://invariants/evidence-${index}.jpg`,
                mimetype: "image/jpeg",
                size: 100,
                provider: "filesystem",
              },
            },
          },
        }),
      ),
    );
    const overlapped = overlapRead("assignment", "findUnique");
    const results = await Promise.all(
      siblings.map((assignment) =>
        as(world.root.id, () => {
          const form = new FormData();
          form.set("assignmentId", assignment.id);
          form.set("latitude", "19.4");
          form.set("longitude", "-99.1");
          return closeAssignment(form);
        }),
      ),
    );
    overlapped();
    expect(results).toMatchObject([{ success: true }, { success: true }]);
    const row = await prisma.incident.findUniqueOrThrow({
      where: { id: incident.id },
      include: { status: true, assignments: { include: { status: true } } },
    });
    expect(row.status?.code).toBe("CERRADO");
    expect(
      row.assignments.map((assignment) => assignment.status?.code),
    ).toEqual(["CERRADO", "CERRADO"]);
    expect(row.resolvedAt).toBeInstanceOf(Date);
    expect(
      await prisma.incidentEvent.count({
        where: {
          incidentId: incident.id,
          eventType: "STATUS_CHANGED",
          toStatus: "CERRADO",
        },
      }),
    ).toBe(1);
  });
});
