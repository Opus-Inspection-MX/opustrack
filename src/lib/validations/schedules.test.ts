import { describe, expect, it } from "vitest";
import { ScheduleCreateSchema } from "./schedules";

describe("ScheduleCreateSchema", () => {
  const valid = {
    title: "Weekly inspection",
    scheduledAt: new Date("2026-06-10T09:00:00.000Z"),
    clienteIds: [],
  };

  it("accepts a valid schedule", () => {
    expect(ScheduleCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a scheduledAt date", () => {
    const { scheduledAt: _omit, ...withoutDate } = valid;
    expect(ScheduleCreateSchema.safeParse(withoutDate).success).toBe(false);
  });

  it("rejects a too-short title", () => {
    expect(
      ScheduleCreateSchema.safeParse({ ...valid, title: "ab" }).success,
    ).toBe(false);
  });

  it("allows an optional null endDate", () => {
    expect(
      ScheduleCreateSchema.safeParse({ ...valid, endDate: null }).success,
    ).toBe(true);
  });
});
