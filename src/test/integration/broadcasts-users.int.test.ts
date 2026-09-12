import { beforeAll, describe, expect, it } from "vitest";
import {
  createBroadcast,
  previewBroadcastRecipients,
  searchBroadcastRecipients,
  updateBroadcast,
} from "@/lib/actions/broadcasts";
import { prisma } from "@/lib/database/prisma.singleton";
import { dispatchBroadcast } from "@/lib/notifications/broadcast-dispatch";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Direct-user broadcasts (Parte C) at the action layer, against real rows.
 *
 * A dedicated sender role holds ONLY `notifications:broadcast` and reaches
 * ONLY the FSR role — no `scope:all-clients` anywhere — so the Client half
 * of decision #2 is actually exercised (the seeded module admins all hold
 * the global scope, which would make the Cliente rule vacuous here).
 *
 * - reach = FSR role AND shared active Client; anything else is rejected.
 * - `searchBroadcastRecipients` never reveals out-of-reach users.
 * - dispatch delivers the union without duplicates; inactive users get
 *   nothing; a second dispatch claims nothing (idempotent).
 * - editing deactivates removed `BroadcastUser` rows, never deletes them.
 */

const OUT_OF_SCOPE =
  "No puedes difundir a uno o más de los usuarios seleccionados";

let world: IntWorld;
let fsrRoleId: number;
let senderId: string;
let targetInId: string;
let targetIn2Id: string;
let targetOtherClientId: string;
let targetWrongRoleId: string;
let targetInactiveId: string;

async function makeUser(
  key: string,
  roleId: number,
  clientId: string | null,
  active = true,
): Promise<string> {
  const status = await prisma.userStatus.findUniqueOrThrow({
    where: { name: "ACTIVO" },
  });
  const user = await prisma.user.create({
    data: {
      name: `int-bcu-${key}`,
      email: `int-bcu-${key}@test.local`,
      password: "int-test-dummy-hash-bcu",
      userStatusId: status.id,
      active,
      userRoles: { create: [{ roleId }] },
    },
    select: { id: true },
  });
  if (clientId) {
    await prisma.userClientAssignment.create({
      data: { userId: user.id, clientId, isPrimary: true },
    });
  }
  return user.id;
}

beforeAll(async () => {
  world = await createWorld("bcastusers");
  const [fsr, guest, broadcastPerm] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "FSR" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "GUEST" } }),
    prisma.permission.findUniqueOrThrow({
      where: { name: "notifications:broadcast" },
    }),
  ]);
  fsrRoleId = fsr.id;

  const senderRole = await prisma.role.create({
    data: {
      name: "INT-BCU-SENDER",
      description: "Integration sender for direct-user broadcasts",
      defaultPath: "/inicio",
    },
    select: { id: true },
  });
  await prisma.rolePermission.create({
    data: { roleId: senderRole.id, permissionId: broadcastPerm.id },
  });
  await prisma.roleBroadcastTarget.create({
    data: { sourceRoleId: senderRole.id, targetRoleId: fsr.id },
  });

  senderId = await makeUser("sender", senderRole.id, world.clientA.id);
  targetInId = await makeUser("in", fsr.id, world.clientA.id);
  targetIn2Id = await makeUser("in2", fsr.id, world.clientA.id);
  targetOtherClientId = await makeUser("out", fsr.id, world.clientB.id);
  targetWrongRoleId = await makeUser("guest", guest.id, world.clientA.id);
  targetInactiveId = await makeUser("off", fsr.id, world.clientA.id, false);
});

function scheduledInput(userIds: string[]) {
  return {
    title: "Aviso directo",
    message: "Solo para ti",
    kind: "SYSTEM" as const,
    sendInApp: true,
    sendEmail: false,
    allRoles: false,
    roleIds: [],
    userIds,
    includeSender: false,
    scheduledAtLocal: "2030-05-01T10:00",
  };
}

