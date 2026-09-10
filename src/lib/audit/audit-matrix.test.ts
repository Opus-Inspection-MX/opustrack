import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    incident: { findUnique: vi.fn(), update: vi.fn() },
    assignment: { findMany: vi.fn() },
    incidentStatus: { findUnique: vi.fn() },
    incidentEvent: { create: vi.fn(), findFirst: vi.fn() },
    // Present so an AuditLog write from an RF-219 path would be observable.
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: vi.fn(async (_name: string) => ({ id: "admin-1" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { Prisma } from "@prisma/client";
import { cancelIncident } from "@/lib/actions/incidents";
import { prisma } from "@/lib/database/prisma.singleton";
import { syncIncidentState } from "@/lib/state-machine/sync";

/**
 * Audit matrix (RF-550–554): which models carry attribution, and the
 * RF-219/RF-553 boundary — status-affecting paths emit IncidentEvent and
 * zero AuditLog rows, while scalar management edits are attributable.
 */

const ATTRIBUTION = [
  "createdById",
  "updatedById",
  "deactivatedAt",
  "deactivatedById",
];

describe("attribution matrix (RF-550)", () => {
  it("every soft-deletable model carries the 4 attribution columns, except Notification", () => {
    const models = Prisma.dmmf.datamodel.models;
    const missing: string[] = [];
    for (const model of models) {
      const fields = new Map(model.fields.map((f) => [f.name, f]));
      const softDeletable =
        fields.get("active")?.type === "Boolean" && model.name !== "AuditLog";
      if (!softDeletable) continue;
      // Spec 11 exclusion: ephemeral notifications own isRead/readAt instead.
      if (model.name === "Notification") {
        for (const column of ATTRIBUTION) {
          expect(fields.has(column)).toBe(false);
        }
        continue;
      }
      for (const column of ATTRIBUTION) {
        if (!fields.has(column)) missing.push(`${model.name}.${column}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("AuditLog itself is append-only shaped: no soft delete, closed enums", () => {
    const audit = Prisma.dmmf.datamodel.models.find(
      (m) => m.name === "AuditLog",
    );
    expect(audit).toBeDefined();
    const fields = new Map(audit?.fields.map((f) => [f.name, f]) ?? []);
    expect(fields.has("active")).toBe(false);
    for (const column of ATTRIBUTION) {
      expect(fields.has(column)).toBe(false);
    }
    expect(fields.get("entity")?.type).toBe("AuditEntity");
    expect(fields.get("action")?.type).toBe("AuditAction");
  });

  it("IncidentEvent and ActionIdempotency stay untouched (no attribution columns)", () => {
    const models = Prisma.dmmf.datamodel.models;
    for (const name of ["IncidentEvent", "ActionIdempotency"]) {
      const model = models.find((m) => m.name === name);
      expect(model).toBeDefined();
      const names = new Set(model?.fields.map((f) => f.name) ?? []);
      for (const column of ATTRIBUTION) {
        expect(names.has(column)).toBe(false);
      }
    }
  });
});

describe("RF-219 / RF-553 boundary: one log per occurrence kind", () => {
  const eventCreate = vi.mocked(prisma.incidentEvent.create);
  const auditCreate = vi.mocked(prisma.auditLog.create);

  beforeEach(() => {
    vi.clearAllMocks();
    eventCreate.mockResolvedValue({} as never);
    auditCreate.mockResolvedValue({} as never);
    vi.mocked(prisma.$transaction).mockImplementation(((
      fn: (tx: typeof prisma) => unknown,
    ) => fn(prisma)) as never);
  });

  it("cancelIncident emits CANCELLED and zero AuditLog rows", async () => {
    vi.mocked(prisma.incident.findUnique).mockResolvedValue({
      id: 1,
      status: { name: "ABIERTO" },
      resolvedAt: null,
    } as never);
    vi.mocked(prisma.incidentStatus.findUnique).mockResolvedValue({
      id: 7,
    } as never);

    const result = await cancelIncident(1, "Reporte duplicado");

    expect(result.success).toBe(true);
    expect(eventCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("syncIncidentState transition emits STATUS_CHANGED and zero AuditLog rows", async () => {
    const txEventCreate = vi.fn(async () => ({}) as never);
    const txAuditCreate = vi.fn(async () => ({}) as never);
    const tx = {
      incident: {
        findUnique: vi.fn(async () => ({
          status: { name: "ABIERTO" },
          resolvedAt: null,
        })),
        update: vi.fn(async () => ({})),
      },
      assignment: {
        findMany: vi.fn(async () => [{ status: { name: "CERRADO" } }]),
      },
      incidentStatus: {
        findUnique: vi.fn(async () => ({ id: 5 })),
      },
      incidentEvent: { create: txEventCreate, findFirst: vi.fn() },
      auditLog: { create: txAuditCreate },
    };

    const result = await syncIncidentState(1, tx as never);

    expect(result).toEqual({ before: "ABIERTO", after: "CERRADO" });
    expect(txEventCreate).toHaveBeenCalledTimes(1);
    expect(txAuditCreate).not.toHaveBeenCalled();
  });
});
