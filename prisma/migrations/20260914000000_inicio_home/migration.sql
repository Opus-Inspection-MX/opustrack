-- Fase 3 · /inicio home (data migration, no schema change).
--
-- What moves here, and why it is one migration:
-- - `route:inicio` (/inicio) for EVERY active role: the personal home becomes
--   universal, so every JWT must carry the route or its holder gets bounced.
-- - `defaultPath` → '/inicio' for the seven seed roles, named EXPLICITLY so a
--   role created later from the UI keeps whatever landing it was given.
-- - `tracking:read` + `tracking:update` → ADMIN_OPERACION (hallazgo 3.0.1):
--   every tracking action gates on those, so the role that owns
--   /admin/tracking could not open its own landing. Verified missing both in
--   the seed files and in the local database before writing this.
--
-- Deploy order (hallazgo 3.0.4): the build does NOT run migrations. Ship the
-- code carrying the /inicio route FIRST, then apply this migration. In the
-- reverse order every login lands on a 404 until the code arrives.
--
-- Idempotency: the permission INSERT resolves by name with
-- `ON CONFLICT DO NOTHING`; reactivations of pre-existing grant rows go
-- through UPDATE first, so a half-applied run converges instead of sticking.
-- Safe to re-run after a failed deploy.
--
-- ONE sessionVersion bump at the end, scoped through the `user_roles` join to
-- users holding an active role. Their JWTs predate the new route and the new
-- defaultPath, so each of those sessions re-authenticates exactly ONCE; the
-- fresh login already emits the new routePaths. Users with no active role
-- keep their sessions (they cannot open anything either way). The first login
-- after the deploy may still fall through to the old portal once if the
-- token was minted between the code deploy and this migration — that is
-- expected and self-heals on the next login.
--
-- Identifier provenance (checked against schema, never against a local DB):
-- tables/columns from `prisma/schema.prisma` (Permission, Role,
-- RolePermission, User, user_roles via UserRole @@map); role and permission
-- names from `initial_load/seed.example.ts`; pattern copied from
-- `20260911000000_phase1_notifications_rbac`.
--
-- Live-DB drift check before deploy: `SELECT name FROM "public"."Permission"
-- WHERE "name" IN ('tracking:read','tracking:update')` must return both rows
-- (they exist since the RBAC seed), and
-- `SELECT name FROM "public"."Role"` must include the seven names below.

-- ============================================================================
-- 1. New permission (by name — re-runs change nothing)
-- ============================================================================
INSERT INTO "public"."Permission"
  ("name", "description", "resource", "action", "routePath", "exact", "active")
VALUES
  ('route:inicio',
   'Pantalla inicial personalizada',
   NULL, NULL, '/inicio', FALSE, TRUE)
ON CONFLICT ("name") DO NOTHING;

-- ============================================================================
-- 2. Grants: reactivate-then-insert so re-runs converge
-- ============================================================================

-- 2a. route:inicio → every active role (universal home).
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."active" = TRUE
  AND p."name" = 'route:inicio';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."active" = TRUE
  AND p."name" = 'route:inicio'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- 2b. tracking:read + tracking:update → ADMIN_OPERACION (hallazgo 3.0.1).
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."name" = 'ADMIN_OPERACION'
  AND p."name" IN ('tracking:read', 'tracking:update');

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."name" = 'ADMIN_OPERACION'
  AND p."name" IN ('tracking:read', 'tracking:update')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================================================
-- 3. Landing → /inicio for the seed roles only (named explicitly)
-- ============================================================================
-- Roles created from the UI keep their own landing: they are not listed here
-- and this statement never touches them.
UPDATE "public"."Role"
SET "defaultPath" = '/inicio'
WHERE "name" IN (
  'ROOT',
  'ADMIN_OPERACION',
  'ADMIN_VACACIONES',
  'FSR',
  'EMPLEADO',
  'REPORTER',
  'GUEST'
);

-- ============================================================================
-- 4. ONE sessionVersion bump for users holding an active role
-- ============================================================================
-- `route:inicio` lands on every role, so this is every user with an active
-- role — each re-logs in exactly once and picks up the new route plus the
-- new landing.
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
-- Rollback (reverse grants, restore landings, second bump)
-- ============================================================================
-- 1. Restore the previous landings per role (values from
--    `initial_load/seed.example.ts` before Fase 3):
--    ROOT '/admin', ADMIN_OPERACION '/admin/tracking',
--    ADMIN_VACACIONES '/admin/vacations', FSR '/fsr', EMPLEADO '/vacations',
--    REPORTER '/reporter', GUEST '/guest'.
--    `UPDATE "Role" SET "defaultPath" = … WHERE "name" = …` one row at a
--    time — never a blanket UPDATE, or UI-created roles lose their landing.
-- 2. Deactivate the grants added in section 2 (RolePermission rows for
--    `route:inicio` on every role; `tracking:read`/`tracking:update` on
--    ADMIN_OPERACION — but only if that role did not hold them before this
--    deploy; check first):
--    `UPDATE "RolePermission" SET "active" = FALSE WHERE …`.
-- 3. Optionally `DELETE FROM "Permission" WHERE "name" = 'route:inicio'`
--    (RolePermission rows for it first, unless the FK cascades).
-- 4. Re-run section 4: the second bump invalidates the Fase-3 tokens so the
--    restored grants take effect with exactly one more re-login.
