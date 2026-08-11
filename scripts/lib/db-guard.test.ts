import { describe, expect, it } from "vitest";
import {
  assertLocalDatabase,
  isLocalDatabase,
  maskDatabaseUrl,
  parseDatabaseUrl,
} from "./db-guard";

const LOCAL =
  "postgresql://postgres:postgres@localhost:5432/opustrack?schema=public";
const HOSTED =
  "postgresql://owner:npg_secret@ep-example-0000-pooler.us-east-2.aws.neon.tech/appdb?sslmode=require";

describe("assertLocalDatabase", () => {
  it("accepts the local container", () => {
    expect(() => assertLocalDatabase(LOCAL)).not.toThrow();
  });

  it("accepts the compose service host and the loopback addresses", () => {
    // Inside the compose network the app reaches Postgres as `db`, not localhost.
    for (const host of ["db", "127.0.0.1", "[::1]"]) {
      expect(() =>
        assertLocalDatabase(`postgresql://u:p@${host}:5432/opustrack`),
      ).not.toThrow();
    }
  });

  it("rejects a hosted database — the case that matters", () => {
    // db:reset against Neon is exactly the accident this prevents.
    expect(() => assertLocalDatabase(HOSTED)).toThrow(/solo puede correr/);
  });

  it("rejects a missing or malformed URL", () => {
    expect(() => assertLocalDatabase(undefined)).toThrow(/DATABASE_URL/);
    expect(() => assertLocalDatabase("")).toThrow(/DATABASE_URL/);
    expect(() => assertLocalDatabase("not-a-url")).toThrow(/DATABASE_URL/);
  });

  it("never leaks the password in the error message", () => {
    try {
      assertLocalDatabase(HOSTED);
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain("npg_secret");
      expect((error as Error).message).toContain("neon.tech");
    }
  });
});

describe("isLocalDatabase", () => {
  it("answers without throwing", () => {
    expect(isLocalDatabase(LOCAL)).toBe(true);
    expect(isLocalDatabase(HOSTED)).toBe(false);
    expect(isLocalDatabase("not-a-url")).toBe(false);
    expect(isLocalDatabase(undefined)).toBe(false);
  });
});

describe("parseDatabaseUrl", () => {
  it("returns the parsed URL", () => {
    expect(parseDatabaseUrl(LOCAL).hostname).toBe("localhost");
    expect(parseDatabaseUrl(LOCAL).port).toBe("5432");
  });
});

describe("maskDatabaseUrl", () => {
  it("masks credentials but keeps host and database", () => {
    expect(maskDatabaseUrl(LOCAL)).toBe(
      "postgresql://***:***@localhost:5432/opustrack",
    );
  });

  it("returns a placeholder for unusable input", () => {
    expect(maskDatabaseUrl(undefined)).toBe("<vacía>");
    expect(maskDatabaseUrl("not-a-url")).toBe("<inválida>");
  });
});
