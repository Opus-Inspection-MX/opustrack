-- Phase 1 notifications RBAC (data migration + RoleBroadcastTarget table).
--
-- What moves here, and why it is one migration:
-- - `route:notifications` (/notifications) for EVERY role: the inbox becomes
--   universal, so every JWT must carry the route or its holder gets bounced.
-- - `notifications:broadcast` (/admin/notifications) for ROOT, ADMIN_OPERACION
--   and ADMIN_VACACIONES: closes the hole where `sendBroadcast` only asked for
--   `notifications:read`, so any authenticated user (even GUEST) could diffuse.
-- - `notifications:configure` (/admin/settings/notifications) for ROOT only:
--   the channel matrix is admin-only (Phase 2 screen; the grant lands first so
--   no second re-login is needed when the page appears).
-- - `route:admin-notifications` is DEACTIVATED (permission + grants): broadcast
--   and read are separate capabilities now.
-- - GUEST loses the four self-service vacation grants: its own description is
--   "Read-only, no create permissions", and a shared read-only account holds no
--   vacation balance. REPORTER was already excluded for the same reason.
-- - `role_broadcast_targets` is created AND seeded: ADMIN_OPERACION reaches
--   FSR / REPORTER / GUEST / ADMIN_OPERACION; ADMIN_VACACIONES reaches
--   EMPLEADO / FSR / ADMIN_OPERACION / ADMIN_VACACIONES. A sender role with no
--   rows reaches nobody (fail closed); ROOT bypasses the table.
--
-- Idempotency: every INSERT resolves by its natural key with
-- `ON CONFLICT DO NOTHING`; reactivations of pre-existing grant rows go
-- through UPDATE first, so a half-applied run converges instead of sticking.
-- Safe to re-run after a failed deploy.
--
-- ONE sessionVersion bump at the end, scoped through the `user_roles` join to
-- users holding a touched role (here: every role, since `route:notifications`
-- lands on all of them). Their JWTs predate the new routes, so each of those
-- sessions re-authenticates exactly ONCE; the fresh login already emits the
-- new routePaths. Users with no active role keep their sessions (they cannot
-- open anything either way).
--
-- Identifier provenance (checked against schema, never against a local DB):
-- tables/columns from `prisma/schema.prisma` (Permission, Role,
-- RolePermission, User, user_roles via UserRole @@map); role and permission
-- names from `initial_load/seed.example.ts` and the migrations that created
-- them (`route:admin-notifications` + `scope:all-clients` from the RBAC seed;
-- `incidents:assign` likewise — the operations audience moves to it in this
-- same phase).
--
-- Live-DB drift check before deploy: the WHERE clauses below must each match
-- `SELECT name FROM "public"."Permission" WHERE "name" IN
-- ('route:admin-notifications','route:vacations','vacations:read',
-- 'vacations:create','vacations:delete')` and
-- `SELECT name FROM "public"."Role"`.

-- ============================================================================
-- 1. New permissions (by name — re-runs change nothing)
-- ============================================================================
INSERT INTO "public"."Permission"
  ("name", "description", "resource", "action", "routePath", "exact", "active")
VALUES
  ('route:notifications',
   'Acceso a mis notificaciones',
   NULL, NULL, '/notifications', FALSE, TRUE),
  ('notifications:broadcast',
   'Difundir notificaciones a roles',
   'notifications', 'broadcast', '/admin/notifications', FALSE, TRUE),
  ('notifications:configure',
   'Configurar canales de notificación',
   'notifications', 'configure', '/admin/settings/notifications', FALSE, TRUE)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- 2. RoleBroadcastTarget table (Phase 4 edits it from /admin/roles/[id])
-- ============================================================================
CREATE TABLE IF NOT EXISTS "public"."role_broadcast_targets" (
    "id" SERIAL NOT NULL,
    "sourceRoleId" INTEGER NOT NULL,
    "targetRoleId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_broadcast_targets_pkey" PRIMARY KEY ("id")
);

-- Unique pair + FKs/indexes use Prisma's generated names so a later
-- `prisma migrate diff` against schema.prisma reports no drift.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'role_broadcast_targets_sourceRoleId_targetRoleId_key'
    ) THEN
        ALTER TABLE "public"."role_broadcast_targets"
            ADD CONSTRAINT "role_broadcast_targets_sourceRoleId_targetRoleId_key"
            UNIQUE ("sourceRoleId", "targetRoleId");
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'role_broadcast_targets_sourceRoleId_fkey'
    ) THEN
        ALTER TABLE "public"."role_broadcast_targets"
            ADD CONSTRAINT "role_broadcast_targets_sourceRoleId_fkey"
            FOREIGN KEY ("sourceRoleId") REFERENCES "public"."Role"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'role_broadcast_targets_targetRoleId_fkey'
    ) THEN
        ALTER TABLE "public"."role_broadcast_targets"
            ADD CONSTRAINT "role_broadcast_targets_targetRoleId_fkey"
            FOREIGN KEY ("targetRoleId") REFERENCES "public"."Role"("id")
            ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "role_broadcast_targets_sourceRoleId_idx"
    ON "public"."role_broadcast_targets"("sourceRoleId");
