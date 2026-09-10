import { beforeEach, describe, expect, it, vi } from "vitest";

const { notifyVacationCancelled, vacationApprovers, requirePermission } =
  vi.hoisted(() => ({
    notifyVacationCancelled: vi.fn(),
    vacationApprovers: vi.fn(),
    requirePermission: vi.fn(),
  }));

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    vacation: { findUnique: vi.fn(), update: vi.fn() },
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
  vacationApprovers.mockResolvedValue(["appr-1"]);
  vi.mocked(prisma.vacation.update).mockResolvedValue({} as never);
});

describe("deleteVacation cancellation routing", () => {
  it("self-cancel notifies the approvers with the requester name", async () => {
    requirePermission.mockResolvedValue(requester("u-req"));
    vi.mocked(prisma.vacation.findUnique).mockResolvedValue({
      userId: "u-req",
      user: { name: "Ana" },
    } as never);

    const result = await deleteVacation("v1");

    expect(result.success).toBe(true);
    expect(prisma.vacation.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { active: false },
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
    } as never);

    const result = await deleteVacation("v1");

    expect(result).toEqual({
      success: false,
      error: expect.stringMatching(/propias/),
    });
    expect(prisma.vacation.update).not.toHaveBeenCalled();
    expect(notifyVacationCancelled).not.toHaveBeenCalled();
  });
});
