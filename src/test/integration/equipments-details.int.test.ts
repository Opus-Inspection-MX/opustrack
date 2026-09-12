import { beforeAll, describe, expect, it } from "vitest";
import {
  createEquipment,
  getEquipmentById,
  updateEquipment,
} from "@/lib/actions/equipments";
import { prisma } from "@/lib/database/prisma.singleton";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * Equipment data (G-4): model, serial number and catalog status travel
 * through the action and the detail read.
 */

let world: IntWorld;
let statusId: number;

beforeAll(async () => {
  world = await createWorld("equipment");
  const status = await prisma.equipmentStatus.findFirstOrThrow({
    where: { active: true },
    select: { id: true },
  });
  statusId = status.id;
});

describe("el equipo expone modelo, serie y estado", () => {
  it("crear guarda los tres y el detalle los devuelve", async () => {
    actAs(world.root.id);
    const created = await createEquipment({
      name: "int-equipment-g4",
      lineId: world.lineA.id,
      model: "GAS-9000",
      serialNumber: "SN-0001",
      statusId,
    });
    expect(created.success).toBe(true);
    if (created.success !== true) return;
    const equipmentId = created.equipment.id;

    const detail = await getEquipmentById(equipmentId);
    expect(detail.model).toBe("GAS-9000");
    expect(detail.serialNumber).toBe("SN-0001");
    expect(detail.status.id).toBe(statusId);
  });

  it("editar cambia los tres", async () => {
    actAs(world.root.id);
    const created = await createEquipment({
      name: "int-equipment-g4-edit",
      lineId: world.lineA.id,
    });
    expect(created.success).toBe(true);
    if (created.success !== true) return;
    const equipmentId = created.equipment.id;

    const updated = await updateEquipment(equipmentId, {
      model: "GAS-9100",
      serialNumber: "SN-0002",
      statusId,
    });
    expect(updated.success).toBe(true);

    const detail = await getEquipmentById(equipmentId);
    expect(detail.model).toBe("GAS-9100");
    expect(detail.serialNumber).toBe("SN-0002");
    expect(detail.status.id).toBe(statusId);
  });

  it("un estado inexistente se rechaza en español sin escribir", async () => {
    actAs(world.root.id);
    const created = await createEquipment({
      name: "int-equipment-g4-bad",
      lineId: world.lineA.id,
    });
    expect(created.success).toBe(true);
    if (created.success !== true) return;
    const equipmentId = created.equipment.id;

    const result = await updateEquipment(equipmentId, { statusId: 999_999 });
    expect(result).toEqual({
      success: false,
      error: "El estado de equipo seleccionado no existe.",
    });
  });
});
