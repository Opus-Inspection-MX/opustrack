import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  prismaMock,
  txMock,
  requirePermission,
  broadcastAudience,
  dispatchBroadcast,
} = vi.hoisted(() => ({
  prismaMock: {
    role: { findMany: vi.fn() },
    userRole: { findMany: vi.fn() },
    roleBroadcastTarget: { findMany: vi.fn() },
    broadcast: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    broadcastRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  txMock: {
    broadcast: { update: vi.fn() },
    broadcastRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    broadcastUser: { updateMany: vi.fn(), upsert: vi.fn() },
    roleBroadcastTarget: { updateMany: vi.fn(), upsert: vi.fn() },
  },
  requirePermission: vi.fn(),
  broadcastAudience: vi.fn(),
  dispatchBroadcast: vi.fn(),
}));

vi.mock("@/lib/database/prisma.singleton", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth/auth", () => ({
  requirePermission: (name: string) => requirePermission(name),
}));
vi.mock("@/lib/notifications/audiences", () => ({ broadcastAudience }));
vi.mock("@/lib/notifications/broadcast-dispatch", () => ({
  dispatchBroadcast: (id: string) => dispatchBroadcast(id),
}));

import {
  type BroadcastFormInput,
  cancelBroadcast,
  createBroadcast,
  previewBroadcastRecipients,
  setRoleBroadcastTargets,
  updateBroadcast,
} from "./broadcasts";

/**
 * Scope validation is fail closed: a sender reaches only the UNION of their
 * roles' `RoleBroadcastTarget` rows; no rows → nobody; ROOT bypasses.
 * Seeded reach here: ADMIN_OPERACION(2) → {2, FSR 4, REPORTER 6, GUEST 7}.
 */

const ALL_ROLES = [1, 2, 3, 4, 5, 6, 7].map((id) => ({
  id,
  name: `R${id}`,
  description: null,
}));

const OP_GRANTS = [2, 4, 6, 7].map((targetRoleId) => ({ targetRoleId }));

function mockRoleFindMany() {
  prismaMock.role.findMany.mockImplementation(
    (args?: { where?: { id?: { in?: number[] } } }) => {
      const ids = args?.where?.id?.in;
      return Promise.resolve(
        ids ? ALL_ROLES.filter((r) => ids.includes(r.id)) : ALL_ROLES,
      );
    },
  );
}

const SEND_NOW: BroadcastFormInput = {
  title: "Aviso",
  message: "Mantenimiento nocturno",
  kind: "SYSTEM",
  sendInApp: true,
  sendEmail: false,
  allRoles: false,
  roleIds: [4],
  userIds: [],
  includeSender: false,
  sendNow: true,
  scheduledAtLocal: null,
};

const SCHEDULED: BroadcastFormInput = {
  ...SEND_NOW,
  sendNow: false,
  scheduledAtLocal: "2030-05-01T10:00",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRoleFindMany();
  requirePermission.mockResolvedValue({ id: "op1", isSuperuser: false });
  prismaMock.userRole.findMany.mockResolvedValue([{ roleId: 2 }]);
  prismaMock.roleBroadcastTarget.findMany.mockResolvedValue(OP_GRANTS);
  prismaMock.broadcast.create.mockResolvedValue({ id: "b1" });
  prismaMock.broadcast.findUnique.mockResolvedValue({ status: "ENVIADA" });
  prismaMock.$transaction.mockImplementation((cb: (tx: unknown) => unknown) =>
    cb(txMock),
  );
  broadcastAudience.mockResolvedValue(["u1", "u2"]);
  dispatchBroadcast.mockResolvedValue({
    broadcastId: "b1",
    claimed: true,
    delivered: 2,
  });
});

describe("permiso", () => {
  it("exige notifications:broadcast, no el de lectura", async () => {
    await createBroadcast(SEND_NOW);

    expect(requirePermission).toHaveBeenCalledWith("notifications:broadcast");
    expect(requirePermission).not.toHaveBeenCalledWith("notifications:read");
  });

  it("GUEST sin el permiso es rechazado (lanza, no devuelve)", async () => {
    requirePermission.mockRejectedValue(
      new Error("Permission denied: notifications:broadcast"),
    );

    await expect(createBroadcast(SEND_NOW)).rejects.toThrow();
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });
});

