import { describe, expect, it } from "vitest";
import {
  VacationCreateSchema,
  type VacationFormData,
  validateVacationDates,
} from "./vacations";

const start = new Date("2026-07-01T00:00:00.000Z");
const end = new Date("2026-07-10T00:00:00.000Z");

describe("VacationCreateSchema", () => {
  it("accepts a valid date range", () => {
    const result = VacationCreateSchema.safeParse({
      startDate: start,
      endDate: end,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a single-day range (start === end)", () => {
    const result = VacationCreateSchema.safeParse({
      startDate: start,
      endDate: start,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when endDate is before startDate", () => {
    const result = VacationCreateSchema.safeParse({
      startDate: end,
      endDate: start,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing startDate", () => {
    const result = VacationCreateSchema.safeParse({ endDate: end });
    expect(result.success).toBe(false);
  });

  it("accepts an optional reason and rejects an over-long one", () => {
    expect(
      VacationCreateSchema.safeParse({
        startDate: start,
        endDate: end,
        reason: "Vacaciones familiares",
      }).success,
    ).toBe(true);

    expect(
      VacationCreateSchema.safeParse({
        startDate: start,
        endDate: end,
        reason: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("validateVacationDates", () => {
  function form(overrides: Partial<VacationFormData> = {}): VacationFormData {
    return { startDate: start, endDate: end, ...overrides };
  }

  it("passes when endDate is after startDate", () => {
    expect(() => validateVacationDates(form())).not.toThrow();
  });

  it("passes when startDate equals endDate", () => {
    expect(() => validateVacationDates(form({ endDate: start }))).not.toThrow();
  });

  it("throws when endDate is before startDate", () => {
    expect(() =>
      validateVacationDates(form({ startDate: end, endDate: start })),
    ).toThrow(/posterior a la fecha de inicio/);
  });
});
