-- Fase 0d · H-06 missing grants (data migration, no schema change).
--
-- What moves here, and why it is one migration:
-- - `incidents:cancel` → ADMIN_OPERACION: the incident detail page offers a
--   "Cancelar" button to that role, but only ROOT held the permission, so the
--   action denied access in production (decision #2 DEFAULT).
-- - `states:read` → ADMIN_OPERACION: the role holds `route:admin-states` yet
--   `getStatesAdmin` requires `states:read`, so the page never loaded
--   (decision #2 DEFAULT: read only, not create/update/delete).
-- - `assignments:reopen` → ADMIN_OPERACION: the reopen path CERRADO →
--   EN_PROGRESO exists in `assignment-machine.ts` ("reopen, admin") and in
--   `spec/04-asignaciones.md`, and this phase wires `reopenAssignment` to the
--   admin assignment detail screen (decision #3 CONECTAR REAPERTURA).
-- - Vacation accrual needs NO grant: `vacation-accrual-rules.ts` now gates on
--   `vacations:manage`, which ADMIN_VACACIONES already holds (decision #2
--   DEFAULT). Granting `settings:*` instead would also hand over the vehicle
--   and equipment status catalogs.
--
-- Deploy order: code first, then this migration. The new buttons render behind
-- `canPerform(...)`, so on code-without-migration they simply stay hidden;
-- on migration-without-code nothing reads the new grants yet. Either order is
-- safe, but code-first keeps every deploy green.
--
-- Idempotency: no Permission row is inserted (all three exist since the RBAC
-- seed). Grant reactivations go through UPDATE first and inserts resolve by
-- the (roleId, permissionId) unique key with `ON CONFLICT DO NOTHING`, so a
-- half-applied run converges instead of sticking. Safe to re-run after a
-- failed deploy.
--
-- ONE sessionVersion bump at the end, scoped through the `user_roles` join to
-- users holding the touched role (ADMIN_OPERACION) only. Their JWTs predate
-- the new grants, so each of those sessions re-authenticates exactly ONCE;
-- the fresh login already emits the new permissions. Users with no active
-- role, and holders of untouched roles, keep their sessions.
--
-- Identifier provenance (checked against schema, never against a local DB):
-- tables/columns from `prisma/schema.prisma` (Permission, Role,
-- RolePermission, User, user_roles via UserRole @@map); role and permission
-- names from `initial_load/seed.example.ts`; pattern copied from
-- `20260914000000_inicio_home`.
--
-- Live-DB drift check before deploy: `SELECT name FROM "public"."Permission"
-- WHERE "name" IN ('incidents:cancel','states:read','assignments:reopen')`
-- must return all three rows (they exist since the RBAC seed), and
-- `SELECT name FROM "public"."Role"` must include 'ADMIN_OPERACION'.
--
-- Verification query after deploy (expect 3 active rows):
-- SELECT r."name" AS role, p."name" AS permission, rp."active" AS active
-- FROM "public"."RolePermission" rp
-- JOIN "public"."Role" r ON r."id" = rp."roleId"
-- JOIN "public"."Permission" p ON p."id" = rp."permissionId"
-- WHERE r."name" = 'ADMIN_OPERACION'
--   AND p."name" IN ('incidents:cancel','states:read','assignments:reopen');

-- ============================================================================
-- 1. Grants: reactivate-then-insert so re-runs converge
-- ============================================================================

-- 1a. incidents:cancel + states:read + assignments:reopen → ADMIN_OPERACION.
UPDATE "public"."RolePermission" rp
SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id"
  AND rp."permissionId" = p."id"
  AND r."name" = 'ADMIN_OPERACION'
  AND p."name" IN ('incidents:cancel', 'states:read', 'assignments:reopen');

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r
CROSS JOIN "public"."Permission" p
WHERE r."name" = 'ADMIN_OPERACION'
  AND p."name" IN ('incidents:cancel', 'states:read', 'assignments:reopen')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- ============================================================================
-- 2. ONE sessionVersion bump for users holding the touched role
-- ============================================================================
-- Only ADMIN_OPERACION gains grants here, so only its holders re-login once
-- and pick up the new permissions.
UPDATE "public"."User"
SET "sessionVersion" = "sessionVersion" + 1
WHERE "active" = TRUE
  AND "id" IN (
    SELECT ur."userId"
    FROM "public"."user_roles" ur
    JOIN "public"."Role" r ON r."id" = ur."roleId"
    WHERE ur."active" = TRUE
      AND r."name" = 'ADMIN_OPERACION'
      AND r."active" = TRUE
  );

-- ============================================================================
-- Rollback (reverse grants, second bump)
-- ============================================================================
-- 1. Deactivate the grants added in section 1 — but only if ADMIN_OPERACION
--    did not hold them before this deploy; check first:
--    `UPDATE "public"."RolePermission" rp SET "active" = FALSE
--     FROM "public"."Role" r, "public"."Permission" p
--     WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
--       AND r."name" = 'ADMIN_OPERACION'
--       AND p."name" IN ('incidents:cancel','states:read',
--                        'assignments:reopen')`.
-- 2. Re-run section 2: the second bump invalidates the Fase-0d tokens so the
--    restored grants take effect with exactly one more re-login.