describe("validación en español (devuelta, no lanzada)", () => {
  it("título y mensaje obligatorios", async () => {
    expect(await createBroadcast({ ...SEND_NOW, title: "  " })).toEqual({
      success: false,
      error: "El título es obligatorio",
    });
    expect(await createBroadcast({ ...SEND_NOW, message: "" })).toEqual({
      success: false,
      error: "El mensaje es obligatorio",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("exige al menos un canal", async () => {
    const result = await createBroadcast({
      ...SEND_NOW,
      sendInApp: false,
      sendEmail: false,
    });

    expect(result).toEqual({
      success: false,
      error: "Selecciona al menos un canal: notificación o correo",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("exige al menos un destinatario", async () => {
    const result = await createBroadcast({ ...SEND_NOW, roleIds: [] });

    expect(result).toEqual({
      success: false,
      error: "Selecciona al menos un destinatario",
    });
  });

  it("fecha inválida y fecha pasada", async () => {
    expect(
      await createBroadcast({ ...SCHEDULED, scheduledAtLocal: "nope" }),
    ).toEqual({
      success: false,
      error: "La fecha y hora programadas no son válidas",
    });
    expect(
      await createBroadcast({
        ...SCHEDULED,
        scheduledAtLocal: "2020-01-01T10:00",
      }),
    ).toEqual({
      success: false,
      error: "La fecha programada debe estar en el futuro",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });
});

describe("alcance por rol (fail closed)", () => {
  it("ADMIN_OPERACION no puede elegir EMPLEADO", async () => {
    const result = await createBroadcast({ ...SEND_NOW, roleIds: [5] });

    expect(result).toEqual({
      success: false,
      error: "No puedes difundir a uno o más de los roles seleccionados",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it('"todos" exige tener permitidos todos los roles', async () => {
    const result = await createBroadcast({
      ...SEND_NOW,
      allRoles: true,
      roleIds: [],
    });

    expect(result).toEqual({
      success: false,
      error: "No tienes permiso para difundir a todos los roles",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("sin configuración no difunde a nadie", async () => {
    prismaMock.roleBroadcastTarget.findMany.mockResolvedValue([]);

    const result = await createBroadcast(SEND_NOW);

    expect(result).toEqual({
      success: false,
      error: "No puedes difundir a uno o más de los roles seleccionados",
    });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("ROOT evita la tabla y llega a todos", async () => {
    requirePermission.mockResolvedValue({ id: "root1", isSuperuser: true });
    prismaMock.roleBroadcastTarget.findMany.mockResolvedValue([]);

    const result = await createBroadcast({
      ...SEND_NOW,
      allRoles: true,
      roleIds: [],
    });

    expect(result.success).toBe(true);
    expect(prismaMock.broadcast.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allRoles: true }),
      }),
    );
  });
});

describe("crear y despachar", () => {
  it('"enviar ahora" crea PROGRAMADA y despacha en la misma request', async () => {
    const result = await createBroadcast(SEND_NOW);

    expect(result).toEqual({ success: true, id: "b1", status: "ENVIADA" });
    expect(prismaMock.broadcast.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PROGRAMADA",
          scheduledAt: expect.any(Date),
          roles: {
            create: [{ roleId: 4, createdById: "op1" }],
          },
        }),
      }),
    );
    expect(dispatchBroadcast).toHaveBeenCalledWith("b1");
  });

  it("programar guarda futuro sin despachar", async () => {
    const result = await createBroadcast(SCHEDULED);

    expect(result).toEqual({ success: true, id: "b1", status: "PROGRAMADA" });
    expect(dispatchBroadcast).not.toHaveBeenCalled();
    const scheduledAt = prismaMock.broadcast.create.mock.calls[0][0].data
      .scheduledAt as Date;
    expect(scheduledAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("editar y cancelar", () => {
  it("update solo en PROGRAMADA", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      status: "ENVIADA",
      active: true,
    });

    const result = await updateBroadcast("b1", SCHEDULED);

    expect(result).toEqual({
      success: false,
      error: "Solo se pueden editar difusiones programadas",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("update PROGRAMADA reemplaza audiencia en transacción", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      status: "PROGRAMADA",
      active: true,
    });

    const result = await updateBroadcast("b1", SCHEDULED);

    expect(result).toEqual({ success: true, id: "b1" });
    expect(txMock.broadcastRole.deleteMany).toHaveBeenCalledWith({
      where: { broadcastId: "b1" },
    });
    expect(txMock.broadcastRole.createMany).toHaveBeenCalled();
  });

  it("cancel solo en PROGRAMADA", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      status: "ENVIADA",
      active: true,
    });
    expect(await cancelBroadcast("b1")).toEqual({
      success: false,
      error: "Solo se pueden cancelar difusiones programadas",
    });

    prismaMock.broadcast.findUnique.mockResolvedValue({
      status: "PROGRAMADA",
      active: true,
    });
    expect(await cancelBroadcast("b1")).toEqual({
      success: true,
      id: "b1",
    });
    expect(prismaMock.broadcast.update).toHaveBeenCalledWith({
      where: { id: "b1" },
      data: { status: "CANCELADA" },
    });
  });
});

describe("vista previa", () => {
  it("recorta al alcance del emisor", async () => {
    const preview = await previewBroadcastRecipients({
      roleIds: [4, 5],
      allRoles: false,
      includeSender: false,
      userIds: [],
    });

    expect(broadcastAudience).toHaveBeenCalledWith({
      all: false,
      roleIds: [4],
    });
    expect(preview).toEqual({ count: 2 });
  });
});

describe("destinos por rol (solo ROOT)", () => {
  it("un admin no ROOT no puede editar destinos", async () => {
    const result = await setRoleBroadcastTargets(2, [4]);

    expect(result).toEqual({
      success: false,
      error:
        "Solo un usuario ROOT puede administrar roles y permisos. Pídeselo a un administrador general.",
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("ROOT reemplaza destinos con upsert", async () => {
    requirePermission.mockResolvedValue({ id: "root1", isSuperuser: true });

    const result = await setRoleBroadcastTargets(2, [4, 6]);

    expect(result).toEqual({ success: true });
    expect(txMock.roleBroadcastTarget.upsert).toHaveBeenCalledTimes(2);
  });
});
