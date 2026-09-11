-- Parte C · difusiones a usuarios específicos (schema migration, additive).
--
-- What moves here, and why it is one migration:
-- - `broadcast_users`: `Broadcast ↔ User` audience pivot, a mirror of
--   `broadcast_roles` (Parte C of `docs/plans/admin-y-difusiones.md`). One row
--   per directly-addressed user; edits DEACTIVATE (`active = false`), never
--   delete. Recipients resolve AT SEND TIME from these rows (union with the
--   role audience); reach is validated at create/edit time, not at dispatch
--   (decision #3).
-- - `User.broadcasts` / `Broadcast.users` back-relations: schema-only, no
--   columns (Prisma requires the opposite fields for `BroadcastUser.user` /
--   `BroadcastUser.broadcast`).
--
-- Deploy order: apply this migration FIRST, then ship the code that reads and
-- writes `broadcast_users`. In the reverse order every create/edit carrying
-- `userIds` fails on the missing table; the old code (roles-only) keeps
-- working either way because it never touches the new table.
--
-- Idempotency: the table is created with IF NOT EXISTS and FK/unique
-- constraints go through a DO block probing pg_constraint, mirroring
-- `20260913000000_phase4_broadcasts`. Safe to re-run after a failed deploy.
--
-- Identifier provenance (checked against generated DDL, never a local DB):
-- `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
-- --script` output for this schema — column names/types/defaults and every
-- constraint/index name below match it verbatim.

-- ============================================================================
-- 1. New table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."broadcast_users" (
    "id" SERIAL NOT NULL,
    "broadcastId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "broadcast_users_pkey" PRIMARY KEY ("id")
);

-- ============================================================================
-- 2. Constraints (Prisma-generated names, probed before adding)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_users_broadcastId_userId_key'
    ) THEN
        ALTER TABLE "public"."broadcast_users"
            ADD CONSTRAINT "broadcast_users_broadcastId_userId_key"
            UNIQUE ("broadcastId", "userId");
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_users_broadcastId_fkey'
    ) THEN
        ALTER TABLE "public"."broadcast_users"
            ADD CONSTRAINT "broadcast_users_broadcastId_fkey"
            FOREIGN KEY ("broadcastId") REFERENCES "public"."broadcasts"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'broadcast_users_userId_fkey'
    ) THEN
        ALTER TABLE "public"."broadcast_users"
            ADD CONSTRAINT "broadcast_users_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 3. Indexes (dispatch reads by broadcast; search reads by user)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "broadcast_users_broadcastId_idx"
    ON "public"."broadcast_users"("broadcastId");
CREATE INDEX IF NOT EXISTS "broadcast_users_userId_idx"
    ON "public"."broadcast_users"("userId");
