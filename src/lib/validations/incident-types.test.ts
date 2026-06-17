import { describe, expect, it } from "vitest";
import { incidentTypeSchema } from "./incident-types";

describe("incidentTypeSchema", () => {
  const valid = { name: "Mecánico", active: true, priority: 5 };

  it("accepts a valid incident type", () => {
    expect(incidentTypeSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty name", () => {
    expect(incidentTypeSchema.safeParse({ ...valid, name: "" }).success).toBe(
      false,
    );
  });

  it("rejects a priority below the minimum", () => {
    expect(
      incidentTypeSchema.safeParse({ ...valid, priority: 0 }).success,
    ).toBe(false);
  });

  it("rejects a priority above the maximum", () => {
    expect(
      incidentTypeSchema.safeParse({ ...valid, priority: 11 }).success,
    ).toBe(false);
  });

  it("rejects a non-integer priority", () => {
    expect(
      incidentTypeSchema.safeParse({ ...valid, priority: 5.5 }).success,
    ).toBe(false);
  });
});
