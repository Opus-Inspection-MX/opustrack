-- Rename CLIENT role to REPORTER + client permission names (PR2).
--
-- JWT-crossing strings move HERE, together with the single sessionVersion bump
-- (spec ADDED-2): role names, permission names, the scope value, routePaths and
-- defaultPaths all travel inside the JWT. A token issued before this migration
-- carries CLIENT/clientes names and fails validation on the next request, so
-- every reporter session re-authenticates exactly ONCE; the fresh login already
-- emits REPORTER + clients:*.
--
-- Precedent: prisma/migrations/20260508032555_rename_work_order_to_assignment
-- (sections 5-6, UPDATE Permission + UPDATE Role, junction ids stable).
-- RENAME discipline per PR1a: no DROP/CREATE, no backfill, no new tables.
-- RolePermission rows are untouched: renames keep their ids stable, so no
-- grant dangles and no lockout beyond the single forced re-login.
--
-- Live-DB drift check before deploy: the WHERE clauses below must each match
-- the row counts from `SELECT name FROM "public"."Permission" WHERE name LIKE
-- 'clientes:%' OR name IN ('route:client','scope:all-clientes')` and
-- `SELECT name FROM "public"."Role" WHERE name = 'CLIENT'`.

-- ============================================================================
-- 1. UPDATE client capability permissions (clientes:* -> clients:*)
-- ============================================================================
UPDATE "public"."Permission"
SET "name" = 'clients:read',
    "resource" = 'clients',
    "description" = 'View Clients'
WHERE "name" = 'clientes:read';

UPDATE "public"."Permission"
SET "name" = 'clients:create',
    "resource" = 'clients',
    "description" = 'Create Clients'
WHERE "name" = 'clientes:create';

UPDATE "public"."Permission"
SET "name" = 'clients:update',
    "resource" = 'clients',
    "description" = 'Update Clients'
WHERE "name" = 'clientes:update';

UPDATE "public"."Permission"
SET "name" = 'clients:delete',
    "resource" = 'clients',
    "description" = 'Delete Clients'
WHERE "name" = 'clientes:delete';

-- ============================================================================
-- 2. UPDATE reporter portal route permission (route:client -> route:reporter)
-- ============================================================================
UPDATE "public"."Permission"
SET "name" = 'route:reporter',
    "description" = 'Access to reporter dashboard',
    "routePath" = '/reporter'
WHERE "name" = 'route:client';

-- ============================================================================
-- 3. UPDATE cross-client scope (scope:all-clientes -> scope:all-clients)
-- ============================================================================
UPDATE "public"."Permission"
SET "name" = 'scope:all-clients',
    "action" = 'all-clients'
WHERE "name" = 'scope:all-clientes';

-- ============================================================================
-- 4. UPDATE role (CLIENT -> REPORTER)
-- ============================================================================
UPDATE "public"."Role"
SET "name" = 'REPORTER',
    "description" = 'Reporter user - Raises incidents from Client',
    "defaultPath" = '/reporter'
WHERE "name" = 'CLIENT';

-- ============================================================================
-- 5. ONE sessionVersion bump for REPORTER users (forces a single re-login)
-- ============================================================================
-- Joins through the "user_roles" table (see UserRole @@map) AFTER the role
-- rename above, so the bump lands on exactly the users holding REPORTER.
-- Users holding other roles keep their sessions: no blanket invalidation.
UPDATE "public"."User"
SET "sessionVersion" = "sessionVersion" + 1
WHERE "active" = TRUE
  AND "id" IN (
    SELECT ur."userId"
    FROM "public"."user_roles" ur
    JOIN "public"."Role" r ON r."id" = ur."roleId"
    WHERE r."name" = 'REPORTER'
      AND ur."active" = TRUE
  );

-- ============================================================================
-- Rollback (re-rename + second bump, per tasks table)
-- ============================================================================
-- Reverse every UPDATE above (clients:* -> clientes:*, route:reporter ->
-- route:client, scope:all-clients -> scope:all-clientes, REPORTER -> CLIENT
-- with defaultPath '/client'), then re-run section 5 against the restored
-- 'CLIENT' name: the second bump invalidates the REPORTER-era tokens so the
-- restored names take effect with exactly one more re-login.