CREATE INDEX IF NOT EXISTS "role_broadcast_targets_targetRoleId_idx"
    ON "public"."role_broadcast_targets"("targetRoleId");

-- ============================================================================
-- 3. Deactivate route:admin-notifications (permission + every grant)
-- ============================================================================
UPDATE "public"."Permission"
SET "active" = FALSE
WHERE "name" = 'route:admin-notifications';

UPDATE "public"."RolePermission"
SET "active" = FALSE
WHERE "permissionId" IN (
    SELECT "id" FROM "public"."Permission"
    WHERE "name" = 'route:admin-notifications'
);

-- ============================================================================
-- 4. GUEST loses self-service vacations (read-only account, no balance)
-- ============================================================================
UPDATE "public"."RolePermission"
SET "active" = FALSE
WHERE "roleId" IN (
    SELECT "id" FROM "public"."Role" WHERE "name" = 'GUEST'
)
AND "permissionId" IN (
    SELECT "id" FROM "public"."Permission"
    WHERE "name" IN (
        'route:vacations',
        'vacations:read',
        'vacations:create',
        'vacations:delete'
    )
);

-- ============================================================================
-- 5. Grants: reactivate-then-insert so re-runs converge
-- ============================================================================

-- 5a. route:notifications → every active role (universal inbox).
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."active" = TRUE
  AND p."name" = 'route:notifications';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."active" = TRUE
  AND p."name" = 'route:notifications'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 5b. notifications:broadcast → ROOT, ADMIN_OPERACION, ADMIN_VACACIONES.
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."name" IN ('ROOT', 'ADMIN_OPERACION', 'ADMIN_VACACIONES')
  AND p."name" = 'notifications:broadcast';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."name" IN ('ROOT', 'ADMIN_OPERACION', 'ADMIN_VACACIONES')
  AND p."name" = 'notifications:broadcast'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 5c. notifications:configure → ROOT only.
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."name" = 'ROOT'
  AND p."name" = 'notifications:configure';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."name" = 'ROOT'
  AND p."name" = 'notifications:configure'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================================================
-- 6. Seed RoleBroadcastTarget (sender → reachable roles)
-- ============================================================================
INSERT INTO "public"."role_broadcast_targets"
  ("sourceRoleId", "targetRoleId", "active")
SELECT s."id", t."id", TRUE
FROM (VALUES
    ('ADMIN_OPERACION', 'FSR'),
    ('ADMIN_OPERACION', 'REPORTER'),
    ('ADMIN_OPERACION', 'GUEST'),
    ('ADMIN_OPERACION', 'ADMIN_OPERACION'),
    ('ADMIN_VACACIONES', 'EMPLEADO'),
    ('ADMIN_VACACIONES', 'FSR'),
    ('ADMIN_VACACIONES', 'ADMIN_OPERACION'),
    ('ADMIN_VACACIONES', 'ADMIN_VACACIONES')
) AS v("source", "target")
JOIN "public"."Role" s ON s."name" = v."source"
JOIN "public"."Role" t ON t."name" = v."target"
ON CONFLICT ("sourceRoleId", "targetRoleId") DO NOTHING;

-- ============================================================================
-- 7. ONE sessionVersion bump for users holding a touched role
-- ============================================================================
-- `route:notifications` lands on every role, so this is every user with an
-- active role — each re-logs in exactly once and picks up the new routes.
UPDATE "public"."User"
SET "sessionVersion" = "sessionVersion" + 1
WHERE "active" = TRUE
  AND "id" IN (
    SELECT ur."userId"
    FROM "public"."user_roles" ur
    JOIN "public"."Role" r ON r."id" = ur."roleId"
    WHERE ur."active" = TRUE
  );

-- ============================================================================
-- Rollback (reverse grants, re-grant the old ones, second bump)
-- ============================================================================
-- 1. DELETE the three inserted Permission rows by name
--    ('route:notifications', 'notifications:broadcast',
--    'notifications:configure') — their RolePermission rows cascade only if
--    the FK says so; otherwise delete RolePermission rows for those
--    permissionIds first.
-- 2. Reactivate: `UPDATE "Permission" SET "active" = TRUE WHERE "name" =
--    'route:admin-notifications'` + its RolePermission rows, and the four
--    GUEST vacation grants.
-- 3. `DELETE FROM "role_broadcast_targets"` (Phase-4 UI owns these rows
--    afterwards; on a fresh Phase-1-only deploy nothing else references them).
--    Dropping the TABLE as well would orphan the schema.prisma model — prefer
--    rolling back the code too, or keep the empty table.
-- 4. Re-run section 7: the second bump invalidates the Phase-1 tokens so the
--    restored grants take effect with exactly one more re-login.
