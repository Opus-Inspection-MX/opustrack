import { createHash, randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  requestPasswordRecovery,
  resetRecoveredPassword,
} from "@/lib/actions/password-recovery";
import { prisma } from "@/lib/database/prisma.singleton";
import { comparePasswords, hashPassword } from "@/lib/security/hash";

const mail = vi.hoisted(() => ({ after: vi.fn(), send: vi.fn() }));
vi.mock("next/server", () => ({ after: mail.after }));
vi.mock("@/lib/mail/transport", () => ({
  getMailTransport: () => ({ name: "smtp", send: mail.send }),
}));

let userId: string;
let email: string;
const password = "replacement-password";

beforeEach(async () => {
  vi.clearAllMocks();
  const [status, role] = await Promise.all([
    prisma.userStatus.findFirstOrThrow({ where: { code: "ACTIVO" } }),
    prisma.role.findFirstOrThrow({ where: { active: true } }),
  ]);
  email = `recovery-${randomBytes(8).toString("hex")}@test.local`;
  const user = await prisma.user.create({
    data: {
      name: "Recovery integration",
      email,
      password: await hashPassword("original-password"),
      userStatusId: status.id,
      userRoles: { create: { roleId: role.id } },
    },
  });
  userId = user.id;
});

async function requestLink() {
  expect(await requestPasswordRecovery(email)).toEqual({ success: true });
  await mail.after.mock.calls.at(-1)?.[0]();
  const message = mail.send.mock.calls.at(-1)?.[0];
  expect(message).toBeDefined();
  return new URL(message.text.match(/https?:\/\/\S+/)[0]).hash.slice(1);
}

async function snapshot() {
  return {
    user: await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { password: true, sessionVersion: true, active: true },
    }),
    token: await prisma.passwordResetToken.findUnique({ where: { userId } }),
  };
}

describe("real database password recovery", () => {
  it("permits exactly one concurrent reset and changes credentials and session version together", async () => {
    const token = await requestLink();
    const before = await snapshot();
    expect(before.token?.tokenHash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    const results = await Promise.all([
      resetRecoveredPassword(token, password, password),
      resetRecoveredPassword(token, password, password),
    ]);
    expect(results.filter((result) => result.success)).toHaveLength(1);
    const after = await snapshot();
    expect(after.user.sessionVersion).toBe(before.user.sessionVersion + 1);
    expect(await comparePasswords(password, after.user.password)).toBe(true);
    expect(
      await comparePasswords("original-password", after.user.password),
    ).toBe(false);
    expect(after.token?.consumedAt).not.toBeNull();
    expect(
      (await resetRecoveredPassword(token, password, password)).success,
    ).toBe(false);
    expect(await snapshot()).toEqual(after);
  });

  it("replaces older links after the cooldown but does not resend during it", async () => {
    const oldToken = await requestLink();
    await requestPasswordRecovery(email);
    await mail.after.mock.calls.at(-1)?.[0]();
    expect(mail.send).toHaveBeenCalledTimes(1);
    await prisma.passwordResetToken.update({
      where: { userId },
      data: { requestedAt: new Date(Date.now() - 61_000) },
    });
    const newToken = await requestLink();
    expect(newToken).not.toBe(oldToken);
    const before = await snapshot();
    expect(
      (await resetRecoveredPassword(oldToken, password, password)).success,
    ).toBe(false);
    expect(await snapshot()).toEqual(before);
    expect(
      (await resetRecoveredPassword(newToken, password, password)).success,
    ).toBe(true);
  });

  it.each(["expired", "changed-password", "inactive", "no-role"])(
    "rejects %s without changing stored credentials or token evidence",
    async (condition) => {
      const token = await requestLink();
      if (condition === "expired")
        await prisma.passwordResetToken.update({
          where: { userId },
          data: { expiresAt: new Date(0) },
        });
      if (condition === "changed-password")
        await prisma.user.update({
          where: { id: userId },
          data: { sessionVersion: { increment: 1 } },
        });
      if (condition === "inactive")
        await prisma.user.update({
          where: { id: userId },
          data: { active: false },
        });
      if (condition === "no-role")
        await prisma.userRole.updateMany({
          where: { userId },
          data: { active: false },
        });
      const before = await snapshot();
      expect(
        (await resetRecoveredPassword(token, password, password)).success,
      ).toBe(false);
      expect(await snapshot()).toEqual(before);
    },
  );

  it("does not issue links for disabled accounts", async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });
    expect(await requestPasswordRecovery(email)).toEqual({ success: true });
    await mail.after.mock.calls.at(-1)?.[0]();
    expect(mail.send).not.toHaveBeenCalled();
    expect((await snapshot()).token).toBeNull();
  });
});
