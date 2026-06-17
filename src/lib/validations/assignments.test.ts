import { describe, expect, it } from "vitest";
import {
  AssignmentCreateSchema,
  AssignmentQuerySchema,
  AssignmentUpdateSchema,
} from "./assignments";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("AssignmentCreateSchema", () => {
  it("accepts a valid assignment with at least one assignee", () => {
    const result = AssignmentCreateSchema.safeParse({
      incidentId: 1,
      assigneeIds: [CUID],
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one assignee", () => {
    expect(
      AssignmentCreateSchema.safeParse({ incidentId: 1, assigneeIds: [] })
        .success,
    ).toBe(false);
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

describe("AssignmentQuerySchema", () => {
  it("defaults sortBy to createdAt", () => {
    const result = AssignmentQuerySchema.parse({});
    expect(result.sortBy).toBe("createdAt");
  });

  it("coerces numeric query params", () => {
    const result = AssignmentQuerySchema.parse({ incidentId: "7" });
    expect(result.incidentId).toBe(7);
  });
});
