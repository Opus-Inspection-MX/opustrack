-- Parte B (fecha de ingreso) · grant users:manage-employment to ADMIN_VACACIONES.
--
-- What moves here, and why it is one migration:
-- - `users:manage-employment` ("Capturar datos laborales: fecha de ingreso"):
--   the narrow permission letting the vacation administrator capture an
--   employee's hire date without opening full user administration
--   (`users:create/update/delete` stay ROOT-only, decision #1 default).
-- - Grant → ADMIN_VACACIONES (the vacation administrator) plus ROOT. ROOT
--   holds every catalog permission (`resolveSeedGrants("ROOT")`), so leaving
--   it out trips the read-only permissions drift check.
--
-- Deploy order: MIGRATION FIRST, CODE SECOND (plan Parte B §2: additive).
-- Either order is safe — code-without-migration simply hides the capture
-- field behind `canPerform(...)` and the action denies; migration-without-
-- code leaves an unused grant — but migration-first keeps every deploy
-- green, so the field works the moment the code arrives.
--
-- Idempotency: the permission INSERT resolves by name with
-- `ON CONFLICT DO NOTHING`; the grant reactivation goes through UPDATE
-- first, so a half-applied run converges instead of sticking. Safe to
-- re-run after a failed deploy.
--
-- ONE sessionVersion bump at the end, scoped through the `user_roles` join
-- to users holding a touched role (ADMIN_VACACIONES or ROOT) only. Their
-- JWTs predate the new grant, so each of those sessions re-authenticates
-- exactly ONCE; the fresh login already emits the new permission. Users with
-- no active role, and holders of untouched roles, keep their sessions.
--
-- Identifier provenance (checked against schema, never against a local DB):
-- tables/columns from `prisma/schema.prisma` (Permission, Role,
-- RolePermission, User, user_roles via UserRole @@map); permission and role
-- names from `src/lib/authz/permission-catalog.ts`; pattern copied from
-- `20260914000000_inicio_home`.
--
-- Live-DB drift check before deploy: `SELECT name FROM "public"."Role"`
-- must include 'ADMIN_VACACIONES'.
--
-- Verification query after deploy (expect 2 active rows):
-- SELECT r."name" AS role, p."name" AS permission, rp."active" AS active
-- FROM "public"."RolePermission" rp
-- JOIN "public"."Role" r ON r."id" = rp."roleId"
-- JOIN "public"."Permission" p ON p."id" = rp."permissionId"
-- WHERE r."name" IN ('ADMIN_VACACIONES', 'ROOT')
--   AND p."name" = 'users:manage-employment';

-- ============================================================================
-- 1. New permission (by name — re-runs change nothing)
-- ============================================================================
INSERT INTO "public"."Permission"
  ("name", "description", "resource", "action", "routePath", "exact", "active")
VALUES
  ('users:manage-employment',
   'Capturar datos laborales: fecha de ingreso',
   'users', 'manage-employment', NULL, FALSE, TRUE)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- 2. Grant: reactivate-then-insert so re-runs converge
-- ============================================================================
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."name" IN ('ADMIN_VACACIONES', 'ROOT')
  AND p."name" = 'users:manage-employment';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."name" IN ('ADMIN_VACACIONES', 'ROOT')
  AND p."name" = 'users:manage-employment'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================================================
-- 3. ONE sessionVersion bump for users holding the touched role
-- ============================================================================
-- Only ADMIN_VACACIONES and ROOT gain grants here, so only their holders
-- re-login once and pick up the new permission.
UPDATE "public"."User"
SET "sessionVersion" = "sessionVersion" + 1
WHERE "active" = TRUE
  AND "id" IN (
    SELECT ur."userId"
    FROM "public"."user_roles" ur
    JOIN "public"."Role" r ON r."id" = ur."roleId"
    WHERE ur."active" = TRUE
      AND r."name" IN ('ADMIN_VACACIONES', 'ROOT')
      AND r."active" = TRUE
  );

-- ============================================================================
-- Rollback (reverse grant, second bump)
-- ============================================================================
-- 1. Deactivate the grants added in section 2 — but only if the roles did
--    not hold them before this deploy; check first:
--    `UPDATE "public"."RolePermission" rp SET "active" = FALSE
--     FROM "public"."Role" r, "public"."Permission" p
--     WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
--       AND r."name" IN ('ADMIN_VACACIONES', 'ROOT')
--       AND p."name" = 'users:manage-employment'`.
-- 2. Optionally `DELETE FROM "public"."Permission"
--    WHERE "name" = 'users:manage-employment'`
--    (the RolePermission row first, unless the FK cascades).
-- 3. Re-run section 3: the second bump invalidates the Parte-B tokens so the
--    restored grants take effect with exactly one more re-login.
