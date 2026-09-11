import { beforeEach, describe, expect, it, vi } from "vitest";

const PrismaClientMock = vi.hoisted(() => vi.fn());

vi.mock("@prisma/client", () => ({
  PrismaClient: PrismaClientMock,
}));

describe("prisma.singleton client config (H-01)", () => {
  beforeEach(async () => {
    vi.resetModules();
    PrismaClientMock.mockClear();
    const globalForPrisma = globalThis as unknown as {
      prisma?: unknown;
    };
    delete globalForPrisma.prisma;
    await import("./prisma.singleton");
  });

  it("registers a global omit for User.password", () => {
    expect(PrismaClientMock).toHaveBeenCalledWith(
      expect.objectContaining({
        omit: { user: { password: true } },
      }),
    );
  });
});
