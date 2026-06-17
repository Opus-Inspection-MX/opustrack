import { describe, expect, it } from "vitest";
import {
  base64FileSchema,
  baseQuerySchema,
  cuidSchema,
  intIdStringSchema,
  optionalStringSchema,
  paginationSchema,
  prioritySchema,
  slaSchema,
} from "./common";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("cuidSchema", () => {
  it("accepts a valid cuid and rejects junk", () => {
    expect(cuidSchema.safeParse(CUID).success).toBe(true);
    expect(cuidSchema.safeParse("not-a-cuid").success).toBe(false);
  });
});

describe("intIdStringSchema", () => {
  it("transforms a numeric string into a number", () => {
    const result = intIdStringSchema.safeParse("42");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("rejects a non-numeric string", () => {
    expect(intIdStringSchema.safeParse("abc").success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("applies defaults", () => {
    const result = paginationSchema.parse({});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it("rejects a limit above 100", () => {
    expect(paginationSchema.safeParse({ limit: 200 }).success).toBe(false);
  });
});

describe("baseQuerySchema", () => {
  it("coerces string numbers and applies sortOrder default", () => {
    const result = baseQuerySchema.parse({ page: "2", limit: "10" });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
    expect(result.sortOrder).toBe("desc");
  });

  it("rejects an invalid sortOrder", () => {
    expect(baseQuerySchema.safeParse({ sortOrder: "sideways" }).success).toBe(
      false,
    );
  });
});

describe("base64FileSchema", () => {
  const valid = {
    filename: "photo.jpg",
    mimetype: "image/jpeg",
    base64: "AAAA",
    size: 1024,
  };

  it("accepts a valid file payload", () => {
    expect(base64FileSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an invalid mimetype", () => {
    expect(
      base64FileSchema.safeParse({ ...valid, mimetype: "image" }).success,
    ).toBe(false);
  });

  it("rejects a file larger than 10MB", () => {
    expect(
      base64FileSchema.safeParse({ ...valid, size: 11 * 1024 * 1024 }).success,
    ).toBe(false);
  });
});

describe("optionalStringSchema", () => {
  it("transforms an empty string to undefined", () => {
    expect(optionalStringSchema.parse("")).toBeUndefined();
  });

  it("keeps a non-empty string", () => {
    expect(optionalStringSchema.parse("hello")).toBe("hello");
  });
});

describe("prioritySchema", () => {
  it("accepts 1-10 and rejects out-of-range", () => {
    expect(prioritySchema.safeParse(5).success).toBe(true);
    expect(prioritySchema.safeParse(0).success).toBe(false);
    expect(prioritySchema.safeParse(11).success).toBe(false);
  });
});

describe("slaSchema", () => {
  it("accepts 1-720 hours and rejects out-of-range", () => {
    expect(slaSchema.safeParse(720).success).toBe(true);
    expect(slaSchema.safeParse(0).success).toBe(false);
    expect(slaSchema.safeParse(721).success).toBe(false);
  });
});
