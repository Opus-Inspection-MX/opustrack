import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, createNotificationsForUsers, enqueueAndSend } = vi.hoisted(
  () => ({
    prismaMock: {
      notificationChannelPolicy: { findMany: vi.fn() },
      user: { findMany: vi.fn() },
    },
    createNotificationsForUsers: vi.fn(),
    enqueueAndSend: vi.fn(),
  }),
);
vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("./notification-service", () => ({ createNotificationsForUsers }));
vi.mock("@/lib/mail/outbox", () => ({ enqueueAndSend }));
vi.mock("@/lib/mail/templates", () => ({
  renderEmail: ({ subject, intro }: { subject: string; intro: string }) => ({
    subject,
    text: intro,
    html: intro,
  }),
}));
vi.mock("@/lib/observability/logger", () => ({ logger: { error: vi.fn() } }));

import { clearChannelPolicyCache } from "./dispatch";
import { notifyVacationCorrected } from "./notify-events";

beforeEach(() => {
  vi.clearAllMocks();
  clearChannelPolicyCache();
  prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([
    { email: "employee@test.local" },
  ]);
});

describe("vacation correction delivery", () => {
  it("delivers the approved-shortening message in-app without a seeded policy row", async () => {
    await notifyVacationCorrected("v1", "employee", "admin");
    expect(createNotificationsForUsers).toHaveBeenCalledTimes(1);
    expect(createNotificationsForUsers).toHaveBeenCalledWith(
      ["employee"],
      expect.objectContaining({
        type: "vacation_corrected",
        entityType: "vacation",
        entityId: "v1",
        message: expect.stringMatching(/sigue aprobada.*acortado/),
        actionUrl: "/notifications/go/vacation/v1",
      }),
    );
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });

  it("excludes an actor correcting their own approved vacation from both channels", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([
      { type: "vacation_corrected", inApp: true, email: true },
    ]);
    await notifyVacationCorrected("v1", "admin", "admin");
    expect(createNotificationsForUsers).not.toHaveBeenCalled();
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });

  it("honors the channel matrix instead of forcing the catalog default", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockResolvedValue([
      { type: "vacation_corrected", inApp: false, email: true },
    ]);
    await notifyVacationCorrected("v1", "employee", "admin");
    expect(createNotificationsForUsers).not.toHaveBeenCalled();
    expect(enqueueAndSend).toHaveBeenCalledTimes(1);
    expect(enqueueAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationType: "vacation_corrected",
        text: expect.stringMatching(/sigue aprobada.*acortado/),
        recipients: ["employee@test.local"],
      }),
    );
  });

  it("falls back to in-app-only defaults when policy lookup fails", async () => {
    prismaMock.notificationChannelPolicy.findMany.mockRejectedValue(
      new Error("Policy lookup failed"),
    );
    await expect(
      notifyVacationCorrected("v1", "employee", "admin"),
    ).resolves.toBeUndefined();
    expect(createNotificationsForUsers).toHaveBeenCalledTimes(1);
    expect(enqueueAndSend).not.toHaveBeenCalled();
  });
});
