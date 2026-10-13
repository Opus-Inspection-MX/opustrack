import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  findToken: vi.fn(),
  upsertToken: vi.fn(),
  consumeToken: vi.fn(),
  send: vi.fn(),
  hash: vi.fn(),
  error: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/database/serializable-transaction", () => ({
  serializableTransaction: (run: (tx: unknown) => unknown) =>
    run({
      user: { findFirst: mocks.findUser, updateMany: mocks.updateUser },
      passwordResetToken: {
        findUnique: mocks.findToken,
        upsert: mocks.upsertToken,
        updateMany: mocks.consumeToken,
      },
    }),
}));
vi.mock("@/lib/mail/transport", () => ({
  getMailTransport: () => ({ name: "smtp", send: mocks.send }),
}));
vi.mock("@/lib/security/hash", () => ({ hashPassword: mocks.hash }));
vi.mock("@/lib/observability/logger", () => ({
  logger: { error: mocks.error },
}));

import {
  requestPasswordRecovery,
  resetRecoveredPassword,
} from "./password-recovery";

const token = "a".repeat(64);
const digest = createHash("sha256").update(token).digest("hex");
const eligible = { id: "user-1", email: "user@example.com", sessionVersion: 3 };
const flush = async () => {
  await mocks.after.mock.calls[0][0]();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXTAUTH_URL", "https://opustrack.example.com");
  mocks.findUser.mockResolvedValue(eligible);
  mocks.findToken.mockResolvedValue(null);
  mocks.updateUser.mockResolvedValue({ count: 1 });
  mocks.consumeToken.mockResolvedValue({ count: 1 });
  mocks.hash.mockResolvedValue("hashed-password");
});

describe("password recovery requests", () => {
  it("returns before SMTP or account lookup, and mails only after the response", async () => {
    const result = await requestPasswordRecovery(" user@example.com ");
    expect(result).toEqual({ success: true });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
    await flush();
    const data = mocks.upsertToken.mock.calls[0][0].create;
    const message = mocks.send.mock.calls[0][0];
    const link = message.text.match(/https:\/\/\S+/)[0];
    const raw = new URL(link).hash.slice(1);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
    expect(data.tokenHash).toBe(createHash("sha256").update(raw).digest("hex"));
    expect(JSON.stringify(data)).not.toContain(raw);
    expect(data.sessionVersion).toBe(3);
    expect(data.expiresAt.getTime() - data.requestedAt.getTime()).toBe(
      30 * 60 * 1000,
    );
    expect(message.to).toEqual([eligible.email]);
    expect(mocks.findUser.mock.calls[0][0].where).toMatchObject({
      email: eligible.email,
      active: true,
      userStatus: { code: "ACTIVO" },
    });
  });

  it("returns the same response for unknown accounts and delivery failures without leaking errors", async () => {
    mocks.findUser.mockResolvedValue(null);
    expect(await requestPasswordRecovery("unknown@example.com")).toEqual({
      success: true,
    });
    await flush();
    expect(mocks.send).not.toHaveBeenCalled();
    mocks.after.mockClear();
    mocks.findUser.mockResolvedValue(eligible);
    mocks.send.mockRejectedValue(new Error("secret reset URL"));
    expect(await requestPasswordRecovery(eligible.email)).toEqual({
      success: true,
    });
    await flush();
    expect(mocks.error).toHaveBeenCalledWith(
      "password-recovery.delivery-failed",
    );
    expect(JSON.stringify(mocks.error.mock.calls)).not.toContain(
      "secret reset URL",
    );
  });

  it("enforces a persisted one-minute cooldown even after consumption", async () => {
    mocks.findToken.mockResolvedValue({
      requestedAt: new Date(),
      consumedAt: new Date(),
    });
    await requestPasswordRecovery(eligible.email);
    await flush();
    expect(mocks.upsertToken).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("rejects malformed or oversized emails before scheduling work", async () => {
    for (const email of ["bad", "a".repeat(255), null]) {
      expect((await requestPasswordRecovery(email as string)).success).toBe(
        false,
      );
    }
    expect(mocks.after).not.toHaveBeenCalled();
  });
});

describe("password resets", () => {
  beforeEach(() => {
    mocks.findToken.mockResolvedValue({
      userId: eligible.id,
      tokenHash: digest,
      sessionVersion: 3,
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
  });

  it("atomically consumes the digest, replaces the password, and revokes sessions", async () => {
    expect(
      await resetRecoveredPassword(token, "new-password", "new-password"),
    ).toEqual({ success: true });
    expect(mocks.findToken).toHaveBeenCalledWith({
      where: { tokenHash: digest },
    });
    expect(mocks.updateUser.mock.calls[0][0]).toMatchObject({
      where: {
        id: eligible.id,
        sessionVersion: 3,
        active: true,
        userStatus: { code: "ACTIVO" },
      },
      data: { password: "hashed-password", sessionVersion: { increment: 1 } },
    });
    expect(mocks.consumeToken.mock.calls[0][0]).toMatchObject({
      where: { tokenHash: digest, consumedAt: null },
      data: { consumedAt: expect.any(Date) },
    });
  });

  it.each([null, { consumedAt: new Date() }, { expiresAt: new Date(0) }])(
    "rejects missing, consumed, and expired links without changing credentials (%j)",
    async (override) => {
      const base = await mocks.findToken();
      mocks.findToken.mockResolvedValue(
        override === null ? null : { ...base, ...override },
      );
      expect(
        (await resetRecoveredPassword(token, "new-password", "new-password"))
          .success,
      ).toBe(false);
      expect(mocks.updateUser).not.toHaveBeenCalled();
    },
  );

  it("rejects a changed version or ineligible account", async () => {
    mocks.updateUser.mockResolvedValue({ count: 0 });
    expect(
      (await resetRecoveredPassword(token, "new-password", "new-password"))
        .success,
    ).toBe(false);
    expect(mocks.consumeToken).not.toHaveBeenCalled();
  });

  it.each([
    ["bad-token", "new-password", "new-password"],
    [token, "short", "short"],
    [token, "new-password", "different"],
    [token, "é".repeat(37), "é".repeat(37)],
  ])(
    "validates tokens, confirmation, minimum length and bcrypt byte limit",
    async (raw, password, confirmation) => {
      expect(
        (await resetRecoveredPassword(raw, password, confirmation)).success,
      ).toBe(false);
      expect(mocks.findToken).not.toHaveBeenCalled();
      expect(mocks.hash).not.toHaveBeenCalled();
    },
  );
});
