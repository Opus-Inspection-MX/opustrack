import { describe, expect, it } from "vitest";
import {
  HolidayCreateSchema,
  type HolidayFormData,
  validateHolidayXOR,
} from "./holidays";

/** Minimal valid fixed-date holiday payload. */
function fixedDate(overrides: Partial<HolidayFormData> = {}): HolidayFormData {
  return {
    name: "Año Nuevo",
    month: 1,
    day: 1,
    isRecurring: true,
    ...overrides,
  };
}

describe("HolidayCreateSchema", () => {
  it("accepts a valid fixed-date recurring holiday", () => {
    const result = HolidayCreateSchema.safeParse(fixedDate());
    expect(result.success).toBe(true);
  });

  it("accepts a valid n-th Monday holiday", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Constitución",
      month: 2,
      nthMonday: 1,
      isRecurring: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when both day and nthMonday are set (XOR)", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Bad",
      month: 2,
      day: 5,
      nthMonday: 1,
      isRecurring: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when neither day nor nthMonday is set", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Bad",
      month: 2,
      isRecurring: true,
    });
    expect(result.success).toBe(false);
  });

  it("requires a year for one-time (non-recurring) holidays", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Transmisión de poder",
      month: 10,
      day: 1,
      isRecurring: false,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a one-time holiday when a year is provided", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Transmisión de poder",
      month: 10,
      day: 1,
      isRecurring: false,
      year: 2024,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range month", () => {
    expect(
      HolidayCreateSchema.safeParse(fixedDate({ month: 13 })).success,
    ).toBe(false);
    expect(HolidayCreateSchema.safeParse(fixedDate({ month: 0 })).success).toBe(
      false,
    );
  });

  it("rejects a too-short name", () => {
    expect(
      HolidayCreateSchema.safeParse(fixedDate({ name: "A" })).success,
    ).toBe(false);
  });

  it("rejects an out-of-range nthMonday", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Bad",
      month: 2,
      nthMonday: 6,
      isRecurring: true,
    });
    expect(result.success).toBe(false);
  });

  it("defaults isRecurring to true when omitted", () => {
    const result = HolidayCreateSchema.safeParse({
      name: "Año Nuevo",
      month: 1,
      day: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isRecurring).toBe(true);
    }
  });
});

describe("validateHolidayXOR", () => {
  it("passes for a valid fixed-date holiday", () => {
    expect(() => validateHolidayXOR(fixedDate())).not.toThrow();
  });

  it("passes for a valid n-th Monday holiday", () => {
    expect(() =>
      validateHolidayXOR({
        name: "Constitución",
        month: 2,
        nthMonday: 1,
        isRecurring: true,
      }),
    ).not.toThrow();
  });

  it("throws when both day and nthMonday are set", () => {
    expect(() =>
      validateHolidayXOR({
        name: "Bad",
        month: 2,
        day: 5,
        nthMonday: 1,
        isRecurring: true,
      }),
    ).toThrow(/no ambos/);
  });

  it("throws when neither day nor nthMonday is set", () => {
    expect(() =>
      validateHolidayXOR({ name: "Bad", month: 2, isRecurring: true }),
    ).toThrow(/día fijo o un lunes/);
  });

  it("throws when a one-time holiday is missing its year", () => {
    expect(() =>
      validateHolidayXOR({
        name: "Transmisión",
        month: 10,
        day: 1,
        isRecurring: false,
      }),
    ).toThrow(/año/);
  });

  it("does not throw for a one-time holiday with a year", () => {
    expect(() =>
      validateHolidayXOR({
        name: "Transmisión",
        month: 10,
        day: 1,
        isRecurring: false,
        year: 2024,
      }),
    ).not.toThrow();
  });
});
