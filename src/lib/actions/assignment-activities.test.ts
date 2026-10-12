import { beforeEach, expect, it, vi } from "vitest";

const { db, unavailable, gate } = vi.hoisted(() => ({
  db: {
    assignmentActivity: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    assignmentAssignee: { findMany: vi.fn() },
    assignment: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  unavailable: vi.fn(),
  gate: vi.fn(),
}));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: db }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: async () => ({ id: "u1" }),
}));
vi.mock("@/lib/auth/access", () => ({ loadAssignmentFor: gate }));
vi.mock("@/lib/utils/availability", () => ({ isFsrUnavailable: unavailable }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  createAssignmentActivity,
  updateAssignmentActivity,
} from "./assignment-activities";

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async (fn) => fn(db));
  db.assignmentActivity.findUnique.mockResolvedValue({ assignmentId: "a1" });
  db.assignment.findUnique.mockResolvedValue({
    incident: { status: { code: "EN_PROGRESO" } },
  });
  db.assignmentAssignee.findMany.mockResolvedValue([
    { userId: "fsr1" },
    { userId: "fsr2" },
  ]);
  unavailable.mockImplementation(async (id) => id === "fsr2");
});

it.each(["create", "edit"])(
  "%s rejects activity dates unavailable to an active assignee",
  async (flow) => {
    const performedAt = new Date("2026-10-13T15:00:00Z");
    const result =
      flow === "create"
        ? await createAssignmentActivity({
            assignmentId: "a1",
            description: "Work",
            performedAt,
          })
        : await updateAssignmentActivity("activity1", { performedAt });
    expect(result.success).toBe(false);
    expect(unavailable).toHaveBeenCalledWith("fsr2", performedAt, db);
    expect(db.assignmentActivity.create).not.toHaveBeenCalled();
    expect(db.assignmentActivity.update).not.toHaveBeenCalled();
  },
);
it("allows description-only edits without revalidating the original work date", async () => {
  expect(
    (await updateAssignmentActivity("activity1", { description: "Corrected" }))
      .success,
  ).toBe(true);
  expect(unavailable).not.toHaveBeenCalled();
  expect(gate).toHaveBeenCalledWith({ id: "u1" }, "a1", "worker", db);
});
it("refuses edits to inactive or missing activities", async () => {
  db.assignmentActivity.findUnique.mockResolvedValue(null);
  expect(
    (await updateAssignmentActivity("gone", { description: "Work" })).success,
  ).toBe(false);
  expect(db.assignmentActivity.update).not.toHaveBeenCalled();
});
