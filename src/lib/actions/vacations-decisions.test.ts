import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, notifyVacationApproved, notifyVacationRejected } = vi.hoisted(
  () => ({
    tx: {
      vacationStatus: { findFirst: vi.fn() },
      vacation: {
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    notifyVacationApproved: vi.fn(),
    notifyVacationRejected: vi.fn(),
  }),
);
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: tx }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (client: unknown) => unknown) => run(tx),
}));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: vi.fn(async () => ({ id: "admin-1" })),
}));
vi.mock("@/lib/notifications", () => ({
  notifyVacationApproved,
  notifyVacationRejected,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { approveVacation, rejectVacation } from "./vacations";

beforeEach(() => {
  vi.clearAllMocks();
  tx.vacationStatus.findFirst.mockResolvedValue({ id: 2 });
  tx.vacation.findUnique.mockResolvedValue({
    active: true,
    userId: "employee",
    status: { code: "PENDIENTE" },
  });
  tx.vacation.updateMany.mockResolvedValue({ count: 1 });
  tx.vacation.findUniqueOrThrow.mockResolvedValue({
    id: "vacation",
    userId: "employee",
  });
});

describe("vacation decision concurrency boundary", () => {
  it.each([approveVacation, rejectVacation])(
    "conditionally decides once and stamps the actor",
    async (decide) => {
      expect((await decide("vacation")).success).toBe(true);
      expect(tx.vacation.updateMany).toHaveBeenCalledWith({
        where: { id: "vacation", active: true, status: { code: "PENDIENTE" } },
        data: expect.objectContaining({
          approvedById: "admin-1",
          updatedById: "admin-1",
          approvedAt: expect.any(Date),
        }),
      });
    },
  );

  it("returns a business rule to the conditional loser and sends no notification", async () => {
    tx.vacation.updateMany.mockResolvedValue({ count: 0 });
    expect(await approveVacation("vacation")).toMatchObject({
      success: false,
      error: expect.stringMatching(/otro usuario/),
    });
    expect(notifyVacationApproved).not.toHaveBeenCalled();
    expect(tx.vacation.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it.each([
    { active: false, status: { code: "PENDIENTE" } },
    { active: true, status: { code: "RECHAZADA" } },
    { active: true, status: { code: "APROBADA" } },
  ])("rejects stale requests before writing", async (row) => {
    tx.vacation.findUnique.mockResolvedValue(row);
    expect((await approveVacation("vacation")).success).toBe(false);
    expect(tx.vacation.updateMany).not.toHaveBeenCalled();
  });
});
