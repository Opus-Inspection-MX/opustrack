import { BroadcastStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, broadcastAudience, dispatch } = vi.hoisted(() => ({
  prismaMock: {
    broadcast: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  broadcastAudience: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("./audiences", () => ({ broadcastAudience }));
vi.mock("./dispatch", () => ({ dispatch }));

import { dispatchBroadcast, dispatchDueBroadcasts } from "./broadcast-dispatch";

/**
 * The Phase 5 cron calls `dispatchBroadcast`/`dispatchDueBroadcasts`; two
 * overlapping runs must deliver exactly once. The claim is a single
 * `updateMany (PROGRAMADA → ENVIANDO)`, so the loser sees `count: 0` and
 * stops. A live-DB proof (two concurrent transactions, one delivery) belongs
 * in e2e — the harness here cannot run real transactions, so these tests pin
 * the claim gate and the send-time audience with mocks.
 */

const ROW = {
  id: "b1",
  title: "Mantenimiento",
  message: "Ventana nocturna",
  kind: "SYSTEM",
  sendInApp: true,
  sendEmail: false,
  allRoles: false,
  includeSender: false,
  createdById: "admin-1",
  active: true,
  roles: [{ roleId: 3 }],
  users: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  dispatch.mockResolvedValue(undefined);
  broadcastAudience.mockResolvedValue(["u1", "u2", "admin-1"]);
  prismaMock.broadcast.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.broadcast.findUnique.mockResolvedValue(ROW);
  prismaMock.broadcast.update.mockResolvedValue(ROW);
  prismaMock.broadcast.findMany.mockResolvedValue([]);
});

describe("reclamo atómico", () => {
  it("doble corrida, un envío: el perdedor del reclamo no despacha", async () => {
    prismaMock.broadcast.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });

    const first = await dispatchBroadcast("b1");
    const second = await dispatchBroadcast("b1");

    expect(first).toEqual({ broadcastId: "b1", claimed: true, delivered: 2 });
    expect(second).toEqual({ broadcastId: "b1", claimed: false, delivered: 0 });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it("solo reclama PROGRAMADA: una ENVIADA no se reenvía", async () => {
    await dispatchBroadcast("b1");

    expect(prismaMock.broadcast.updateMany).toHaveBeenCalledWith({
      where: { id: "b1", status: BroadcastStatus.PROGRAMADA },
      data: { status: BroadcastStatus.ENVIANDO },
    });
  });

  it("un fallo reclamando no lanza y no despacha", async () => {
    prismaMock.broadcast.updateMany.mockRejectedValue(new Error("db caída"));

    const result = await dispatchBroadcast("b1");

    expect(result).toEqual({ broadcastId: "b1", claimed: false, delivered: 0 });
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("audiencia al enviar", () => {
  it("ANNOUNCEMENT respeta la audiencia por roles (no fuerza a todos)", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      kind: "ANNOUNCEMENT",
    });

    await dispatchBroadcast("b1");

    expect(broadcastAudience).toHaveBeenCalledWith({
      all: false,
      roleIds: [3],
      userIds: [],
    });
    expect(dispatch).toHaveBeenCalledWith(
      "announcement",
      expect.objectContaining({ recipients: ["u1", "u2", "admin-1"] }),
    );
  });

  it("allRoles resuelve a todos los activos", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      allRoles: true,
      roles: [],
    });

    await dispatchBroadcast("b1");

    expect(broadcastAudience).toHaveBeenCalledWith({ all: true, roleIds: [] });
  });

  it("pasa los usuarios directos activos a la audiencia", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      users: [{ userId: "u9" }],
    });

    await dispatchBroadcast("b1");

    expect(broadcastAudience).toHaveBeenCalledWith({
      all: false,
      roleIds: [3],
      userIds: ["u9"],
    });
  });

  it("excluye al remitente salvo includeSender", async () => {
    await dispatchBroadcast("b1");

    expect(dispatch).toHaveBeenCalledWith(
      "system",
      expect.objectContaining({ actorId: "admin-1", includeActor: false }),
    );
    expect(prismaMock.broadcast.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({
        status: BroadcastStatus.ENVIADA,
        recipientCount: 2,
      }),
    });
  });

  it("includeSender conserva al remitente y lo cuenta", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      includeSender: true,
    });

    const result = await dispatchBroadcast("b1");

    expect(dispatch).toHaveBeenCalledWith(
      "system",
      expect.objectContaining({ includeActor: true }),
    );
    expect(result.delivered).toBe(3);
  });

  it("los canales de la difusión viajan como override (no la matriz)", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      sendInApp: false,
      sendEmail: true,
    });

    await dispatchBroadcast("b1");

    expect(dispatch).toHaveBeenCalledWith(
      "system",
      expect.objectContaining({
        channels: { inApp: false, email: true },
        broadcastId: "b1",
        entity: { type: "broadcast", id: "b1" },
      }),
    );
  });

  it("una difusión inactiva marca FALLIDA sin despachar", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      ...ROW,
      active: false,
    });

    const result = await dispatchBroadcast("b1");

    expect(dispatch).not.toHaveBeenCalled();
    expect(result).toEqual({ broadcastId: "b1", claimed: true, delivered: 0 });
    expect(prismaMock.broadcast.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: expect.objectContaining({ status: BroadcastStatus.FALLIDA }),
    });
  });
});

describe("dispatchDueBroadcasts", () => {
  it("envía las vencidas en orden y aísla errores por renglón", async () => {
    prismaMock.broadcast.findMany.mockResolvedValue([
      { id: "b1" },
      { id: "b2" },
    ]);

    const results = await dispatchDueBroadcasts(
      new Date("2026-09-12T00:00:00Z"),
    );

    expect(prismaMock.broadcast.findMany).toHaveBeenCalledWith({
      where: {
        status: BroadcastStatus.PROGRAMADA,
        active: true,
        scheduledAt: { lte: new Date("2026-09-12T00:00:00Z") },
      },
      select: { id: true },
      orderBy: { scheduledAt: "asc" },
    });
    expect(results).toHaveLength(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it("sin vencidas no hace nada y nunca lanza", async () => {
    prismaMock.broadcast.findMany.mockRejectedValue(new Error("db caída"));

    await expect(dispatchDueBroadcasts()).resolves.toEqual([]);
  });
});
