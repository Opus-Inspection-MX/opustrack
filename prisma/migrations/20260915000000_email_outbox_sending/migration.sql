-- Fase 5a · Email outbox atomic claim (H-12, schema change).
--
-- What moves here, and why it is one migration:
-- - New `ENVIANDO` value on the `EmailOutboxStatus` enum, so a worker can
--   claim a row atomically (PENDIENTE/FALLIDO-due → ENVIANDO) before sending.
--   Without a claimed state, two overlapping cron runs send the same row twice.
--
-- Deploy order: migration FIRST, code after. The new code writes the
-- `ENVIANDO` value, so it fails against a database that does not have it yet.
-- The old code keeps running against the migrated database (it never reads
-- or writes `ENVIANDO`, it just sees fewer due rows).
--
-- Idempotency: the enum value is added only when missing, guarded by a
-- `DO $$` block. Safe to re-run after a failed deploy.
--
-- Verification: SELECT enumlabel FROM pg_enum JOIN pg_type
-- ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname =
-- 'EmailOutboxStatus' ORDER BY enumsortorder;
-- must list PENDIENTE, ENVIANDO, ENVIADO, FALLIDO.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'EmailOutboxStatus' AND e.enumlabel = 'ENVIANDO'
  ) THEN
    ALTER TYPE "public"."EmailOutboxStatus" ADD VALUE 'ENVIANDO';
  END IF;
END
$$;
