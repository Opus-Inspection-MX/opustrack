-- Additive pending-edit permission. Retain grants and correction evidence on rollback.
INSERT INTO "public"."Permission"
  ("name", "description", "resource", "action", "routePath", "exact", "active")
VALUES ('vacations:update', 'Edit pending vacation requests', 'vacations', 'update', NULL, FALSE, TRUE)
ON CONFLICT ("name") DO UPDATE SET "active" = TRUE;

UPDATE "public"."RolePermission" rp SET "active" = TRUE
FROM "public"."Role" r, "public"."Permission" p
WHERE rp."roleId" = r."id" AND rp."permissionId" = p."id"
  AND r."code" IN ('EMPLEADO', 'FSR', 'ADMIN_VACACIONES', 'ROOT')
  AND p."name" = 'vacations:update';

INSERT INTO "public"."RolePermission" ("roleId", "permissionId", "active")
SELECT r."id", p."id", TRUE
FROM "public"."Role" r CROSS JOIN "public"."Permission" p
WHERE r."code" IN ('EMPLEADO', 'FSR', 'ADMIN_VACACIONES', 'ROOT')
  AND p."name" = 'vacations:update'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
