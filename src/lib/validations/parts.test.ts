import { describe, expect, it } from "vitest";
import { PartCreateSchema, WorkPartCreateSchema } from "./parts";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("PartCreateSchema", () => {
  const valid = { name: "Brake pad", price: 250.5, stock: 10 };

  it("accepts a valid part", () => {
    expect(PartCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a non-positive price", () => {
    expect(PartCreateSchema.safeParse({ ...valid, price: 0 }).success).toBe(
      false,
    );
    expect(PartCreateSchema.safeParse({ ...valid, price: -5 }).success).toBe(
      false,
    );
  });

  it("rejects negative stock", () => {
    expect(PartCreateSchema.safeParse({ ...valid, stock: -1 }).success).toBe(
      false,
    );
  });

  it("rejects non-integer stock", () => {
    expect(PartCreateSchema.safeParse({ ...valid, stock: 2.5 }).success).toBe(
      false,
    );
  });

  it("rejects a too-short name", () => {
    expect(PartCreateSchema.safeParse({ ...valid, name: "B" }).success).toBe(
      false,
    );
  });
});

describe("WorkPartCreateSchema", () => {
  it("accepts a valid work part", () => {
    expect(
      WorkPartCreateSchema.safeParse({ partId: CUID, quantity: 2 }).success,
    ).toBe(true);
  });

  it("requires a quantity of at least 1", () => {
    expect(
      WorkPartCreateSchema.safeParse({ partId: CUID, quantity: 0 }).success,
    ).toBe(false);
  });
});
