import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  ensurePeriodsUpToNow,
  getPeriodBalance,
} from "@/lib/services/vacation-periods";
import {
  importVacationWorkbook,
  stateDigest,
  vacationImportState,
} from "../../../scripts/import-vacation-workbook";

async function fixture(tx: Prisma.TransactionClient) {
  const user = await tx.user.create({
    data: {
      name: `Synthetic Workbook ${randomUUID()}`,
      email: `${randomUUID()}@test.local`,
      password: "unused",
      hireDate: new Date("2020-06-15T00:00:00Z"),
    },
  });
  await tx.vacationPeriod.create({
    data: {
      userId: user.id,
      periodNumber: 6,
      cycleYear: 2026,
      ruleDays: 30,
      accrualStart: new Date("2026-01-01T06:00:00Z"),
      accrualEnd: new Date("2027-01-01T05:59:59.999Z"),
      availableFrom: new Date("2026-06-15T06:00:00Z"),
      graceEnd: new Date("2028-01-01T05:59:59.999Z"),
    },
  });
  const book = new ExcelJS.Workbook();
  const s = book.addWorksheet("Vacaciones 2026-2027");
  s.getRow(3).values = [
    user.name,
    new Date("2020-06-15T00:00:00Z"),
    6,
    "Texto original",
    22,
    3,
    { formula: "E3-F3" },
  ];
  s.getRow(4).values = [
    "Synthetic Missing Account",
    new Date("2020-06-15T00:00:00Z"),
    6,
    null,
    22,
    1,
    21,
  ];
  return { user, bytes: Buffer.from(await book.xlsx.writeBuffer()) };
}

async function rolledBack(
  run: (tx: Prisma.TransactionClient) => Promise<void>,
) {
  const rollback = new Error("TEST_ROLLBACK");
  try {
    await prisma.$transaction(
      async (tx) => {
        await run(tx);
        throw rollback;
      },
      { timeout: 60000, isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe("workbook import against PostgreSQL", () => {
  it("simulates without writes, imports evidence and balances atomically, and replays without duplication", async () => {
    await rolledBack(async (tx) => {
      const { user, bytes } = await fixture(tx);
      const before = await tx.vacationWorkbook.count();
      const preview = await importVacationWorkbook(
        tx,
        bytes,
        "synthetic.xlsm",
        { apply: false },
      );
      expect(preview).toMatchObject({ archived: 2, approved: 1, pending: 1 });
      expect(await tx.vacationWorkbook.count()).toBe(before);
      await expect(
        importVacationWorkbook(tx, bytes, "synthetic.xlsm", {
          apply: true,
          expectedState: "stale",
        }),
      ).rejects.toThrow("TARGET_CHANGED");
      await importVacationWorkbook(tx, bytes, "synthetic.xlsm", {
        apply: true,
        expectedState: preview.stateDigest,
      });
      const period = await tx.vacationPeriod.findUniqueOrThrow({
        where: { userId_cycleYear: { userId: user.id, cycleYear: 2026 } },
      });
      expect(period).toMatchObject({
        cycleBasis: "ANNIVERSARY",
        accrualStart: new Date("2026-06-15T06:00:00Z"),
        ruleDays: 22,
      });
      expect(await getPeriodBalance(period.id, tx)).toEqual({
        allottedDays: 22,
        usedDays: 3,
        remainingDays: 19,
      });
      const generated = await ensurePeriodsUpToNow(user.id, tx);
      expect(generated.find((row) => row.id === period.id)).toMatchObject({
        cycleBasis: "ANNIVERSARY",
        ruleDays: 22,
      });
      const after = stateDigest(await vacationImportState(tx));
      expect(
        await importVacationWorkbook(tx, bytes, "synthetic.xlsm", {
          apply: true,
          expectedState: after,
        }),
      ).toMatchObject({ alreadyImported: true, changed: 0 });
      expect(
        await tx.vacationWorkbookRow.count({
          where: {
            workbookDigest: (
              await tx.vacationWorkbook.findFirstOrThrow({
                where: { filename: "synthetic.xlsm" },
              })
            ).digest,
          },
        }),
      ).toBe(2);
      expect(
        await tx.historicalVacationConsumption.count({
          where: { userId: user.id },
        }),
      ).toBe(1);
      expect(await tx.vacation.count({ where: { userId: user.id } })).toBe(0);
    });
  });
  it("blocks live dated requests before creating evidence or changing periods", async () => {
    await rolledBack(async (tx) => {
      const { user, bytes } = await fixture(tx);
      const status = await tx.vacationStatus.findFirstOrThrow({
        where: { code: "PENDIENTE" },
      });
      await tx.vacation.create({
        data: {
          userId: user.id,
          statusId: status.id,
          startDate: new Date("2026-08-01T06:00:00Z"),
          endDate: new Date("2026-08-01T06:00:00Z"),
        },
      });
      const before = await tx.vacationWorkbook.count();
      await expect(
        importVacationWorkbook(tx, bytes, "synthetic.xlsm", { apply: false }),
      ).rejects.toThrow("DATED_REQUESTS_REQUIRE_RECONCILIATION");
      expect(await tx.vacationWorkbook.count()).toBe(before);
    });
  });
});