describe("alcance por rol + Cliente (decisión #2)", () => {
  it("crea con un usuario de su rol y su Cliente", async () => {
    actAs(senderId);

    const result = await createBroadcast({
      ...scheduledInput([targetInId]),
      sendNow: false,
    });

    expect(result.success).toBe(true);
    if (result.success !== true) return;
    const pivots = await prisma.broadcastUser.findMany({
      where: { broadcastId: result.id },
    });
    expect(pivots).toHaveLength(1);
    expect(pivots[0]).toMatchObject({ userId: targetInId, active: true });
  });

  it("rechaza mismo rol en otro Cliente", async () => {
    actAs(senderId);

    const result = await createBroadcast({
      ...scheduledInput([targetOtherClientId]),
      sendNow: false,
    });

    expect(result).toEqual({ success: false, error: OUT_OF_SCOPE });
  });

  it("rechaza rol no alcanzable aunque comparta Cliente", async () => {
    actAs(senderId);

    const result = await createBroadcast({
      ...scheduledInput([targetWrongRoleId]),
      sendNow: false,
    });

    expect(result).toEqual({ success: false, error: OUT_OF_SCOPE });
  });
});

describe("searchBroadcastRecipients no revela fuera de alcance", () => {
  it("devuelve solo usuarios alcanzables", async () => {
    actAs(senderId);

    const results = await searchBroadcastRecipients("int-bcu");

    const ids = results.map((r) => r.id).sort();
    expect(ids).toEqual([targetIn2Id, targetInId].sort());
    for (const row of results) {
      expect(row.name).toContain("int-bcu-");
      expect(row.email).toContain("@test.local");
      expect(row.roleNames).toContain("FSR");
    }
  });

  it("menos de 2 caracteres no busca", async () => {
    actAs(senderId);

    await expect(searchBroadcastRecipients("x")).resolves.toEqual([]);
  });
});

describe("vista previa: unión sin duplicados", () => {
  it("un directo ya cubierto por rol no suma", async () => {
    actAs(senderId);

    const withoutDirect = await previewBroadcastRecipients({
      roleIds: [fsrRoleId],
      allRoles: false,
      includeSender: false,
      userIds: [],
    });
    const withDirect = await previewBroadcastRecipients({
      roleIds: [fsrRoleId],
      allRoles: false,
      includeSender: false,
      userIds: [targetInId],
    });

    expect(withoutDirect.count).toBeGreaterThan(0);
    expect(withDirect.count).toBe(withoutDirect.count);
  });

  it("un directo fuera de alcance no suma", async () => {
    actAs(senderId);

    const preview = await previewBroadcastRecipients({
      roleIds: [],
      allRoles: false,
      includeSender: false,
      userIds: [targetOtherClientId],
    });

    expect(preview).toEqual({ count: 0 });
  });
});

describe("despacho: unión, inactivos fuera, idempotencia", () => {
  it("entrega al directo activo y omite al inactivo", async () => {
    actAs(senderId);

    const created = await createBroadcast({
      ...scheduledInput([targetInId, targetInactiveId]),
      sendNow: true,
    });
    expect(created.success).toBe(true);
    if (created.success !== true) return;

    const delivered = await prisma.notification.findMany({
      where: { entityType: "broadcast", entityId: created.id },
      select: { userId: true },
    });
    const ids = delivered.map((n) => n.userId);
    expect(ids.filter((id) => id === targetInId)).toHaveLength(1);
    expect(ids).not.toContain(targetInactiveId);

    const second = await dispatchBroadcast(created.id);
    expect(second).toEqual({
      broadcastId: created.id,
      claimed: false,
      delivered: 0,
    });
    const again = await prisma.notification.count({
      where: {
        entityType: "broadcast",
        entityId: created.id,
        userId: targetInId,
      },
    });
    expect(again).toBe(1);
  });
});

describe("editar desactiva sin borrar", () => {
  it("quitar un usuario lo deja en active:false", async () => {
    actAs(senderId);

    const created = await createBroadcast({
      ...scheduledInput([targetInId, targetIn2Id]),
      sendNow: false,
    });
    expect(created.success).toBe(true);
    if (created.success !== true) return;

    const updated = await updateBroadcast(created.id, {
      ...scheduledInput([targetIn2Id]),
    });
    expect(updated).toEqual({ success: true, id: created.id });

    const pivots = await prisma.broadcastUser.findMany({
      where: { broadcastId: created.id },
      orderBy: { userId: "asc" },
    });
    expect(pivots).toHaveLength(2);
    expect(pivots.find((p) => p.userId === targetInId)?.active).toBe(false);
    expect(pivots.find((p) => p.userId === targetIn2Id)?.active).toBe(true);
  });
});
