import { afterEach, describe, expect, it } from "vitest";
import {
  assertEphemeralDatabase,
  EPHEMERAL_DB_NAME,
  maskDatabaseUrl,
} from "./ephemeral-db";

const OK = `postgresql://opustrack_e2e:opustrack_e2e@localhost:5433/${EPHEMERAL_DB_NAME}?schema=public`;

afterEach(() => {
  process.env.E2E_DB_PORT = undefined;
  delete process.env.E2E_DB_PORT;
});

describe("assertEphemeralDatabase", () => {
  it("accepts the throwaway container URL", () => {
    expect(() => assertEphemeralDatabase(OK)).not.toThrow();
  });

  it("accepts 127.0.0.1 as well as localhost", () => {
    expect(() =>
      assertEphemeralDatabase(OK.replace("localhost", "127.0.0.1")),
    ).not.toThrow();
  });

  it("rejects a missing URL", () => {
    expect(() => assertEphemeralDatabase(undefined)).toThrow(/DATABASE_URL/);
    expect(() => assertEphemeralDatabase("")).toThrow(/DATABASE_URL/);
  });

  it("rejects a remote host — the case that matters", () => {
    // This project's .env.development points at a hosted Postgres, so a suite
    // that inherited the shell environment would run against the cloud. The
    // host below is a stand-in: never put a real endpoint in a test fixture.
    const hosted =
      "postgresql://user:pw@ep-example-0000-pooler.us-east-2.aws.neon.tech/appdb?sslmode=require";
    expect(() => assertEphemeralDatabase(hosted)).toThrow(
      /no es la base efímera/,
    );
  });

  it("rejects a local database with the wrong name", () => {
    expect(() =>
      assertEphemeralDatabase(
        "postgresql://u:p@localhost:5433/opustrack_dev?schema=public",
      ),
    ).toThrow(/no es la base efímera/);
  });

  it("rejects the right name on the wrong port", () => {
    // 5432 is usually a real local Postgres.
    expect(() =>
      assertEphemeralDatabase(
        `postgresql://u:p@localhost:5432/${EPHEMERAL_DB_NAME}`,
      ),
    ).toThrow(/no es la base efímera/);
  });

  it("honours a custom E2E_DB_PORT", () => {
    process.env.E2E_DB_PORT = "6543";
    expect(() =>
      assertEphemeralDatabase(
        `postgresql://u:p@localhost:6543/${EPHEMERAL_DB_NAME}`,
      ),
    ).not.toThrow();
    expect(() => assertEphemeralDatabase(OK)).toThrow(/no es la base efímera/);
  });

  it("rejects a malformed URL", () => {
    expect(() => assertEphemeralDatabase("not-a-url")).toThrow(/DATABASE_URL/);
  });

  it("never leaks the password in the error message", () => {
    const secret = "sup3r-s3cret-pw";
    try {
      assertEphemeralDatabase(
        `postgresql://user:${secret}@db.example.com/prod`,
      );
      throw new Error("should have thrown");
    } catch (error) {
      expect((error as Error).message).not.toContain(secret);
      expect((error as Error).message).toContain("db.example.com");
    }
  });
});

describe("maskDatabaseUrl", () => {
  it("masks the credentials but keeps host and database", () => {
    expect(maskDatabaseUrl(OK)).toBe(
      `postgresql://***:***@localhost:5433/${EPHEMERAL_DB_NAME}`,
    );
  });

  it("returns a placeholder for an unparseable value", () => {
    expect(maskDatabaseUrl("not-a-url")).toBe("<inválida>");
    expect(maskDatabaseUrl(undefined)).toBe("<vacía>");
  });
});
