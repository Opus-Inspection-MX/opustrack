-- Multi-role RBAC.
--
-- A user now holds MANY roles, ADMINISTRADOR is split into a superuser (ROOT)
-- plus module admins, and route coverage learns an exact-match mode.
--
-- The order below is what keeps every current administrator logged in:
-- backfill BEFORE dropping `User.roleId`, and RENAME the ADMINISTRADOR row
-- instead of creating a new one, so its permissions and foreign keys survive.

-- 1. New columns -------------------------------------------------------------
ALTER TABLE "Role" ADD COLUMN "isSuperuser" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Role" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Permission" ADD COLUMN "exact" BOOLEAN NOT NULL DEFAULT false;

-- 2. The join table ----------------------------------------------------------
CREATE TABLE "user_roles" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");
CREATE INDEX "user_roles_userId_active_idx" ON "user_roles"("userId", "active");
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Backfill: every user keeps exactly the role they have today --------------
INSERT INTO "user_roles" ("userId", "roleId", "active")
SELECT "id", "roleId", true FROM "User";

-- 4. ADMINISTRADOR becomes ROOT ----------------------------------------------
-- Renamed, not recreated: the row keeps its id, so every RolePermission and
-- every user_roles entry pointing at it stays valid and no administrator loses
-- access at any point of this migration.
UPDATE "Role"
SET "name" = 'ROOT',
    "description" = 'Superusuario: administra catálogos, roles, permisos y usuarios',
    "isSuperuser" = true,
    "priority" = 100
WHERE "name" = 'ADMINISTRADOR';

-- Landing-page precedence for people who hold several roles.
UPDATE "Role" SET "priority" = 50 WHERE "name" = 'FSR';
UPDATE "Role" SET "priority" = 10 WHERE "name" IN ('CLIENT', 'GUEST');

-- 5. The old single-role column is gone --------------------------------------
-- Deliberately dropped rather than kept as a "deprecated" scalar: `clienteId`
-- was left beside `clienteAssignments` that way and the read paths never
-- migrated, so writes went to the join table and reads to the column.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_roleId_fkey";
ALTER TABLE "User" DROP COLUMN "roleId";
