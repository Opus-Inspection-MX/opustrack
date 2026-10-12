import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { notifyVacationCancelled, vacationApprovers, requirePermission } =
  vi.hoisted(() => ({
    notifyVacationCancelled: vi.fn(),
    vacationApprovers: vi.fn(),
    requirePermission: vi.fn(),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    vacation: { findUnique: vi.fn(), updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/auth/auth", () => ({ requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/notifications", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  notifyVacationCancelled,
}));
vi.mock("@/lib/notifications/audiences", () => ({ vacationApprovers }));

import { prisma } from "@/lib/database/prisma.singleton";

vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) => run(prisma),
}));

import { deleteVacation } from "./vacations";

/**
 * Cancellation routing: the requester cancelling their own request alerts
 * the approvers (they own the queue); an admin cancelling someone else's
 * alerts the requester.
 */

const requester = (id: string) => ({
  id,
  isSuperuser: false,
  permissions: new Set<string>(),
});
const admin = () => ({
  id: "admin-1",
  isSuperuser: false,
  permissions: new Set(["vacations:manage"]),
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  vacationApprovers.mockResolvedValue(["appr-1"]);
  vi.mocked(prisma.vacation.updateMany).mockResolvedValue({ count: 1 });
});
afterEach(() => vi.useRealTimers());

describe("deleteVacation cancellation routing", () => {
  it("self-cancel notifies the approvers with the requester name", async () => {
    requirePermission.mockResolvedValue(requester("u-req"));
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      userId: "u-req",
      user: { name: "Ana" },
      status: { code: "PENDIENTE" },
      statusId: 1,
    } as never);

    const result = await deleteVacation("v1");

    expect(result.success).toBe(true);
    expect(prisma.vacation.updateMany).toHaveBeenCalledWith({
      where: { id: "v1", active: true, statusId: 1 },
      data: expect.objectContaining({
        active: false,
        updatedById: "u-req",
        deactivatedById: "u-req",
        deactivatedAt: expect.any(Date),
      }),
    });
    expect(vacationApprovers).toHaveBeenCalled();
    expect(notifyVacationCancelled).toHaveBeenCalledWith(
      "v1",
      "Ana",
      ["appr-1"],
      "u-req",
    );
  });

  it("admin-cancel notifies the requester (without approver copy)", async () => {
    requirePermission.mockResolvedValue(admin());
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      userId: "u-req",
      user: { name: "Ana" },
      status: { code: "PENDIENTE" },
      statusId: 1,
    } as never);

    const result = await deleteVacation("v1");

    expect(result.success).toBe(true);
    expect(vacationApprovers).not.toHaveBeenCalled();
    expect(notifyVacationCancelled).toHaveBeenCalledWith(
      "v1",
      null,
      ["u-req"],
      "admin-1",
    );
  });

  it("a non-admin cannot cancel someone else's request", async () => {
    requirePermission.mockResolvedValue(requester("u-other"));
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      userId: "u-req",
      user: { name: "Ana" },
      status: { code: "PENDIENTE" },
      statusId: 1,
    } as never);

    const result = await deleteVacation("v1");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/propias/),
    });
    expect(prisma.vacation.updateMany).not.toHaveBeenCalled();
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });

  it("releases an approved reservation only before its CDMX start day", async () => {
    requirePermission.mockResolvedValue(admin());
    const row = {
      userId: "u-req",
      user: { name: "Ana" },
      statusId: 2,
      status: { code: "APROBADA" },
      startDate: new Date("2026-06-02T06:00:00Z"),
    };
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue(row as never);
    expect((await deleteVacation("v1")).success).toBe(true);
    vi.clearAllMocks();
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      ...row,
      startDate: new Date("2026-06-01T06:00:00Z"),
    } as never);
    expect(await deleteVacation("v1")).toMatchObject({
      success: false,
      error: expect.stringMatching(/corrección/),
    });
    expect(prisma.vacation.updateMany).not.toHaveBeenCalled();
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });

  it("reports a conditional cancellation loser without notifying", async () => {
    requirePermission.mockResolvedValue(admin());
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      userId: "u-req",
      user: { name: "Ana" },
      statusId: 1,
      status: { code: "PENDIENTE" },
    } as never);
    vi.mocked(prisma.vacation.updateMany).mockResolvedValue({ count: 0 });
    expect((await deleteVacation("v1")).success).toBe(false);
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });
});
