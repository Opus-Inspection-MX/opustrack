import { describe, expect, it } from "vitest";
import { BusinessRuleError } from "@/lib/actions/result";
import {
  assertOfflineFreshness,
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
