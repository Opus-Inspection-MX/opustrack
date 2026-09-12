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
    userRole: { findMany: vi.fn(), count: vi.fn() },
    roleBroadcastTarget: { findMany: vi.fn() },
    broadcast: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    broadcastRole: { deleteMany: vi.fn(), createMany: vi.fn() },
    broadcastUser: { findMany: vi.fn() },
    user: { findMany: vi.fn(), count: vi.fn() },
    userClientAssignment: { findMany: vi.fn() },
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
  listBroadcasts,
  previewBroadcastRecipients,
  searchBroadcastRecipients,
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
  prismaMock.userRole.count.mockResolvedValue(0);
  prismaMock.user.count.mockResolvedValue(0);
  prismaMock.userClientAssignment.findMany.mockResolvedValue([
    { clientId: "c1" },
  ]);
  prismaMock.user.findMany.mockResolvedValue([]);
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

describe("destinatarios específicos (Parte C)", () => {
  const OUT_OF_SCOPE =
    "No puedes difundir a uno o más de los usuarios seleccionados";

  it("acepta solo userIds: persiste filas y despacha", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u9" }]);

    const result = await createBroadcast({
      ...SEND_NOW,
      roleIds: [],
      userIds: ["u9"],
    });

    expect(result.success).toBe(true);
    expect(prismaMock.broadcast.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          users: { create: [{ userId: "u9", createdById: "op1" }] },
        }),
      }),
    );
    expect(dispatchBroadcast).toHaveBeenCalledWith("b1");
  });

  it("rechaza un userId fuera de alcance sin escribir", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const result = await createBroadcast({
      ...SEND_NOW,
      roleIds: [],
      userIds: ["u-evil"],
    });

    expect(result).toEqual({ success: false, error: OUT_OF_SCOPE });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("sin roles alcanzables tampoco hay usuarios alcanzables", async () => {
    prismaMock.roleBroadcastTarget.findMany.mockResolvedValue([]);

    const result = await createBroadcast({
      ...SEND_NOW,
      roleIds: [],
      userIds: ["u9"],
    });

    expect(result).toEqual({ success: false, error: OUT_OF_SCOPE });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("sin Cliente compartido no alcanza a nadie (mismo rol, otro Cliente)", async () => {
    prismaMock.userClientAssignment.findMany.mockResolvedValue([]);

    const result = await createBroadcast({
      ...SEND_NOW,
      roleIds: [],
      userIds: ["u9"],
    });

    expect(result).toEqual({ success: false, error: OUT_OF_SCOPE });
    expect(prismaMock.broadcast.create).not.toHaveBeenCalled();
  });

  it("ROOT alcanza a cualquiera sin filtro de Cliente", async () => {
    requirePermission.mockResolvedValue({ id: "root1", isSuperuser: true });
    prismaMock.userRole.count.mockResolvedValue(1);
    prismaMock.user.findMany.mockResolvedValue([{ id: "u-any" }]);

    const result = await createBroadcast({
      ...SEND_NOW,
      roleIds: [],
      userIds: ["u-any"],
    });

    expect(result.success).toBe(true);
    expect(prismaMock.userClientAssignment.findMany).not.toHaveBeenCalled();
  });

  it("editar desactiva (nunca borra) los usuarios quitados", async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      status: "PROGRAMADA",
      active: true,
    });
    prismaMock.user.findMany.mockResolvedValue([{ id: "u9" }]);

    const result = await updateBroadcast("b1", {
      ...SCHEDULED,
      roleIds: [],
      userIds: ["u9"],
    });

    expect(result).toEqual({ success: true, id: "b1" });
    expect(txMock.broadcastUser.updateMany).toHaveBeenCalledWith({
      where: { broadcastId: "b1", active: true, userId: { notIn: ["u9"] } },
      data: expect.objectContaining({ active: false }),
    });
    expect(txMock.broadcastUser.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { broadcastId_userId: { broadcastId: "b1", userId: "u9" } },
      }),
    );
  });
});

describe("searchBroadcastRecipients", () => {
  it("menos de 2 caracteres devuelve vacío sin consultar", async () => {
    await expect(searchBroadcastRecipients("a")).resolves.toEqual([]);
    await expect(searchBroadcastRecipients("  ")).resolves.toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });

  it("devuelve id, nombre, correo y roles dentro del alcance", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Ana FSR",
        email: "ana@test.local",
        userRoles: [{ role: { name: "FSR" } }],
      },
    ]);

    const results = await searchBroadcastRecipients("an");

    expect(results).toEqual([
      {
        id: "u1",
        name: "Ana FSR",
        email: "ana@test.local",
        roleNames: ["FSR"],
      },
    ]);
    const where = JSON.stringify(
      prismaMock.user.findMany.mock.calls[0][0].where,
    );
    expect(where).toContain("c1");
    expect(where).toContain("an");
  });

  it("sin alcance no revela a nadie", async () => {
    prismaMock.roleBroadcastTarget.findMany.mockResolvedValue([]);

    await expect(searchBroadcastRecipients("ana")).resolves.toEqual([]);
    expect(prismaMock.user.findMany).not.toHaveBeenCalled();
  });
});

describe("vista previa con usuarios", () => {
  it("une audiencia por rol y userIds sin duplicados", async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: "u2" }, { id: "u3" }]);

    const preview = await previewBroadcastRecipients({
      roleIds: [4],
      allRoles: false,
      includeSender: true,
      userIds: ["u2", "u3"],
    });

    // Role audience ["u1","u2"] + direct ["u2","u3"] → 3 unique.
    expect(preview).toEqual({ count: 3 });
  });

  it("los userIds fuera de alcance no suman (recorte silencioso)", async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    const preview = await previewBroadcastRecipients({
      roleIds: [],
      allRoles: false,
      includeSender: true,
      userIds: ["u-evil"],
    });

    expect(broadcastAudience).not.toHaveBeenCalled();
    expect(preview).toEqual({ count: 0 });
  });
});

describe("listBroadcasts con usuarios", () => {
  it("incluye nombre y correo de los destinatarios directos", async () => {
    prismaMock.broadcast.findMany.mockResolvedValue([
      {
        id: "b1",
        title: "Aviso",
        message: "Hola",
        kind: "SYSTEM",
        sendInApp: true,
        sendEmail: false,
        allRoles: false,
        includeSender: false,
        scheduledAt: new Date("2030-05-01T10:00:00Z"),
        status: "PROGRAMADA",
        sentAt: null,
        recipientCount: 0,
        createdById: "op1",
        roles: [],
        createdAt: new Date("2030-04-01T10:00:00Z"),
      },
    ]);
    prismaMock.user.findMany.mockResolvedValue([{ id: "op1", name: "Op" }]);
    prismaMock.broadcastUser.findMany.mockResolvedValue([
      {
        broadcastId: "b1",
        user: { id: "u9", name: "Ana", email: "ana@test.local" },
      },
    ]);

    const rows = await listBroadcasts();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.users).toEqual([
      { id: "u9", name: "Ana", email: "ana@test.local" },
    ]);
    expect(rows[0]?.usersTotal).toBe(1);
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
