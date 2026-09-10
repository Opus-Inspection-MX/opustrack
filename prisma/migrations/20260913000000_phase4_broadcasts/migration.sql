-- Phase 4 broadcasts (schema only, no data migration).
--
-- What moves here, and why it is one migration:
-- - `broadcasts`: persisted broadcasts (immediate or scheduled) with `title`,
--   `message`, `kind` (SYSTEM/ANNOUNCEMENT), per-broadcast channel switches
--   (`sendInApp`/`sendEmail` — these override the event matrix, which stays
--   for automatic events only), `allRoles`, `includeSender`, `scheduledAt`
--   (UTC; the UI converts a CDMX wall clock with `fromDatetimeLocalMX`),
--   `status` (PROGRAMADA/ENVIANDO/ENVIADA/CANCELADA/FALLIDA), `sentAt`,
--   `recipientCount`, `createdById`, `active`.
-- - `broadcast_roles`: `Broadcast ↔ Role` audience pivot (multi-role
--   selection). Recipients resolve AT SEND TIME from these rows, never at
--   creation, so a scheduled broadcast reaches whoever holds the roles when
--   the cron fires.
-- - `Role.broadcastRoles` back-relation: schema-only, no column (Prisma
--   requires the opposite field for `BroadcastRole.role`).
--
-- Deliberately NOT here:
-- - `role_broadcast_targets` (Phase 1) is adopted UNCHANGED — sender scope
--   keeps working with the constraint names Prisma generated.
-- - `email_outbox.broadcastId` (Phase 2) stays a plain string with no FK: the
--   outbox write path only stores the id, it never joins through it.
--
-- Idempotency: types/tables/indexes are created with IF NOT EXISTS guards and
-- FK/unique constraints through a DO block probing pg_constraint, mirroring
-- `20260911000000_phase1_notifications_rbac`. Safe to re-run after a failed
-- deploy.
--
-- Identifier provenance (checked against generated DDL, never a local DB):
-- `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
-- --script` output for this schema — enum labels, column names/types/defaults
-- and every constraint/index name below match it verbatim.
--
-- NOT applied here (no Docker in this environment): run `npm run db:migrate`
-- where the database runs, then `npm run db:drift` to confirm no drift.

-- ============================================================================
-- 1. New enums
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BroadcastKind') THEN
        CREATE TYPE "public"."BroadcastKind" AS ENUM ('SYSTEM', 'ANNOUNCEMENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BroadcastStatus') THEN
        CREATE TYPE "public"."BroadcastStatus" AS ENUM ('PROGRAMADA', 'ENVIANDO', 'ENVIADA', 'CANCELADA', 'FALLIDA');
    END IF;
END $$;

-- ============================================================================
-- 2. New tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."broadcasts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "kind" "public"."BroadcastKind" NOT NULL DEFAULT 'SYSTEM',
    "sendInApp" BOOLEAN NOT NULL DEFAULT true,
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "allRoles" BOOLEAN NOT NULL DEFAULT false,
    "includeSender" BOOLEAN NOT NULL DEFAULT false,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."BroadcastStatus" NOT NULL DEFAULT 'PROGRAMADA',
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcasts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."broadcast_roles" (
    "id" SERIAL NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_roles_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 3. Constraints (Prisma-generated names, probed before adding)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_roles_broadcastId_roleId_key'
    ) THEN
        ALTER TABLE "public"."broadcast_roles"
            ADD CONSTRAINT "broadcast_roles_broadcastId_roleId_key"
            UNIQUE ("broadcastId", "roleId");
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_roles_broadcastId_fkey'
    ) THEN
        ALTER TABLE "public"."broadcast_roles"
            ADD CONSTRAINT "broadcast_roles_broadcastId_fkey"
            FOREIGN KEY ("broadcastId") REFERENCES "public"."broadcasts"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_roles_roleId_fkey'
    ) THEN
        ALTER TABLE "public"."broadcast_roles"
            ADD CONSTRAINT "broadcast_roles_roleId_fkey"
            FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 4. Indexes (the cron claims by status + scheduledAt)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "broadcasts_status_scheduledAt_idx"
    ON "public"."broadcasts"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "broadcast_roles_broadcastId_idx"
    ON "public"."broadcast_roles"("broadcastId");
CREATE INDEX IF NOT EXISTS "broadcast_roles_roleId_idx"
    ON "public"."broadcast_roles"("roleId");
