import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    auditLog: { create: vi.fn() },
  },
}));

import { AuditAction, AuditEntity } from "@prisma/client";
import { prisma } from "@/lib/database/prisma.singleton";
import {
  AUDIT_PAYLOAD_ALLOWLIST,
  logAudit,
  MAX_AUDIT_TEXT_LENGTH,
  TRUNCATED_SUFFIX,
} from "./log-audit";

describe("logAudit (RF-551 single writer)", () => {
  const create = vi.mocked(prisma.auditLog.create);

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({} as never);
  });

  it("writes actor, entity, action, and the allowlisted payload", async () => {
    await logAudit(prisma, {
      actorId: "admin-1",
      entity: AuditEntity.CLIENT,
      entityId: "c1",
      action: AuditAction.CREATE,
      payload: { code: "PLZ-01", stateId: 14, active: true },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      actorId: string;
      entity: string;
      entityId: string;
      action: string;
      payload: Record<string, unknown>;
    };
    expect(data.actorId).toBe("admin-1");
    expect(data.entity).toBe("CLIENT");
    expect(data.entityId).toBe("c1");
    expect(data.action).toBe("CREATE");
    expect(data.payload).toEqual({ code: "PLZ-01", stateId: 14, active: true });
  });

  it("accepts an explicit null actor (system write), never a silent default", async () => {
    await logAudit(prisma, {
      actorId: null,
      entity: AuditEntity.INCIDENT,
      entityId: "1",
      action: AuditAction.UPDATE,
      payload: { statusId: 3 },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      actorId: string | null;
    };
    expect(data.actorId).toBeNull();
  });

  it("throws on an omitted actorId: RF-550 rejects implicit actors", async () => {
    await expect(
      logAudit(prisma, {
        actorId: undefined as unknown as null,
        entity: AuditEntity.CLIENT,
        entityId: "c1",
        action: AuditAction.CREATE,
      }),
    ).rejects.toThrow(/explicit actorId/);
    expect(create).not.toHaveBeenCalled();
  });

  it("drops payload keys outside the entity allowlist", async () => {
    await logAudit(prisma, {
      actorId: "admin-1",
      entity: AuditEntity.CLIENT,
      entityId: "c1",
      action: AuditAction.UPDATE,
      payload: { code: "PLZ-01", name: "DROP ME", email: "a@b.c" },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      payload: Record<string, unknown>;
    };
    expect(data.payload).toEqual({ code: "PLZ-01" });
  });

  it("redacts nested sensitive leaves and truncates long strings (RF-553)", async () => {
    await logAudit(prisma, {
      actorId: "admin-1",
      entity: AuditEntity.SCHEDULE,
      entityId: "s1",
      action: AuditAction.UPDATE,
      payload: {
        statusId: 2,
        reason: {
          note: "ok",
          email: "tech@example.com",
          detail: "d".repeat(MAX_AUDIT_TEXT_LENGTH + 10),
        },
      },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      payload: { reason: { note: string; email: string; detail: string } };
    };
    expect(data.payload.reason.note).toBe("ok");
    expect(data.payload.reason.email).toBe("[REDACTED]");
    expect(data.payload.reason.detail.endsWith(TRUNCATED_SUFFIX)).toBe(true);
  });

  it("caps top-level strings at 4096 with the truncation marker (RF-553)", async () => {
    await logAudit(prisma, {
      actorId: "admin-1",
      entity: AuditEntity.INCIDENT,
      entityId: "1",
      action: AuditAction.UPDATE,
      payload: { reason: "r".repeat(5000) },
    });

    const data = create.mock.calls[0]?.[0]?.data as unknown as {
      payload: { reason: string };
    };
    expect(data.payload.reason).toHaveLength(
      MAX_AUDIT_TEXT_LENGTH + TRUNCATED_SUFFIX.length,
    );
    expect(data.payload.reason.endsWith(TRUNCATED_SUFFIX)).toBe(true);
    expect(data.payload.reason.startsWith("r".repeat(100))).toBe(true);
  });

  it("rejects entities and actions outside the closed vocabulary (RF-552)", async () => {
    await expect(
      logAudit(prisma, {
        actorId: "admin-1",
        entity: "STATUS" as unknown as AuditEntity,
        entityId: "1",
        action: AuditAction.UPDATE,
      }),
    ).rejects.toThrow(/unknown entity/);
    await expect(
      logAudit(prisma, {
        actorId: "admin-1",
        entity: AuditEntity.INCIDENT,
        entityId: "1",
        action: "DELETE" as unknown as AuditAction,
      }),
    ).rejects.toThrow(/unknown action/);
    expect(create).not.toHaveBeenCalled();
  });

  it("writes through the caller's transaction client, never a global (RF-551)", async () => {
    const txCreate = vi.fn(async () => ({}) as never);
    const tx = { auditLog: { create: txCreate } };

    await logAudit(tx as never, {
      actorId: "admin-1",
      entity: AuditEntity.ASSIGNMENT,
      entityId: "a1",
      action: AuditAction.ASSIGN,
      payload: { statusId: 2 },
    });

    expect(txCreate).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it("no allowlisted key trips the PII DENYLIST: allowlist hygiene by test", async () => {
    const { isSensitiveKey } = await import("@/lib/observability/redact");
    const offenders: string[] = [];
    for (const [entity, keys] of Object.entries(AUDIT_PAYLOAD_ALLOWLIST)) {
      for (const key of keys) {
        if (isSensitiveKey(key)) offenders.push(`${entity}.${key}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
