import { describe, expect, it } from "vitest";
import {
  BulkIncidentSnapshotRowSchema,
  IncidentClientCreateSchema,
  IncidentCreateSchema,
  parseAssigneeIds,
} from "./incidents";

describe("IncidentCreateSchema", () => {
  it("accepts a minimal valid incident", () => {
    const result = IncidentCreateSchema.safeParse({
      title: "Brake failure",
      description: "Pad worn out",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a too-short title", () => {
    expect(
      IncidentCreateSchema.safeParse({ title: "ab", description: "x" }).success,
    ).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(
      IncidentCreateSchema.safeParse({ title: "Valid title", description: "" })
        .success,
    ).toBe(false);
  });
});

describe("IncidentClientCreateSchema", () => {
  it("accepts an incident without a type (server falls back to Desconocido)", () => {
    const result = IncidentClientCreateSchema.safeParse({
      title: "Light out",
      description: "Lane 3 light not working",
    });
    expect(result.success).toBe(true);
  });
});

describe("parseAssigneeIds", () => {
  it("returns an empty array for undefined", () => {
    expect(parseAssigneeIds()).toEqual([]);
  });

  it("splits, trims, and drops blanks", () => {
    expect(parseAssigneeIds("a, b ,,c ")).toEqual(["a", "b", "c"]);
  });
});

describe("BulkIncidentSnapshotRowSchema", () => {
  it("coerces an empty optional int to undefined", () => {
    const result = BulkIncidentSnapshotRowSchema.parse({
      title: "Valid title",
      description: "desc",
      typeId: "",
    });
    expect(result.typeId).toBeUndefined();
  });

  it("coerces a numeric string into a number", () => {
    const result = BulkIncidentSnapshotRowSchema.parse({
      title: "Valid title",
      description: "desc",
      typeId: "5",
    });
    expect(result.typeId).toBe(5);
  });

  it("parses a valid date string into a Date", () => {
    const result = BulkIncidentSnapshotRowSchema.parse({
      title: "Valid title",
      description: "desc",
      startedAt: "2026-01-15",
    });
    expect(result.startedAt).toBeInstanceOf(Date);
  });

  it("rejects an unparseable date", () => {
    const result = BulkIncidentSnapshotRowSchema.safeParse({
      title: "Valid title",
      description: "desc",
      startedAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});
