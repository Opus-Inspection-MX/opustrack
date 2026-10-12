import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma.singleton";

describe("documented read-only business reconciliation", () => {
  it("executes the documented anomaly reads in a read-only PostgreSQL snapshot", async () => {
    const document = readFileSync("docs/business-invariants.md", "utf8");
    const sql = document.match(/```sql\n([\s\S]*?)\n```/)?.[1];
    expect(sql).toBeTruthy();
    const statements = (sql ?? "")
      .replace(/--[^\n]*/g, "")
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean);
    expect(statements[0]).toMatch(/^BEGIN.*READ ONLY$/);
    expect(statements.at(-1)).toBe("ROLLBACK");
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        for (const statement of statements.slice(1, -1)) {
          expect(statement).toMatch(/^(SELECT|WITH)\b/);
          expect(await tx.$queryRawUnsafe(statement)).toBeInstanceOf(Array);
        }
      },
      { isolationLevel: "RepeatableRead" },
    );
  });

  it("database rejects rewriting or deleting correction evidence", async () => {
    const correction = await prisma.businessCorrection.create({
      data: {
        entityType: "IntegrationFixture",
        entityId: randomUUID(),
        actorId: "fixture",
        reason: "Append-only evidence verification",
        before: {},
        after: {},
      },
    });
    await expect(
      prisma.businessCorrection.update({
        where: { id: correction.id },
        data: { reason: "Rewritten" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.businessCorrection.delete({ where: { id: correction.id } }),
    ).rejects.toThrow();
    expect(
      (
        await prisma.businessCorrection.findUniqueOrThrow({
          where: { id: correction.id },
        })
      ).reason,
    ).toBe("Append-only evidence verification");
  });
});
