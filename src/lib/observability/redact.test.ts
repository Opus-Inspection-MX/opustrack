import { describe, expect, it } from "vitest";
import { isSensitiveKey, REDACTED, redact } from "./redact";

/**
 * RF-556: no log carries secrets or direct personal data.
 *
 * The fixture is deliberately adversarial — mixed case, substring keys
 * (`userEmail`), nesting, arrays — because real handler contexts nest the
 * session and the incident payload together.
 */
describe("redact · RF-556 denylist", () => {
  it("redacts secrets case-insensitively by substring", () => {
    const out = redact({
      password: "hunter2",
      sessionToken: "tok-123",
      Authorization: "Bearer abc",
      userCookie: "yum",
      apiSecret: "s3cr3t",
      beneficiaryTokenId: "tok-999",
      calm: "untouched",
    });

    expect(out).toEqual({
      password: REDACTED,
      sessionToken: REDACTED,
      Authorization: REDACTED,
      userCookie: REDACTED,
      apiSecret: REDACTED,
      beneficiaryTokenId: REDACTED,
      calm: "untouched",
    });
  });

  it("redacts PII, location, and file handles recursively", () => {
    const out = redact({
      user: { userEmail: "a@b.com", rfc: "XAXX010101", phone: "555" },
      incident: {
        description: "engine failed near the plant",
        notes: "called María",
        photoUrl: "https://blob/x.jpg",
        lat: 19.4,
        lng: -99.1,
      },
      tags: [{ contact: "Juan" }, { label: "ok" }],
      count: 3,
    });

    expect(out).toEqual({
      user: { userEmail: REDACTED, rfc: REDACTED, phone: REDACTED },
      incident: {
        description: REDACTED,
        notes: REDACTED,
        photoUrl: REDACTED,
        lat: REDACTED,
        lng: REDACTED,
      },
      tags: [{ contact: REDACTED }, { label: "ok" }],
      count: 3,
    });
  });

  it("covers the RF-556 scenario: failure context with session attached", () => {
    const out = redact({
      error: "handler blew up",
      session: { sessionToken: "tok-1", email: "fsr@x.com", userId: "u1" },
    });

    expect(out).toEqual({
      error: "handler blew up",
      session: { sessionToken: REDACTED, email: REDACTED, userId: "u1" },
    });
    expect(JSON.stringify(out)).not.toContain("tok-1");
  });

  it("does not mutate the input and survives circular refs", () => {
    const inner: Record<string, unknown> = { email: "a@b.com" };
    const input: Record<string, unknown> = { inner };
    input.self = input;

    const out = redact(input);

    expect(input.self).toBe(input);
    expect(out).toEqual({
      inner: { email: REDACTED },
      self: "[Circular]",
    });
  });

  it("passes class instances through untouched", () => {
    const err = new Error("boom");
    expect(redact({ err }).err).toBe(err);
    expect(isSensitiveKey("email")).toBe(true);
    expect(isSensitiveKey("clientId")).toBe(false);
  });
});
