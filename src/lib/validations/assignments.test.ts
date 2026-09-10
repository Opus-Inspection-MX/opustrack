import { describe, expect, it } from "vitest";
import { AssignmentCreateSchema, AssignmentUpdateSchema } from "./assignments";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("AssignmentCreateSchema", () => {
  it("accepts a valid assignment with at least one assignee", () => {
    const result = AssignmentCreateSchema.safeParse({
      incidentId: 1,
      assigneeIds: [CUID],
    });
    expect(result.success).toBe(true);
  });

  it("accepts zero assignees (PENDIENTE_DE_ASIGNACION flow)", () => {
    // The tracking quick-create sends `[]` on purpose; the state machine
    // owns the initial state. A min(1) here broke that flow.
    expect(
      AssignmentCreateSchema.safeParse({ incidentId: 1, assigneeIds: [] })
        .success,
    ).toBe(true);
  });

  it("rejects a non-positive incidentId", () => {
    expect(
      AssignmentCreateSchema.safeParse({ incidentId: 0, assigneeIds: [CUID] })
        .success,
    ).toBe(false);
  });

  it("rejects over-long notes", () => {
    expect(
      AssignmentCreateSchema.safeParse({
        incidentId: 1,
        assigneeIds: [CUID],
        notes: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});

describe("AssignmentUpdateSchema", () => {
  it("allows unassigning everyone (RF-013: 0 assignees)", () => {
    const result = AssignmentUpdateSchema.safeParse({
      id: CUID,
      assigneeIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("requires a valid id", () => {
    expect(
      AssignmentUpdateSchema.safeParse({ id: "bad", assigneeIds: [] }).success,
    ).toBe(false);
  });
});

// NOTE: AssignmentQuerySchema was deleted — no action ever parsed a query
// DTO (list filters travel as typed function params). If a query DTO comes
// back, it must be consumed by an action on arrival (see
// actions-contract.test.ts "every input schema is parsed").
