-- Additive offline ledger; no legacy periods, requests or balances are changed.
-- A nullable legacy cycleYear cannot match the non-null cycleYear on a ledger row.
CREATE UNIQUE INDEX "vacation_periods_id_userId_cycleYear_key"
  ON "public"."vacation_periods"("id", "userId", "cycleYear");

CREATE TYPE "public"."HistoricalVacationReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "public"."historical_vacation_consumption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleYear" INTEGER NOT NULL,
    "fundingPeriodId" TEXT,
    "sourceDigest" TEXT NOT NULL,
    "sourceSheet" TEXT NOT NULL,
    "sourceRow" INTEGER NOT NULL,
    "sourceEntitledDays" INTEGER NOT NULL,
    "sourceTakenDays" INTEGER NOT NULL,
    "sourceRemainingDays" INTEGER NOT NULL,
    "allocatedToDatedDays" INTEGER NOT NULL DEFAULT 0,
    "identityVerified" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "public"."HistoricalVacationReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "historical_vacation_consumption_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "historical_vacation_consumption_values_check" CHECK (
      "cycleYear" BETWEEN 1000 AND 9998 AND "sourceRow" > 0
      AND "sourceEntitledDays" >= 0 AND "sourceTakenDays" >= 0
      AND "sourceRemainingDays" >= 0 AND "allocatedToDatedDays" = 0
      AND length("sourceSheet") > 0 AND "sourceDigest" ~ '^[0-9a-f]{64}$'
      AND ("reviewStatus" <> 'APPROVED' OR (
        "identityVerified" AND "fundingPeriodId" IS NOT NULL
        AND "sourceEntitledDays" >= "sourceTakenDays"
        AND "sourceEntitledDays"::BIGINT - "sourceTakenDays"::BIGINT = "sourceRemainingDays"::BIGINT
      ))
    )
);

CREATE UNIQUE INDEX "historical_vacation_consumption_sourceDigest_sourceSheet_sourceRow_key"
  ON "public"."historical_vacation_consumption"("sourceDigest", "sourceSheet", "sourceRow");
CREATE UNIQUE INDEX "historical_vacation_consumption_userId_cycleYear_key"
  ON "public"."historical_vacation_consumption"("userId", "cycleYear");
CREATE INDEX "historical_vacation_consumption_fundingPeriodId_idx"
  ON "public"."historical_vacation_consumption"("fundingPeriodId");
ALTER TABLE "public"."historical_vacation_consumption"
  ADD CONSTRAINT "historical_vacation_consumption_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."historical_vacation_consumption"
  ADD CONSTRAINT "historical_vacation_consumption_fundingPeriodId_fkey"
  FOREIGN KEY ("fundingPeriodId", "userId", "cycleYear")
  REFERENCES "public"."vacation_periods"("id", "userId", "cycleYear")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
