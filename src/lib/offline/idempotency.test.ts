import { describe, expect, it, vi } from "vitest";
import { BusinessRuleError } from "@/lib/actions/result";
import {
  assertOfflineFreshness,
  claimIdempotencyKey,
  findReplayTargetId,
  OFFLINE_FRESHNESS_MS,
  readOfflineFields,
} from "./idempotency";

/**
 * RF-260/RF-261 server contract: freshness window + offline field parsing.
 * The window is enforced server-side (client hints are spoofable).
 */

function staleIso(): string {
  return new Date(Date.now() - OFFLINE_FRESHNESS_MS - 1000).toISOString();
}

describe("offline server contract", () => {
  it("accepts a fresh capturedAt", () => {
    const fresh = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    expect(() => assertOfflineFreshness(fresh)).not.toThrow();
  });

  it("rejects drafts older than 24h with a Spanish message", () => {
    try {
      assertOfflineFreshness(staleIso());
      expect.unreachable("stale draft must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessRuleError);
      expect((error as Error).message).toMatch(/24 horas/);
    }
  });

  it("rejects unparseable and future capturedAt values", () => {
    for (const bad of [
      "not-a-date",
      new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    ]) {
      try {
        assertOfflineFreshness(bad);
        expect.unreachable(`must reject ${bad}`);
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessRuleError);
        expect((error as Error).message).toMatch(/captura/);
      }
    }
  });

  it("reads optional offline fields, ignoring blanks", () => {
    const fd = new FormData();
    fd.append("assignmentId", "a1");
    fd.append("idempotencyKey", "  ");
    expect(readOfflineFields(fd)).toEqual({});
    fd.set("idempotencyKey", " key-1 ");
    fd.set("capturedAt", new Date().toISOString());
    const out = readOfflineFields(fd);
    expect(out.idempotencyKey).toBe("key-1");
    expect(out.capturedAt).toBeDefined();
  });

  it("leaves online callers without the new params unaffected", () => {
    const fd = new FormData();
    fd.append("assignmentId", "a1");
    expect(readOfflineFields(fd)).toEqual({});
  });
});

describe("idempotency replay binding", () => {
  const binding = {
    actorId: "fsr-1",
    action: "startVehicleTrip",
    requestTargetId: "v1",
  };

  it("returns only the matching committed target", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ ...binding, targetId: "t1" });
    const db = { actionIdempotency: { findUnique } };
    expect(await findReplayTargetId(db, "key-1", binding)).toBe("t1");
    expect(findUnique).toHaveBeenCalledWith({ where: { key: "key-1" } });
  });

  it.each([null, { ...binding, targetId: null }])(
    "returns null when no committed target exists (%j)",
    async (row) => {
      const db = {
        actionIdempotency: { findUnique: vi.fn().mockResolvedValue(row) },
      };
      expect(await findReplayTargetId(db, "key-1", binding)).toBeNull();
    },
  );

  it.each([
    { actorId: "fsr-2" },
    { action: "endVehicleTrip" },
    { requestTargetId: "v2" },
    { actorId: null },
    { requestTargetId: null },
  ])("rejects mismatched or legacy bindings (%j)", async (override) => {
    const db = {
      actionIdempotency: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...binding, targetId: "t1", ...override }),
      },
    };
    await expect(
      findReplayTargetId(db, "key-1", binding),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("validates binding even when the stored target is null", async () => {
    const db = {
      actionIdempotency: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ ...binding, actorId: "fsr-2", targetId: null }),
      },
    };
    await expect(
      findReplayTargetId(db, "key-1", binding),
    ).rejects.toBeInstanceOf(BusinessRuleError);
  });

  it("claims the full binding atomically with the resulting target", async () => {
    const create = vi.fn().mockResolvedValue({});
    await claimIdempotencyKey(
      { actionIdempotency: { create } },
      "key-1",
      binding.action,
      "t1",
      {
        actorId: binding.actorId,
        requestTargetId: binding.requestTargetId,
      },
    );
    expect(create).toHaveBeenCalledWith({
      data: { key: "key-1", targetId: "t1", ...binding },
    });
  });

  it.each([
    { code: "P2002" },
    { code: "P2034" },
    new Error("database unavailable"),
  ])(
    "propagates claim failure to roll back the caller's transaction (%j)",
    async (error) => {
      const create = vi.fn().mockRejectedValue(error);
      await expect(
        claimIdempotencyKey(
          { actionIdempotency: { create } },
          "key-1",
          binding.action,
          "t1",
          binding,
        ),
      ).rejects.toBe(error);
    },
  );
});
