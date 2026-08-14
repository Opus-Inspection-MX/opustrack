-- Remove the line status catalogue.
--
-- A line belongs to a verification centre and either exists or does not; the
-- three-state catalogue on top of it was never what drives the work. Incidents
-- carry the state that matters.
ALTER TABLE "Line" DROP CONSTRAINT IF EXISTS "Line_statusId_fkey";
DROP INDEX IF EXISTS "Line_statusId_idx";
ALTER TABLE "Line" DROP COLUMN IF EXISTS "statusId";
DROP TABLE IF EXISTS "LineStatus";

-- The permissions that guarded its screen.
--
-- The seed upserts permissions and never deletes the ones it stopped defining,
-- so without this the rows survive every re-seed: still listed, still
-- grantable, pointing at a page that no longer exists.
DELETE FROM "RolePermission"
WHERE "permissionId" IN (
    SELECT id FROM "Permission"
    WHERE name LIKE 'line-status:%'
       OR "routePath" = '/admin/settings/line-status'
);

DELETE FROM "Permission"
WHERE name LIKE 'line-status:%'
   OR "routePath" = '/admin/settings/line-status';
