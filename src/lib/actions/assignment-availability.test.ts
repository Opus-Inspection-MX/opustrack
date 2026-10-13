import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, permission } = vi.hoisted(() => ({
  db: {
    incident: { findFirst: vi.fn() },
    assignment: { findFirst: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    userClientAssignment: { findMany: vi.fn() },
    holiday: { findMany: vi.fn() },
    vacation: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  permission: vi.fn(),
}));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: db }));
vi.mock("@/lib/auth/auth", () => ({ requirePermission: permission }));

import { getAssignmentFsrAvailability } from "./assignment-availability";

const request = { incidentId: 12, scheduledDate: "2026-10-13" };
beforeEach(() => {
  vi.resetAllMocks();
  permission.mockResolvedValue({
    id: "operator",
    isSuperuser: false,
    permissions: new Set(["assignments:manage-all"]),
  });
  db.$transaction.mockImplementation(async (run) => run(db));
  db.incident.findFirst.mockResolvedValue({ id: 12, clientId: "c1" });
  db.assignment.findFirst.mockResolvedValue({
    id: "a1",
    incidentId: 12,
    incident: { clientId: "c1" },
    assignees: [],
  });
  db.userClientAssignment.findMany.mockResolvedValue([{ clientId: "c1" }]);
  db.user.count.mockResolvedValue(1);
  db.user.findMany.mockResolvedValue([
    { id: "f1", name: "Ana" },
    { id: "f2", name: "Bea" },
  ]);
  db.holiday.findMany.mockResolvedValue([]);
  db.vacation.findMany.mockResolvedValue([]);
});

describe("assignment availability scope and privacy", () => {
  it("requires manage-all before any lookup", async () => {
    permission.mockRejectedValue(new Error("Forbidden"));
    await expect(getAssignmentFsrAvailability(request)).rejects.toThrow(
      "Forbidden",
    );
    expect(permission).toHaveBeenCalledWith("assignments:manage-all");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([
    "missing incident",
    "outside scope",
    "inactive assignment",
    "mismatched assignment",
  ])("fails closed for %s before querying absences", async (scenario) => {
    if (scenario === "missing incident")
      db.incident.findFirst.mockResolvedValue(null);
    if (scenario === "outside scope")
      db.userClientAssignment.findMany.mockResolvedValue([]);
    if (scenario === "inactive assignment")
      db.assignment.findFirst.mockResolvedValue(null);
    if (scenario === "mismatched assignment")
      db.assignment.findFirst.mockResolvedValue({
        incidentId: 99,
        incident: { clientId: "c1" },
        assignees: [],
      });
    expect(
      (await getAssignmentFsrAvailability({ ...request, assignmentId: "a1" }))
        .success,
    ).toBe(false);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.vacation.findMany).not.toHaveBeenCalled();
    expect(db.incident.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 12, active: true } }),
    );
  });
  it.each(["2026-02-30", "2026-13-01", "2026-1-01", "2026-10-13T00:00:00Z"])(
    "rejects invalid civil date %s",
    async (scheduledDate) => {
      expect(
        (await getAssignmentFsrAvailability({ ...request, scheduledDate }))
          .success,
      ).toBe(false);
      expect(db.$transaction).not.toHaveBeenCalled();
    },
  );
  it("rejects arbitrary candidate ids instead of trusting them", async () => {
    expect(
      (
        await getAssignmentFsrAvailability({
          ...request,
          userIds: ["outsider"],
        } as typeof request)
      ).success,
    ).toBe(false);
  });
  it("defers null dates without inventing today or reading absences", async () => {
    const result = await getAssignmentFsrAvailability({
      ...request,
      scheduledDate: null,
    });
    expect(result).toMatchObject({
      success: true,
      date: null,
      fsrs: [
        { userId: "f1", unavailable: false, reason: null },
        { userId: "f2", unavailable: false, reason: null },
      ],
    });
    expect(db.holiday.findMany).not.toHaveBeenCalled();
    expect(db.vacation.findMany).not.toHaveBeenCalled();
  });
  it("returns approved absence existence only, without private text or absence identifiers", async () => {
    db.vacation.findMany.mockResolvedValue([
      {
        userId: "f1",
        id: "private-id",
        reason: "medical private reason",
        approvedById: "private-approver",
      },
    ]);
    const result = await getAssignmentFsrAvailability(request);
    expect(result).toEqual({
      success: true,
      date: request.scheduledDate,
      fsrs: [
        {
          userId: "f1",
          name: "Ana",
          unavailable: true,
          reason: "APPROVED_ABSENCE",
        },
        { userId: "f2", name: "Bea", unavailable: false, reason: null },
      ],
    });
    expect(db.vacation.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        userId: { in: ["f1", "f2"] },
        status: { code: "APROBADA" },
        startDate: { lte: new Date("2026-10-14T05:59:59.999Z") },
        endDate: { gte: new Date("2026-10-13T06:00:00Z") },
      },
      select: { userId: true },
    });
    expect(JSON.stringify(result)).not.toMatch(/private|medical|approvedById/);
    expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({
      active: true,
      userRoles: expect.any(Object),
    });
  });
  it("pending and rejected requests are excluded by the approved-only query", async () => {
    const result = await getAssignmentFsrAvailability(request);
    expect(db.vacation.findMany.mock.calls[0][0].where.status).toEqual({
      code: "APROBADA",
    });
    expect(result).toMatchObject({
      fsrs: [{ unavailable: false }, { unavailable: false }],
    });
  });
  it("uses holiday policy for every candidate without querying private absences", async () => {
    db.holiday.findMany.mockResolvedValue([
      {
        active: true,
        month: 10,
        day: 13,
        nthMonday: null,
        isRecurring: true,
        year: null,
      },
    ]);
    expect(await getAssignmentFsrAvailability(request)).toMatchObject({
      fsrs: [
        { unavailable: true, reason: "HOLIDAY" },
        { unavailable: true, reason: "HOLIDAY" },
      ],
    });
    expect(db.vacation.findMany).not.toHaveBeenCalled();
  });
});
