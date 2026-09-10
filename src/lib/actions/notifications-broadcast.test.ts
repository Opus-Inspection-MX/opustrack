import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The broadcast gate (Phase 1 fix).
 *
 * `sendBroadcast` used to ask only for `notifications:read`, so any
 * authenticated user — even GUEST — could invoke the Server Action and write
 * to everyone's inbox. These tests pin the capability check and the Spanish
 * validation rules (returned via `rejected`, never thrown).
 */

const { prismaMock, requirePermission, notifyBroadcast } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn() },
  },
  requirePermission: vi.fn(async (_name: string) => ({ id: "admin-1" })),
  notifyBroadcast: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/notifications", () => ({ notifyBroadcast }));

import { sendBroadcast } from "./notifications";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findMany.mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
});

describe("sendBroadcast gate", () => {
  it("demands notifications:broadcast, not notifications:read", async () => {
    await sendBroadcast({
      title: "Aviso",
      message: "Mantenimiento nocturno",
      type: "system",
      audience: "all",
    });

    expect(requirePermission).toHaveBeenCalledWith("notifications:broadcast");
    expect(requirePermission).not.toHaveBeenCalledWith("notifications:read");
    expect(notifyBroadcast).toHaveBeenCalled();
  });

  it("regresa el título obligatorio en español sin lanzar", async () => {
    const result = await sendBroadcast({
      title: "   ",
      message: "Algo",
      type: "system",
      audience: "all",
    });

    expect(result).toEqual({
      success: false,
      error: "El título es obligatorio",
    });
    expect(notifyBroadcast).not.toHaveBeenCalled();
  });

  it("regresa el mensaje obligatorio en español sin lanzar", async () => {
    const result = await sendBroadcast({
      title: "Aviso",
      message: "",
      type: "system",
      audience: "all",
    });

    expect(result).toEqual({
      success: false,
      error: "El mensaje es obligatorio",
    });
    expect(notifyBroadcast).not.toHaveBeenCalled();
  });

  it("exige rol cuando la audiencia es por rol", async () => {
    const result = await sendBroadcast({
      title: "Aviso",
      message: "Algo",
      type: "system",
      audience: "by-role",
    });

    expect(result).toEqual({
      success: false,
      error: "Debe seleccionar un rol cuando la audiencia es por rol",
    });
    expect(notifyBroadcast).not.toHaveBeenCalled();
  });
});
