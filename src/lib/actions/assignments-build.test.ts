import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, available, gate, permission } = vi.hoisted(() => ({
  db: {
    incident: { findUnique: vi.fn() },
    assignment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn(), findUnique: vi.fn() },
    assignmentStatus: { findUnique: vi.fn() },
    assignmentAssignee: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    assignmentAttachment: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
  available: vi.fn(),
  gate: vi.fn(),
  permission: vi.fn(),
}));
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: db }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: permission,
  requireAuth: async () => ({ id: "admin" }),
}));
vi.mock("@/lib/auth/access", () => ({
  loadAssignmentFor: gate,
  loadIncidentFor: gate,
}));
vi.mock("@/lib/utils/availability", () => ({ isFsrUnavailable: available }));
vi.mock("@/lib/state-machine/sync", () => ({ syncIncidentState: vi.fn() }));
vi.mock("@/lib/notifications/notify-events", () => ({
  notifyAssignmentAssigned: vi.fn(),
  notifyIncidentAssigned: vi.fn(),
  notifyAssignmentUpdated: vi.fn(),
  notifyAssignmentReopened: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { ensureFsrsAssignedToIncident } from "@/lib/assignments/ensure-fsrs";
import {
  createAssignment,
  deleteAssignmentAttachment,
  reopenAssignment,
  updateAssignment,
  updateAssignmentOdtFolio,
  updateAssignmentStatus,
} from "./assignments";
import { BusinessRuleError } from "./result";

const date = new Date("2026-10-13T15:00:00Z");
const nextDate = new Date("2026-10-14T15:00:00Z");
const fsr = "ckabc123def456ghi789jkl01";
const removed = "ckxyz987uvw654rst321opq02";

beforeEach(() => {
  vi.resetAllMocks();
  permission.mockResolvedValue({ id: "admin", isSuperuser: true });
  gate.mockResolvedValue({ incidentId: 1 });
  db.$transaction.mockImplementation(async (fn) => fn(db));
  db.incident.findUnique.mockResolvedValue({ status: { code: "ABIERTO" } });
  db.assignment.findUnique.mockResolvedValue({
    incidentId: 1,
    scheduledDate: date,
    status: { code: "ASIGNADO" },
  });
  db.assignment.findFirst.mockResolvedValue({
    id: "a1",
    scheduledDate: date,
    status: { code: "VISTO" },
  });
  db.assignmentAssignee.findMany.mockResolvedValue([{ userId: removed }]);
  db.user.findMany.mockImplementation(async ({ where }) =>
    where.id.in.map((id: string) => ({ id })),
  );
  db.assignmentStatus.findUnique.mockResolvedValue({
    id: 2,
    code: "EN_PROGRESO",
  });
  db.assignment.update.mockResolvedValue({
    id: "a1",
    incidentId: 1,
    assignees: [],
  });
  db.assignmentAttachment.findUnique.mockResolvedValue({
    assignmentId: "a1",
    assignment: { incidentId: 1 },
  });
  available.mockResolvedValue(false);
});

describe("assignment mutation invariants", () => {
  it.each(["folio", "attachment delete"])(
    "rejects %s on a cancelled parent inside the transaction",
    async (flow) => {
      db.incident.findUnique.mockResolvedValue({
        status: { code: "CANCELADA" },
      });
      const result =
        flow === "folio"
          ? await updateAssignmentOdtFolio("a1", "ODT-1")
          : await deleteAssignmentAttachment("file1");
      expect(result.success).toBe(false);
      expect(gate).toHaveBeenCalledWith(
        expect.objectContaining({ id: "admin" }),
        "a1",
        "worker",
        db,
      );
      expect(db.assignment.update).not.toHaveBeenCalled();
      expect(db.assignmentAttachment.update).not.toHaveBeenCalled();
    },
  );
  it.each(["create", "edit", "reopen", "generic status"])(
    "rejects %s on a cancelled parent before writing",
    async (flow) => {
      db.incident.findUnique.mockResolvedValue({
        status: { code: "CANCELADA", name: "Renamed" },
      });
      db.assignment.findUnique.mockResolvedValue({
        incidentId: 1,
        status: { code: "CERRADO" },
      });
      const result =
        flow === "create"
          ? await createAssignment({ incidentId: 1, assigneeIds: [fsr] })
          : flow === "edit"
            ? await updateAssignment("a1", {
                incidentId: 1,
                assigneeIds: [fsr],
              })
            : flow === "reopen"
              ? await reopenAssignment("a1")
              : await updateAssignmentStatus("a1", 2);
      expect(result).toMatchObject({
        success: false,
        error: expect.stringMatching(/cancelada/),
      });
      expect(db.assignment.create).not.toHaveBeenCalled();
      expect(db.assignment.update).not.toHaveBeenCalled();
      expect(db.assignmentAssignee.upsert).not.toHaveBeenCalled();
    },
  );

  it("checks the final assignee set when moving dates, not removed FSRs", async () => {
    available.mockImplementation(async (id) => id === removed);
    const result = await updateAssignment("a1", {
      incidentId: 1,
      assigneeIds: [fsr],
      scheduledDate: nextDate,
    });
    expect(result.success).toBe(true);
    expect(available).toHaveBeenCalledWith(fsr, nextDate, db);
    expect(available).not.toHaveBeenCalledWith(removed, nextDate, db);
    expect(db.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seenAt: null,
          seenById: null,
          assignedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("rejects an unavailable retained FSR when the scheduled date moves", async () => {
    db.assignmentAssignee.findMany.mockResolvedValue([{ userId: fsr }]);
    available.mockResolvedValue(true);
    expect(
      (
        await updateAssignment("a1", {
          incidentId: 1,
          assigneeIds: [fsr],
          scheduledDate: nextDate,
        })
      ).success,
    ).toBe(false);
    expect(db.assignment.update).not.toHaveBeenCalled();
  });

  it("requires reopen permission for the generic closed-to-progress edge", async () => {
    db.assignment.findUnique.mockResolvedValue({
      incidentId: 1,
      status: { code: "CERRADO" },
    });
    permission.mockImplementation(async (name) => {
      if (name === "assignments:reopen")
        throw new BusinessRuleError("Sin permiso para reabrir.");
      return { id: "admin", isSuperuser: true };
    });
    expect(await updateAssignmentStatus("a1", 2)).toMatchObject({
      success: false,
      error: "Sin permiso para reabrir.",
    });
    expect(db.assignment.update).not.toHaveBeenCalled();
  });

  it("dedicated reopening permits a closed parent", async () => {
    db.incident.findUnique.mockResolvedValue({ status: { code: "CERRADO" } });
    db.assignment.findUnique.mockResolvedValue({
      incidentId: 1,
      status: { code: "CERRADO" },
    });
    expect((await reopenAssignment("a1")).success).toBe(true);
    expect(db.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statusId: 2, finishedAt: null } }),
    );
  });
});

describe("ensureFsrsAssignedToIncident", () => {
  it.each(["CERRADO", "CANCELADA"])("refuses the %s parent", async (code) => {
    db.incident.findUnique.mockResolvedValue({ status: { code } });
    await expect(ensureFsrsAssignedToIncident(1, [fsr])).rejects.toThrow(
      BusinessRuleError,
    );
    expect(db.assignmentAssignee.upsert).not.toHaveBeenCalled();
  });
  it("checks existing scheduled availability before additions", async () => {
    available.mockResolvedValue(true);
    await expect(ensureFsrsAssignedToIncident(1, [fsr])).rejects.toThrow(
      /disponibles/,
    );
    expect(available).toHaveBeenCalledWith(fsr, date, db);
    expect(db.assignmentAssignee.upsert).not.toHaveBeenCalled();
  });
  it("resets acknowledgment even when the assignment is already VISTO", async () => {
    await ensureFsrsAssignedToIncident(1, [fsr, fsr]);
    expect(db.assignmentAssignee.upsert).toHaveBeenCalledTimes(1);
    expect(db.assignment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          assignedAt: expect.any(Date),
          seenAt: null,
          seenById: null,
        }),
      }),
    );
  });
});
