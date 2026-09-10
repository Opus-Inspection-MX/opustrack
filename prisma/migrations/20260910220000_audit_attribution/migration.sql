-- Audit attribution columns + append-only AuditLog (PR4, RF-550–554).
--
-- Every soft-deletable domain model gains 4 nullable attribution columns
-- (createdById, updatedById, deactivatedAt, deactivatedById). Nullable means
-- NO backfill by design: pre-deploy rows keep NULL = system semantics
-- (spec 11, RF-550). The columns are plain scalars, deliberately NOT Prisma
-- relations (precedent: IncidentEvent.actorId): a DB-level FK to "User"
-- would force 70 back-relation fields onto User and couple deactivation
-- writes to user-row lifetime. Attribution is observability, not authority.
--
-- EXCLUDED per spec 11: Notification (ephemeral, owns isRead/readAt),
-- IncidentEvent (RF-219 trail, no soft delete), ActionIdempotency
-- (observability key, no soft delete), and AuditLog itself (append-only,
-- exempt from soft delete, RF-554).
--
-- Tables carrying @@map use their mapped names below (user_roles,
-- incident_assignees, assignment_assignees, holidays, vacation_statuses,
-- vacations, vacation_accrual_rules); every other table is its model name.
--
-- Hand-written: no local Postgres is available in this environment (Docker
-- down, db:* guard refuses non-local hosts), so `prisma migrate dev` cannot
-- run here. The statements are plain additive ALTERs; the ephemeral-DB e2e
-- lane applies them on next migrate. Verify before deploy:
--   SELECT table_name FROM information_schema.columns
--   WHERE column_name = 'createdById';  -- must list the 35 tables in §1
--
-- Rollback: DROP the AuditLog table/types (§2) and DROP COLUMN the 4
-- attribution columns per table. Reverse order: 5 -> 4 -> 3 -> 2 -> 1b -> 1a.

-- ============================================================================
-- 1. Attribution columns on all 35 soft-deletable models (NULL = system row)
-- ============================================================================
ALTER TABLE "public"."User" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."UserClientAssignment" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."user_roles" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Role" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Permission" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."RolePermission" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."UserStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."UserProfile" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Client" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."State" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Schedule" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."ScheduleClient" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."ScheduleStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."IncidentType" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."IncidentStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."AssignmentStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."EquipmentStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."VehicleStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."VehicleTripStatus" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Incident" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."incident_assignees" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Assignment" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."assignment_assignees" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."AssignmentActivity" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."AssignmentAttachment" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."IncidentAttachment" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Line" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Equipment" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."Vehicle" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."VehicleTrip" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."holidays" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."vacation_statuses" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."vacations" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."vacation_accrual_rules" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;
ALTER TABLE "public"."AssignmentItem" ADD COLUMN "createdById" TEXT, ADD COLUMN "updatedById" TEXT, ADD COLUMN "deactivatedAt" TIMESTAMP(3), ADD COLUMN "deactivatedById" TEXT;

-- ============================================================================
-- 2. AuditLog append-only table (RF-551–554). No `active` flag by design.
-- ============================================================================

-- 2a) Closed vocabularies. Extending either is a migration + spec amendment.
CREATE TYPE "AuditEntity" AS ENUM (
  'CLIENT',
  'INCIDENT',
  'ASSIGNMENT',
  'LINE',
  'EQUIPMENT',
  'VEHICLE',
  'VEHICLE_TRIP',
  'SCHEDULE'
);

CREATE TYPE "AuditAction" AS ENUM (
  'CREATE',
  'UPDATE',
  'DEACTIVATE',
  'ASSIGN',
  'UNASSIGN'
);

-- 2b) Audit rows. actorId is a plain scalar (no FK): attribution must survive
-- user deactivation and must never block a business write.
CREATE TABLE "AuditLog" (
  "id"         TEXT NOT NULL PRIMARY KEY,
  "actorId"    TEXT,
  "entity"     "AuditEntity" NOT NULL,
  "entityId"   TEXT NOT NULL,
  "action"     "AuditAction" NOT NULL,
  "payload"    JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2c) Lookup by audited row, and chronological scans.
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
