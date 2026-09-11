import { beforeAll, describe, expect, it } from "vitest";
import {
  createAssignmentActivity,
  updateAssignmentActivity,
} from "@/lib/actions/assignment-activities";
import {
  createAssignmentItem,
  deleteAssignmentItem,
} from "@/lib/actions/assignment-items";
import {
  updateAssignment,
  updateAssignmentOdtFolio,
} from "@/lib/actions/assignments";
import { createEquipment, updateEquipment } from "@/lib/actions/equipments";
import { createIncident, updateIncident } from "@/lib/actions/incidents";
import { createLine, deleteLine, updateLine } from "@/lib/actions/lines";
import { prisma } from "@/lib/database/prisma.singleton";
import { assertNoPasswordKey, capture, isDenial } from "./assertions";
import { MATRIX_IDOR } from "./coverage";
import { createWorld, type IntWorld } from "./fixtures";
import { actAs } from "./session-state";

/**
 * IDOR matrix: every H-04 write, called as the wrong actor.
 *
 * Each case asserts a rejection AND re-reads the row to prove nothing
 * changed; the same action as the correct actor must succeed. The 0c gates
 * are merged, so every case asserts the fixed behavior directly.
 */

const COVERED = new Set([
  "assignments.ts :: updateAssignment",
  "assignments.ts :: updateAssignmentOdtFolio",
  "assignment-items.ts :: createAssignmentItem",
  "assignment-items.ts :: deleteAssignmentItem",
  "assignment-activities.ts :: createAssignmentActivity",
  "assignment-activities.ts :: updateAssignmentActivity",
  "incidents.ts :: createIncident",
  "incidents.ts :: updateIncident",
  "lines.ts :: createLine",
  "lines.ts :: updateLine",
  "lines.ts :: deleteLine",
  "equipments.ts :: createEquipment",
  "equipments.ts :: updateEquipment",
]);

let world: IntWorld;

beforeAll(async () => {
  world = await createWorld("idor");
});

describe("idor matrix registration", () => {
  it("registers every MATRIX_IDOR action in this file", () => {
    const missing = [...MATRIX_IDOR].filter((key) => !COVERED.has(key));
    expect(missing, "MATRIX_IDOR entries without a case here").toEqual([]);
  });
});

describe("assignments", () => {
  // Fixed(0c): updateAssignment checks the permission but never the scope or
  // the assignee — fsrA rewrites B, fsrA2 rewrites work they were not given.
  it("updateAssignment: fsrA cannot rewrite assignment B", async () => {
    const before = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentB.id },
      select: { notes: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateAssignment(world.assignmentB.id, {
        incidentId: world.incidentB.id,
        assigneeIds: [],
        notes: "int-idor-probe",
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentB.id },
      select: { notes: true },
    });
    expect(after).toEqual(before);
  });

  it("updateAssignment: fsrA2 cannot rewrite fsrA's assignment", async () => {
    const before = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentA.id },
      select: { notes: true },
    });
    actAs(world.fsrA2.id);
    const outcome = await capture(() =>
      updateAssignment(world.assignmentA.id, {
        incidentId: world.incidentA.id,
        assigneeIds: [world.fsrA.id],
        notes: "int-idor-probe",
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentA.id },
      select: { notes: true },
    });
    expect(after).toEqual(before);
  });

  it("updateAssignment: opsAll rewrites assignment A", async () => {
    actAs(world.opsAll.id);
    const outcome = await updateAssignment(world.assignmentA.id, {
      incidentId: world.incidentA.id,
      assigneeIds: [world.fsrA.id],
      notes: "int-idor-manager-note",
    });
    expect(outcome).toMatchObject({ success: true });
    const row = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentA.id },
      select: { notes: true },
    });
    expect(row.notes).toBe("int-idor-manager-note");
  });

  it("updateAssignmentOdtFolio: fsrA cannot stamp assignment B", async () => {
    const before = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentB.id },
      select: { odtFolio: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateAssignmentOdtFolio(world.assignmentB.id, "INT-IDOR-PROBE"),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: world.assignmentB.id },
      select: { odtFolio: true },
    });
    expect(after).toEqual(before);
  });

  it("updateAssignmentOdtFolio: opsAll stamps assignment A", async () => {
    actAs(world.opsAll.id);
    const outcome = await updateAssignmentOdtFolio(
      world.assignmentA.id,
      "INT-IDOR-OK",
    );
    expect(outcome).toMatchObject({ success: true });
  });

  // Fixed(0c/H-17): soft-deleted rows stay editable — no `active` check.
  it("updateAssignment: a soft-deleted assignment is rejected", async () => {
    const dead = await prisma.assignment.create({
      data: {
        incidentId: world.incidentA.id,
        statusId: (
          await prisma.assignmentStatus.findUniqueOrThrow({
            where: { name: "ASIGNADO" },
          })
        ).id,
        notes: "int-idor-dead",
        active: false,
      },
      select: { id: true },
    });
    actAs(world.opsAll.id);
    const outcome = await capture(() =>
      updateAssignment(dead.id, {
        incidentId: world.incidentA.id,
        assigneeIds: [],
        notes: "int-idor-probe",
      }),
    );
    expect(isDenial(outcome)).toBe(true);
  });
});

