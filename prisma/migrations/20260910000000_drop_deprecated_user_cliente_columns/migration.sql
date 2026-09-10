-- Drop the deprecated per-user Cliente columns and the orphaned Incident.userId.
--
-- The UserClienteAssignment junction table has been the only writer for a
-- while (assignUserToCliente); the scalar columns survived only as read
-- fallbacks, and every read path now resolves scope from the junction.
-- One source of truth (cleanup 2.7).
--
-- Backfill first: legacy rows whose scalar is set but whose junction row is
-- missing become primary assignments, so no membership is lost in transit.
-- The `clienteIds` String[] column had zero writers and is dropped as-is.

-- 1) Backfill junction rows from the legacy scalar.
INSERT INTO "UserClienteAssignment" ("id", "userId", "clienteId", "isPrimary", "active", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, u."id", u."clienteId", TRUE, TRUE, NOW(), NOW()
FROM "User" u
WHERE u."clienteId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "UserClienteAssignment" j
    WHERE j."userId" = u."id" AND j."clienteId" = u."clienteId"
  );

-- 2) Drop the scalar FK + columns on "User".
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_clienteId_fkey";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clienteId";
ALTER TABLE "User" DROP COLUMN IF EXISTS "clienteIds";

-- 3) Drop the orphaned Incident.userId FK + column (never written; the
-- reporter is `reportedById`, the workers are IncidentAssignee rows).
ALTER TABLE "Incident" DROP CONSTRAINT IF EXISTS "Incident_userId_fkey";
ALTER TABLE "Incident" DROP COLUMN IF EXISTS "userId";
