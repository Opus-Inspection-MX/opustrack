-- Fase 3 (H-08/H-09) - stable `code` for system states and roles.
--
-- Purpose: state and role rows are identified by their editable `name` today,
-- so renaming "ACTIVO" locks everybody out and renaming "FSR"/"CERRADO"
-- silently breaks logic. This migration adds a stable `code` column to the
-- six name-compared status catalogs (IncidentStatus, AssignmentStatus,
-- UserStatus, VacationStatus, VehicleStatus, VehicleTripStatus) plus Role,
-- and backfills `code = name` for system rows only (the names listed in
-- `src/lib/constants/status-codes.ts` and `src/lib/authz/roles.ts`).
-- ScheduleStatus and EquipmentStatus are NOT name-compared anywhere (verified
-- by grep 2026-09-11), so they are out of scope.
--
-- Deploy order: MIGRATION FIRST, CODE SECOND. The change is additive (new
-- nullable column), and the new code reads `code` with a name fallback for
-- rows that predate the backfill — but it FAILS without the column (Prisma
-- selects `code` on those tables). Apply this migration before deploying the
-- code that references `code`.
--
-- Idempotency: every statement is guarded (`ADD COLUMN IF NOT EXISTS`,
-- conditional backfill `WHERE code IS NULL`, unique index `IF NOT EXISTS`),
-- so a half-applied run converges. Safe to re-run after a failed deploy.
--
-- Verification:
--   SELECT tablename FROM pg_tables WHERE tablename IN
--     ('IncidentStatus','AssignmentStatus','UserStatus','VacationStatus',
--      'VehicleStatus','VehicleTripStatus','Role');
--   SELECT name, code FROM "UserStatus" WHERE code IS DISTINCT FROM name;
--     -- expect zero rows for system names (ACTIVO/INACTIVO/SUSPENDIDO);
--     -- custom rows keep code NULL.
--   SELECT name, code FROM "Role" WHERE code IS NULL AND active;
--     -- expect zero rows for the seven seed roles.

ALTER TABLE "UserStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "IncidentStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "AssignmentStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "VacationStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "VehicleStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "VehicleTripStatus" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Role" ADD COLUMN IF NOT EXISTS "code" TEXT;

-- Backfill system rows only: code = name where the name is a known system
-- value and no code was set yet. Custom rows (created from the UI) keep NULL.
UPDATE "UserStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN ('ACTIVO', 'INACTIVO', 'SUSPENDIDO');

UPDATE "IncidentStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN
    ('ABIERTO', 'ASIGNADO', 'VISTO', 'INICIADO', 'EN_PROGRESO', 'CERRADO', 'CANCELADA');

UPDATE "AssignmentStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN
    ('PENDIENTE_DE_ASIGNACION', 'ASIGNADO', 'VISTO', 'INICIADO', 'EN_PROGRESO', 'CERRADO');

UPDATE "VacationStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN ('PENDIENTE', 'APROBADA', 'RECHAZADA');

UPDATE "VehicleStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE');

UPDATE "VehicleTripStatus" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN ('EN_CURSO', 'COMPLETADO', 'CANCELADO');

UPDATE "Role" SET "code" = "name"
  WHERE "code" IS NULL AND "name" IN
    ('ROOT', 'ADMIN_OPERACION', 'ADMIN_VACACIONES', 'FSR', 'EMPLEADO', 'REPORTER', 'GUEST');

-- Uniqueness per Prisma `code String? @unique` (NULLs never collide).
CREATE UNIQUE INDEX IF NOT EXISTS "UserStatus_code_key" ON "UserStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "IncidentStatus_code_key" ON "IncidentStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "AssignmentStatus_code_key" ON "AssignmentStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "VacationStatus_code_key" ON "VacationStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleStatus_code_key" ON "VehicleStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleTripStatus_code_key" ON "VehicleTripStatus"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Role_code_key" ON "Role"("code");