describe("assignment items and activities", () => {
  // Fixed(0c): partidas y actividades solo revisan permiso, nunca scope.
  it("createAssignmentItem: fsrA cannot add to assignment B", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      createAssignmentItem({
        assignmentId: world.assignmentB.id,
        name: "int-idor-part",
        quantity: 1,
        unitPrice: 1,
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    expect(
      await prisma.assignmentItem.findMany({
        where: { assignmentId: world.assignmentB.id, name: "int-idor-part" },
      }),
    ).toEqual([]);
  });

  it("createAssignmentItem: opsAll adds to assignment A", async () => {
    actAs(world.opsAll.id);
    const outcome = await createAssignmentItem({
      assignmentId: world.assignmentA.id,
      name: "int-idor-ok-part",
      quantity: 1,
      unitPrice: 1,
    });
    expect(outcome).toMatchObject({ success: true });
  });

  it("deleteAssignmentItem: fsrA cannot delete item B", async () => {
    const target = await prisma.assignmentItem.create({
      data: {
        assignmentId: world.assignmentB.id,
        name: "int-idor-expendable",
        quantity: 1,
        unitPrice: 1,
      },
      select: { id: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() => deleteAssignmentItem(target.id));
    expect(isDenial(outcome)).toBe(true);
    const row = await prisma.assignmentItem.findUniqueOrThrow({
      where: { id: target.id },
      select: { active: true },
    });
    expect(row.active).toBe(true);
  });

  it("createAssignmentActivity: fsrA cannot add to assignment B", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      createAssignmentActivity({
        assignmentId: world.assignmentB.id,
        description: "int-idor-activity",
      }),
    );
    expect(isDenial(outcome)).toBe(true);
  });

  it("createAssignmentActivity: opsAll adds to assignment A", async () => {
    actAs(world.opsAll.id);
    const outcome = await createAssignmentActivity({
      assignmentId: world.assignmentA.id,
      description: "int-idor-ok-activity",
    });
    expect(outcome).toMatchObject({ success: true });
  });

  it("updateAssignmentActivity: fsrA cannot edit activity B", async () => {
    const before = await prisma.assignmentActivity.findUniqueOrThrow({
      where: { id: world.activityB.id },
      select: { description: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateAssignmentActivity(world.activityB.id, {
        description: "int-idor-probe",
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.assignmentActivity.findUniqueOrThrow({
      where: { id: world.activityB.id },
      select: { description: true },
    });
    expect(after).toEqual(before);
  });
});

describe("incidents", () => {
  // Fixed(0c): createIncident accepts any clientId and any reportedById —
  // cross-client creation plus reporter impersonation in one hole.
  it("createIncident: reporterA cannot file under client B", async () => {
    actAs(world.reporterA.id);
    const outcome = await capture(() =>
      createIncident({
        title: "int-idor probe",
        description: "probe",
        typeId: world.typeId,
        clientId: world.clientB.id,
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    expect(
      await prisma.incident.findMany({
        where: { title: "int-idor probe" },
      }),
    ).toEqual([]);
  });

  it("createIncident: reporterA cannot impersonate another reporter", async () => {
    actAs(world.reporterA.id);
    const outcome = await capture(() =>
      createIncident({
        title: "int-idor impersonation",
        description: "probe",
        typeId: world.typeId,
        clientId: world.clientA.id,
        reportedById: world.fsrA.id,
      }),
    );
    expect(isDenial(outcome)).toBe(true);
  });

  it("createIncident: reporterA files under client A", async () => {
    actAs(world.reporterA.id);
    const outcome = await createIncident({
      title: "int-idor ok incident",
      description: "filed by the test",
      typeId: world.typeId,
      clientId: world.clientA.id,
    });
    expect(outcome).toMatchObject({ success: true });
  });

  // Fixed(0a/H-01): the created incident returns `reportedBy: true`.
  it("createIncident: no response carries a password key", async () => {
    actAs(world.reporterA.id);
    const outcome = await createIncident({
      title: "int-idor password probe",
      description: "probe",
      typeId: world.typeId,
      clientId: world.clientA.id,
    });
    assertNoPasswordKey(outcome);
  });

  // Fixed(0c): updateIncident checks the CURRENT client but not the new one —
  // fsrA moves A's incident to B.
  it("updateIncident: fsrA cannot move incident A to client B", async () => {
    const movable = await prisma.incident.create({
      data: {
        title: "int-idor movable",
        description: "probe",
        typeId: world.typeId,
        statusId: (
          await prisma.incidentStatus.findUniqueOrThrow({
            where: { name: "ABIERTO" },
          })
        ).id,
        clientId: world.clientA.id,
        reportedById: world.reporterA.id,
      },
      select: { id: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateIncident(movable.id, {
        title: "int-idor movable",
        description: "probe",
        typeId: world.typeId,
        clientId: world.clientB.id,
      }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.incident.findUniqueOrThrow({
      where: { id: movable.id },
      select: { clientId: true },
    });
    expect(after.clientId).toBe(world.clientA.id);
  });

  it("updateIncident: opsAll edits incident A", async () => {
    actAs(world.opsAll.id);
    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: world.incidentA.id },
    });
    const outcome = await updateIncident(world.incidentA.id, {
      title: incident.title,
      description: incident.description,
      typeId: incident.typeId,
      clientId: world.clientA.id,
    });
    expect(outcome).toMatchObject({ success: true });
  });

  // Fixed(0a/H-01): the updated incident returns `reportedBy: true`.
  it("updateIncident: no response carries a password key", async () => {
    actAs(world.opsAll.id);
    const incident = await prisma.incident.findUniqueOrThrow({
      where: { id: world.incidentA.id },
    });
    const outcome = await updateIncident(world.incidentA.id, {
      title: incident.title,
      description: incident.description,
      typeId: incident.typeId,
      clientId: world.clientA.id,
    });
    assertNoPasswordKey(outcome);
  });
});

describe("lines and equipments", () => {
  // Fixed(0c): FSR holds lines:*/equipments:* with no scope — any center.
  it("createLine: fsrA cannot create under client B", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      createLine({ name: "int-idor line", clientId: world.clientB.id }),
    );
    expect(isDenial(outcome)).toBe(true);
    expect(
      await prisma.line.findMany({ where: { name: "int-idor line" } }),
    ).toEqual([]);
  });

  it("updateLine: fsrA cannot move line B to client A", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateLine(world.lineB.id, { clientId: world.clientA.id }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.line.findUniqueOrThrow({
      where: { id: world.lineB.id },
      select: { clientId: true },
    });
    expect(after.clientId).toBe(world.clientB.id);
  });

  it("deleteLine: fsrA cannot delete line B", async () => {
    const target = await prisma.line.create({
      data: { name: "int-idor expendable", clientId: world.clientB.id },
      select: { id: true },
    });
    actAs(world.fsrA.id);
    const outcome = await capture(() => deleteLine(target.id));
    expect(isDenial(outcome)).toBe(true);
    const row = await prisma.line.findUniqueOrThrow({
      where: { id: target.id },
      select: { active: true },
    });
    expect(row.active).toBe(true);
  });

  it("createEquipment: fsrA cannot create on line B", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      createEquipment({ name: "int-idor equip", lineId: world.lineB.id }),
    );
    expect(isDenial(outcome)).toBe(true);
  });

  it("updateEquipment: fsrA cannot move equipment B to line A", async () => {
    actAs(world.fsrA.id);
    const outcome = await capture(() =>
      updateEquipment(world.equipmentB.id, { lineId: world.lineA.id }),
    );
    expect(isDenial(outcome)).toBe(true);
    const after = await prisma.equipment.findUniqueOrThrow({
      where: { id: world.equipmentB.id },
      select: { lineId: true },
    });
    expect(after.lineId).toBe(world.lineB.id);
  });
});
