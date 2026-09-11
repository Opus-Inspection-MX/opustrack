-- Phase 2 notification core (schema + default channel policy).
--
-- What moves here, and why it is one migration:
-- - `notification_channel_policies`: one row per notification type, keyed by
--   the type string itself (`type TEXT @id`). The matrix screen
--   (/admin/settings/notifications) edits these rows; when both switches are
--   off the event is disabled. New event types need no migration — only a
--   catalog entry (src/lib/notifications/catalog.ts) plus a seed row below.
-- - `email_outbox`: one row per outbound message (`status`
--   PENDIENTE/ENVIADO/FALLIDO, `attempts`, `lastError` PII-free,
--   `nextAttemptAt`, `broadcastId?`). Gives visibility into mail failures and
--   a retry cursor for the Phase 5 cron.
-- - `AuditEntity.NOTIFICATION_CHANNEL`: the matrix save is an attributable
--   management write, so it goes through `logAudit` like every other one.
--
-- Idempotency: tables/types/indexes are created with IF NOT EXISTS guards and
-- the policy seeds resolve by their natural key with
-- `ON CONFLICT ("type") DO UPDATE` on the channel switches only — a re-run
-- converges on the documented defaults for fresh rows but never touches the
-- attribution columns of rows an admin already edited. Safe to re-run after
-- a failed deploy.
--
-- Identifier provenance (checked against schema, never against a local DB):
-- column names/types from `prisma/schema.prisma` (NotificationChannelPolicy,
-- EmailOutbox, EmailOutboxStatus, AuditEntity); table/index/constraint names
-- from `prisma migrate diff --from-empty --script` output for this schema.
-- Event type strings from `src/lib/notifications/catalog.ts`; email defaults
-- (mail ONLY for incident created/closed/cancelled and vacation
-- requested/approved/rejected, everything else in-app only) match
-- `defaultChannels` in the catalog.
--
-- NOT applied here (no Docker in this environment): run `npm run db:migrate`
-- where the database runs, then `npm run db:drift` to confirm no drift.

-- ============================================================================
-- 1. New enum + new enum value
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EmailOutboxStatus') THEN
        CREATE TYPE "public"."EmailOutboxStatus" AS ENUM ('PENDIENTE', 'ENVIADO', 'FALLIDO');
    END IF;
END $$;

-- New auditable entity for the matrix save (logAudit, RF-550).
ALTER TYPE "public"."AuditEntity" ADD VALUE IF NOT EXISTS 'NOTIFICATION_CHANNEL';

-- ============================================================================
-- 2. New tables (log-shaped: no `active`, no soft delete — see schema comments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."notification_channel_policies" (
    "type" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,

    CONSTRAINT "notification_channel_policies_pkey" PRIMARY KEY ("type")
);

CREATE TABLE IF NOT EXISTS "public"."email_outbox" (
    "id" TEXT NOT NULL,
    "notificationType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "recipients" TEXT[],
    "status" "public"."EmailOutboxStatus" NOT NULL DEFAULT 'PENDIENTE',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "broadcastId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_outbox_status_nextAttemptAt_idx"
    ON "public"."email_outbox"("status", "nextAttemptAt");

-- ============================================================================
-- 3. Default channel policy (mail only where it matters, in-app everywhere)
-- ============================================================================
INSERT INTO "public"."notification_channel_policies" ("type", "inApp", "email", "updatedAt")
VALUES
    -- Assignments: in-app only (mailing every edit trains the spam filter).
    ('assignment_assigned', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('assignment_updated', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('assignment_completed', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('assignment_reopened', TRUE, FALSE, CURRENT_TIMESTAMP),
    -- Incidents: mail only for created / closed / cancelled.
    ('incident_created', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('incident_updated', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_assigned', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_phase_asignado', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_phase_visto', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_phase_iniciado', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_phase_en_progreso', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('incident_closed', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('incident_cancelled', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('incident_reopened', TRUE, FALSE, CURRENT_TIMESTAMP),
    -- Vacations: mail for requested / approved / rejected.
    ('vacation_requested', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('vacation_approved', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('vacation_rejected', TRUE, TRUE, CURRENT_TIMESTAMP),
    ('vacation_cancelled', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('vacation_starting_soon', TRUE, FALSE, CURRENT_TIMESTAMP),
    -- System broadcasts: in-app only by default; the composer picks per send.
    ('system', TRUE, FALSE, CURRENT_TIMESTAMP),
    ('announcement', TRUE, FALSE, CURRENT_TIMESTAMP)
ON CONFLICT ("type") DO UPDATE
SET "inApp" = EXCLUDED."inApp",
    "email" = EXCLUDED."email",
    "updatedAt" = CURRENT_TIMESTAMP;

-- ============================================================================
-- Rollback
-- ============================================================================
-- 1. `DELETE FROM "public"."email_outbox"` (Phase 5 cron owns these rows
--    afterwards; on a fresh Phase-2-only deploy nothing else references them).
-- 2. `DELETE FROM "public"."notification_channel_policies"`.
-- 3. `DROP TABLE "public"."email_outbox"`,
--    `DROP TABLE "public"."notification_channel_policies"`,
--    `DROP TYPE "public"."EmailOutboxStatus"`.
-- 4. Enum values cannot be dropped without recreating the type: to remove
--    'NOTIFICATION_CHANNEL', recreate `AuditEntity` without it
--    (`ALTER TYPE ... RENAME`, `CREATE TYPE` fresh, `ALTER TABLE ... TYPE`
--    with USING, `DROP TYPE` old) — or keep the value and roll back the code
--    too, since an unused enum label is harmless.
