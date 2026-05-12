-- State machine v1: "Visto" rename + GPS fields + status catalog backfill.

-- ============================================================================
-- 1. Assignment: rename unlockedAt → seenAt and its index
-- ============================================================================
ALTER TABLE "Assignment" RENAME COLUMN "unlockedAt" TO "seenAt";
ALTER INDEX "Assignment_unlockedAt_idx" RENAME TO "Assignment_seenAt_idx";

-- ============================================================================
-- 2. Assignment: add seenById FK (who first acknowledged the assignment)
-- ============================================================================
ALTER TABLE "Assignment" ADD COLUMN "seenById" TEXT;
ALTER TABLE "Assignment"
  ADD CONSTRAINT "Assignment_seenById_fkey"
  FOREIGN KEY ("seenById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Assignment_seenById_idx" ON "Assignment"("seenById");

-- ============================================================================
-- 3. Assignment: add GPS columns (start + end)
-- ============================================================================
ALTER TABLE "Assignment" ADD COLUMN "startLatitude"  DOUBLE PRECISION;
ALTER TABLE "Assignment" ADD COLUMN "startLongitude" DOUBLE PRECISION;
ALTER TABLE "Assignment" ADD COLUMN "startAddress"   TEXT;
ALTER TABLE "Assignment" ADD COLUMN "endLatitude"    DOUBLE PRECISION;
ALTER TABLE "Assignment" ADD COLUMN "endLongitude"   DOUBLE PRECISION;
ALTER TABLE "Assignment" ADD COLUMN "endAddress"     TEXT;

-- ============================================================================
-- 4. IncidentStatus backfill
--    Target set: ABIERTO, ASIGNADO, VISTO, INICIADO, CERRADO.
--    Strategy: rename EN_PROGRESO→INICIADO so existing FKs keep pointing at the
--    same row; deactivate the legacy PENDIENTE (Incident-side) — admins can
--    re-enable it from the CRUD if they need it. ASIGNADO and VISTO are net-new.
-- ============================================================================
UPDATE "IncidentStatus" SET "name" = 'INICIADO', "color" = '#3B82F6'
  WHERE "name" = 'EN_PROGRESO';
UPDATE "IncidentStatus" SET "active" = false
  WHERE "name" = 'PENDIENTE';
INSERT INTO "IncidentStatus" ("name", "color", "active")
  VALUES ('ASIGNADO', '#8B5CF6', true)
  ON CONFLICT ("name") DO UPDATE SET "active" = true, "color" = '#8B5CF6';
INSERT INTO "IncidentStatus" ("name", "color", "active")
  VALUES ('VISTO', '#06B6D4', true)
  ON CONFLICT ("name") DO UPDATE SET "active" = true, "color" = '#06B6D4';
UPDATE "IncidentStatus" SET "color" = '#94A3B8' WHERE "name" = 'ABIERTO';
UPDATE "IncidentStatus" SET "color" = '#10B981' WHERE "name" = 'CERRADO';

-- ============================================================================
-- 5. AssignmentStatus backfill
--    Target set: PENDIENTE_DE_ASIGNACION, ASIGNADO, VISTO, INICIADO,
--    PENDIENTE (intermediate post-INICIADO), CERRADO.
-- ============================================================================
UPDATE "AssignmentStatus" SET "name" = 'PENDIENTE_DE_ASIGNACION', "color" = '#94A3B8'
  WHERE "name" = 'PENDIENTE';
UPDATE "AssignmentStatus" SET "name" = 'INICIADO', "color" = '#3B82F6'
  WHERE "name" = 'EN_PROGRESO';
UPDATE "AssignmentStatus" SET "name" = 'CERRADO', "color" = '#10B981'
  WHERE "name" = 'COMPLETADO';
UPDATE "AssignmentStatus" SET "active" = false
  WHERE "name" = 'CANCELADO';
UPDATE "AssignmentStatus" SET "color" = '#8B5CF6' WHERE "name" = 'ASIGNADO';
INSERT INTO "AssignmentStatus" ("name", "color", "active")
  VALUES ('VISTO', '#06B6D4', true)
  ON CONFLICT ("name") DO UPDATE SET "active" = true, "color" = '#06B6D4';
INSERT INTO "AssignmentStatus" ("name", "color", "active")
  VALUES ('PENDIENTE', '#F59E0B', true)
  ON CONFLICT ("name") DO UPDATE SET "active" = true, "color" = '#F59E0B';
