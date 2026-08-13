import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/database/prisma.singleton", () => ({
  prisma: {
    userClienteAssignment: {
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
  assignUserToCliente,
  getPrimaryClienteId,
  getUserClienteIds,
  removeUserFromCliente,
  setPrimaryCliente,
  userHasAccessToCliente,
} from "./cliente-assignments";

const findMany = vi.mocked(prisma.userClienteAssignment.findMany);
const findFirst = vi.mocked(prisma.userClienteAssignment.findFirst);
const findUnique = vi.mocked(prisma.userClienteAssignment.findUnique);
const update = vi.mocked(prisma.userClienteAssignment.update);
const updateMany = vi.mocked(prisma.userClienteAssignment.updateMany);
const upsert = vi.mocked(prisma.userClienteAssignment.upsert);
const userUpdate = vi.mocked(prisma.user.update);
const userUpdateMany = vi.mocked(prisma.user.updateMany);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUserClienteIds", () => {
  it("returns active Cliente ids for the user", async () => {
    findMany.mockResolvedValue([
      { clienteId: "c1" },
      { clienteId: "c2" },
    ] as never);

    expect(await getUserClienteIds("u1")).toEqual(["c1", "c2"]);
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "u1", active: true },
      select: { clienteId: true },
    });
  });

  it("returns an empty array when there are no assignments", async () => {
    findMany.mockResolvedValue([] as never);
    expect(await getUserClienteIds("u1")).toEqual([]);
  });
});

describe("getPrimaryClienteId", () => {
  it("returns the primary Cliente id", async () => {
    findFirst.mockResolvedValue({ clienteId: "c1" } as never);
    expect(await getPrimaryClienteId("u1")).toBe("c1");
  });

  it("returns null when there is no primary assignment", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getPrimaryClienteId("u1")).toBeNull();
  });
});

describe("userHasAccessToCliente", () => {
  it("is true for an active assignment", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    expect(await userHasAccessToCliente("u1", "c1")).toBe(true);
  });

  it("is false for an inactive assignment", async () => {
    findUnique.mockResolvedValue({ active: false } as never);
    expect(await userHasAccessToCliente("u1", "c1")).toBe(false);
  });

  it("is false when there is no assignment", async () => {
    findUnique.mockResolvedValue(null);
    expect(await userHasAccessToCliente("u1", "c1")).toBe(false);
  });
});

describe("setPrimaryCliente", () => {
  it("throws when the user is not assigned to the Cliente", async () => {
    findUnique.mockResolvedValue(null);
    await expect(setPrimaryCliente("u1", "c1")).rejects.toThrow(/not assigned/);
    expect(update).not.toHaveBeenCalled();
  });

  it("throws when the assignment is inactive", async () => {
    findUnique.mockResolvedValue({ active: false } as never);
    await expect(setPrimaryCliente("u1", "c1")).rejects.toThrow();
  });

  it("unsets other primaries then promotes the target when valid", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    update.mockResolvedValue({} as never);

    await setPrimaryCliente("u1", "c1");

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "u1", isPrimary: true },
      data: { isPrimary: false },
    });
    expect(update).toHaveBeenCalledWith({
      where: { userId_clienteId: { userId: "u1", clienteId: "c1" } },
      data: { isPrimary: true },
    });
  });

  it("syncs the deprecated User.clienteId scalar with the new primary", async () => {
    findUnique.mockResolvedValue({ active: true } as never);
    updateMany.mockResolvedValue({ count: 1 } as never);
    update.mockResolvedValue({} as never);

    await setPrimaryCliente("u1", "c1");

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { clienteId: "c1" },
    });
  });
});

describe("assignUserToCliente", () => {
  it("syncs the deprecated User.clienteId scalar when isPrimary is true", async () => {
    upsert.mockResolvedValue({} as never);
    updateMany.mockResolvedValue({ count: 0 } as never);
    userUpdate.mockResolvedValue({} as never);

    await assignUserToCliente("u1", "c1", true);

    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { clienteId: "c1" },
    });
  });

  it("does not touch User.clienteId when isPrimary is false", async () => {
    upsert.mockResolvedValue({} as never);

    await assignUserToCliente("u1", "c1", false);

    expect(userUpdate).not.toHaveBeenCalled();
  });
});

describe("removeUserFromCliente", () => {
  it("clears the deprecated User.clienteId scalar when it pointed at the removed Cliente", async () => {
    update.mockResolvedValue({} as never);
    userUpdateMany.mockResolvedValue({ count: 1 } as never);

    await removeUserFromCliente("u1", "c1");

    expect(userUpdateMany).toHaveBeenCalledWith({
      where: { id: "u1", clienteId: "c1" },
      data: { clienteId: null },
    });
  });
});
