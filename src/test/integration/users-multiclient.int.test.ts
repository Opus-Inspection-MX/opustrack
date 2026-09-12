import { beforeAll, describe, expect, it } from "vitest";
import { getIncidents } from "@/lib/actions/incidents";
import { updateUser } from "@/lib/actions/users";
import { prisma } from "@/lib/database/prisma.singleton";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Several Clients per user (G-2), end to end at the action layer.
 *
 * - `updateUser` synchronizes the junction table to the form's full set:
 *   additions, removals and primary moves in one call.
 * - Scope follows membership: with A+B the user reads both Clients'
 *   incidents; after removing B, B disappears (fail closed, like the
 *   single-Client matrix in scope-matrix.int.test.ts).
 */

let world: IntWorld;

async function formFor(userId: string, clients: string[], primary: string) {
  const target = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, userStatusId: true },
  });
  const fsrRole = await prisma.role.findUniqueOrThrow({
    where: { name: "FSR" },
  });
  return {
    name: target.name,
    email: target.email,
    roleIds: [fsrRole.id],
    userStatusId: target.userStatusId,
    clientIds: clients,
    primaryClientId: primary,
  };
}

async function worldIncidentIds(userId: string): Promise<number[]> {
  actAs(userId);
  const { data } = await getIncidents({ limit: 100 });
  return data.map((row) => row.id);
}

beforeAll(async () => {
  world = await createWorld("multiclient");
});

describe("updateUser sincroniza varios Clientes", () => {
  it("asigna A+B con primario y el usuario ve ambos", async () => {
    actAs(world.root.id);
    const result = await updateUser(
      world.fsrA2.id,
      await formFor(
        world.fsrA2.id,
        [world.clientA.id, world.clientB.id],
        world.clientA.id,
      ),
    );
    expect(result.success).toBe(true);

    const assignments = await prisma.userClientAssignment.findMany({
      where: { userId: world.fsrA2.id, active: true },
      select: { clientId: true, isPrimary: true },
    });
    expect(assignments).toHaveLength(2);
    expect(
      assignments.find((a) => a.clientId === world.clientA.id)?.isPrimary,
    ).toBe(true);
    expect(
      assignments.find((a) => a.clientId === world.clientB.id)?.isPrimary,
    ).toBe(false);

    const ids = await worldIncidentIds(world.fsrA2.id);
    expect(ids).toContain(world.incidentA.id);
    expect(ids).toContain(world.incidentB.id);
  });

  it("mueve el primario sin tocar el conjunto", async () => {
    actAs(world.root.id);
    const result = await updateUser(
      world.fsrA2.id,
      await formFor(
        world.fsrA2.id,
        [world.clientA.id, world.clientB.id],
        world.clientB.id,
      ),
    );
    expect(result.success).toBe(true);

    const primary = await prisma.userClientAssignment.findFirstOrThrow({
      where: { userId: world.fsrA2.id, active: true, isPrimary: true },
      select: { clientId: true },
    });
    expect(primary.clientId).toBe(world.clientB.id);
  });

  it("al quitar B deja de ver sus incidentes", async () => {
    actAs(world.root.id);
    const result = await updateUser(
      world.fsrA2.id,
      await formFor(world.fsrA2.id, [world.clientA.id], world.clientA.id),
    );
    expect(result.success).toBe(true);

    const leftover = await prisma.userClientAssignment.count({
      where: {
        userId: world.fsrA2.id,
        clientId: world.clientB.id,
        active: true,
      },
    });
    expect(leftover).toBe(0);

    const ids = await worldIncidentIds(world.fsrA2.id);
    expect(ids).toContain(world.incidentA.id);
    expect(ids).not.toContain(world.incidentB.id);
  });

  it("rechaza un primario fuera del conjunto, en español y sin escribir", async () => {
    actAs(world.root.id);
    const result = await updateUser(
      world.fsrA2.id,
      await formFor(world.fsrA2.id, [world.clientA.id], world.clientB.id),
    );
    expect(result).toEqual({
      success: false,
      error: "El Cliente primario debe estar entre los asignados.",
    });

    const assignments = await prisma.userClientAssignment.findMany({
      where: { userId: world.fsrA2.id, active: true },
      select: { clientId: true },
    });
    expect(assignments.map((a) => a.clientId).sort()).toEqual(
      [world.clientA.id].sort(),
    );
  });
});
