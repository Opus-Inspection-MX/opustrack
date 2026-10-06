import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("declares matching historical funding identity and disables unlinked allocations offline", () => {
  const schema = readFileSync(resolve("prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    resolve(
      "prisma/migrations/20261005000001_historical_vacation_consumption/migration.sql",
    ),
    "utf8",
  );

  expect(schema).toMatch(/@@unique\(\[id, userId, cycleYear\]\)/);
  expect(schema).toMatch(
    /@relation\(fields: \[fundingPeriodId, userId, cycleYear\], references: \[id, userId, cycleYear\]/,
  );
  expect(migration).toMatch(
    /CREATE UNIQUE INDEX "vacation_periods_id_userId_cycleYear_key"\s+ON "public"\."vacation_periods"\("id", "userId", "cycleYear"\)/,
  );
  expect(migration).toMatch(
    /FOREIGN KEY \("fundingPeriodId", "userId", "cycleYear"\)\s+REFERENCES "public"\."vacation_periods"\("id", "userId", "cycleYear"\)/,
  );
  expect(migration).toMatch(/"allocatedToDatedDays" = 0/);
  expect(migration).toMatch(
    /"reviewStatus" <> 'APPROVED' OR \(\s*"identityVerified" AND "fundingPeriodId" IS NOT NULL\s+AND "sourceEntitledDays" >= "sourceTakenDays"\s+AND "sourceEntitledDays"::BIGINT - "sourceTakenDays"::BIGINT = "sourceRemainingDays"::BIGINT/,
  );
});
