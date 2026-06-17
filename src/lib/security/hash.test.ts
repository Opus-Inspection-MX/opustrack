import { describe, expect, it } from "vitest";
import { comparePasswords, hashPassword } from "./hash";

describe("hashPassword / comparePasswords", () => {
  it("produces a hash that differs from the plaintext", async () => {
    const hash = await hashPassword("password123");
    expect(hash).not.toBe("password123");
    expect(hash.length).toBeGreaterThan(0);
  });

  it("verifies the correct password", async () => {
    const hash = await hashPassword("password123");
    expect(await comparePasswords("password123", hash)).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("password123");
    expect(await comparePasswords("wrong-password", hash)).toBe(false);
  });

  it("produces different hashes for the same input (random salt)", async () => {
    const a = await hashPassword("samePassword");
    const b = await hashPassword("samePassword");
    expect(a).not.toBe(b);
  });
});
