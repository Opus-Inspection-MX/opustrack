-- Additive foundation only: existing anniversary periods remain unchanged.
-- PostgreSQL permits multiple NULL cycleYear values per user (legacy rows).
ALTER TABLE "public"."vacation_periods"
  ADD COLUMN "cycleYear" INTEGER,
  ADD COLUMN "availableFrom" TIMESTAMP(3);

CREATE UNIQUE INDEX "vacation_periods_userId_cycleYear_key"
  ON "public"."vacation_periods"("userId", "cycleYear");
