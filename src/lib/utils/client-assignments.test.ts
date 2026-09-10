import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    userClientAssignment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/database/prisma.singleton";
import {
  assignUserToClient,
  getPrimaryClientId,
  getUserClientIds,
  removeUserFromClient,
  setPrimaryClient,
  userHasAccessToClient,
} from "./client-assignments";

const findMany = vi.mocked(prisma.userClientAssignment.findMany);
const findFirst = vi.mocked(prisma.userClientAssignment.findFirst);
const findUnique = vi.mocked(prisma.userClientAssignment.findUnique);
const update = vi.mocked(prisma.userClientAssignment.update);
const updateMany = vi.mocked(prisma.userClientAssignment.updateMany);
const upsert = vi.mocked(prisma.userClientAssignment.upsert);
const userUpdate = vi.mocked(prisma.user.update);
const userUpdateMany = vi.mocked(prisma.user.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserClientIds", () => {
  it("returns active Client ids for the user", async () => {
    findMany.mockResolvedValue([
      { clientId: "c1" },
      { clientId: "c2" },
    ] as never);

    expect(await getUserClientIds("u1")).toEqual(["c1", "c2"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1", active: true },
      select: { clientId: true },
    });
  });

  it("returns an empty array when there are no assignments", async () => {
    findMany.mockResolvedValue([] as never);
    expect(await getUserClientIds("u1")).toEqual([]);
  });
});

describe("getPrimaryClientId", () => {
  it("returns the primary Client id", async () => {
    findFirst.mockResolvedValue({ clientId: "c1" } as never);
    expect(await getPrimaryClientId("u1")).toBe("c1");
  });

  it("returns null when there is no primary assignment", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getPrimaryClientId("u1")).toBeNull();
  });
});

describe("userHasAccessToClient", () => {
  it("is true for an active assignment", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    expect(await userHasAccessToClient("u1", "c1")).toBe(true);
  });

  it("is false for an inactive assignment", async () => {
    findUnique.mockResolvedValue({ active: false } as never);
    expect(await userHasAccessToClient("u1", "c1")).toBe(false);
  });

  it("is false when there is no assignment", async () => {
    findUnique.mockResolvedValue(null);
    expect(await userHasAccessToClient("u1", "c1")).toBe(false);
  });
});

describe("setPrimaryClient", () => {
  it("throws when the user is not assigned to the Client", async () => {
    findUnique.mockResolvedValue(null);
    await expect(setPrimaryClient("u1", "c1")).rejects.toThrow(/not assigned/);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the assignment is inactive", async () => {
    findUnique.mockResolvedValue({ active: false } as never);
    await expect(setPrimaryClient("u1", "c1")).rejects.toThrow();
  });

  it("unsets other primaries then promotes the target when valid", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    update.mockResolvedValue({} as never);

    await setPrimaryClient("u1", "c1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { userId_clientId: { userId: "u1", clientId: "c1" } },
      data: { isPrimary: true },
    });
  });

  it("writes only the junction table (no scalar sync — column removed)", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    update.mockResolvedValue({} as never);

    await setPrimaryClient("u1", "c1");

    // The deprecated User.clienteId scalar is gone: promotion touches only
    // UserClientAssignment rows.
    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("assignUserToClient", () => {
  it("upserts only the junction row (no scalar — column removed)", async () => {
    upsert.mockResolvedValue({} as never);
    updateMany.mockResolvedValue({ count: 0 } as never);
    userUpdate.mockResolvedValue({} as never);

    await assignUserToClient("u1", "c1", true);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_clientId: { userId: "u1", clientId: "c1" } },
      }),
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("does not touch User rows when isPrimary is false", async () => {
    upsert.mockResolvedValue({} as never);

    await assignUserToClient("u1", "c1", false);

    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("removeUserFromClient", () => {
  it("deactivates only the junction row (no scalar — column removed)", async () => {
    update.mockResolvedValue({} as never);
    userUpdateMany.mockResolvedValue({ count: 1 } as never);

    await removeUserFromClient("u1", "c1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_clientId: { userId: "u1", clientId: "c1" } },
        data: { active: false },
      }),
    );
    expect(userUpdateMany).not.toHaveBeenCalled();
  });
});
