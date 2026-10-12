-- Additive migration: retain all existing observations and period snapshots.
ALTER TABLE "Vehicle" ADD COLUMN "operationalStatusCode" TEXT NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN "odometerBaseline" INTEGER, ADD COLUMN "odometerBaselineAt" TIMESTAMP(3);
UPDATE "Vehicle" v SET "operationalStatusCode" = s.code
FROM "VehicleStatus" s WHERE v."statusId" = s.id AND s.code IN ('MAINTENANCE', 'INACTIVE');
ALTER TABLE "VehicleTrip" ADD COLUMN "startCapturedAt" TIMESTAMP(3),
  ADD COLUMN "endCapturedAt" TIMESTAMP(3), ADD COLUMN "startExceptionReason" TEXT,
  ADD COLUMN "cancellationReason" TEXT, ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "vacations" ADD COLUMN "chargedDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "correctionHistory" JSONB;
ALTER TABLE "action_idempotency" ADD COLUMN "actorId" TEXT, ADD COLUMN "requestTargetId" TEXT;
CREATE TABLE "business_corrections" (
  "id" TEXT PRIMARY KEY, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL, "reason" TEXT NOT NULL, "before" JSONB NOT NULL,
  "after" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "business_corrections_entityType_entityId_createdAt_idx"
  ON "business_corrections" ("entityType", "entityId", "createdAt");

CREATE FUNCTION preserve_business_correction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Business corrections are append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER business_corrections_append_only
  BEFORE UPDATE OR DELETE ON "business_corrections"
  FOR EACH ROW EXECUTE FUNCTION preserve_business_correction();
