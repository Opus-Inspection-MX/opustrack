-- Remove parts inventory.
--
-- `WorkPart` recorded the spare parts consumed on an assignment and `Part` was
-- the catalogue they were drawn from, stock included. Keeping either means
-- running a warehouse — receiving, counting, reconciling — and that is not what
-- this system is for. Work is documented with activities and attachments.
--
-- WorkPart first: it is the side holding the foreign keys.
DROP TABLE IF EXISTS "WorkPart";
DROP TABLE IF EXISTS "Part";

-- The permissions that guarded those screens.
--
-- The seed upserts permissions and never deletes the ones it stopped defining,
-- so without this the rows survive every re-seed: still listed in the roles
-- screen, still grantable, and pointing at pages that no longer exist.
DELETE FROM "RolePermission"
WHERE "permissionId" IN (
    SELECT id FROM "Permission"
    WHERE name LIKE 'parts:%'
       OR name LIKE 'work-parts:%'
       OR name IN ('route:admin-parts', 'route:admin-work-parts')
);

DELETE FROM "Permission"
WHERE name LIKE 'parts:%'
   OR name LIKE 'work-parts:%'
   OR name IN ('route:admin-parts', 'route:admin-work-parts');
