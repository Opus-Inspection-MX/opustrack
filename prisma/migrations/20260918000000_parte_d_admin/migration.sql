-- Parte D (huecos de administración) · G-9: drop the dead /incidents routePath.
--
-- What moves here, and why it is one migration:
-- - `incidents:read` loses `routePath "/incidents"`: no page exists at that
--   path (there is no `src/app/incidents`), so the grant used to widen every
--   holder's JWT route prefix over a route that 404s. The catalog
--   (`src/lib/authz/permission-catalog.ts`) and the tracked seed template
--   (`initial_load/seed.example.ts`) already dropped it; this converges live
--   databases, whose Permission rows the seed only writes when empty.
-- - G-5 (`states:read` → ADMIN_OPERACION) needs NO migration here: catalog,
--   grant and sessionVersion bump already landed in
--   `20260915000000_authz_0d_missing_grants` (Fase 0d).
-- - G-8 (`/admin/permissions`, read-only catalog page for ROOT) needs NO
--   migration: it reuses the existing `route:admin-permissions` and
--   `permissions:read` rows, which only ROOT holds.
--
-- Deploy order: MIGRATION FIRST, CODE SECOND (additive pattern). Either order
-- is safe — the prefix grants nothing real, so old sessions keep a harmless
-- dead prefix until re-login and new code never references it.
--
-- Idempotency: a single conditional UPDATE; re-runs match zero rows and
-- change nothing. No sessionVersion bump: no grant is added or removed, and
-- the dropped prefix guarded no real page, so no session can lose (or keep)
-- access that matters.
--
-- Identifier provenance (checked against schema, never against a local DB):
-- table/columns from `prisma/schema.prisma` (Permission @@map default);
-- permission name from `src/lib/authz/permission-catalog.ts`; pattern copied
-- from `20260914000000_inicio_home`.
--
-- Verification query after deploy (expect one row, NULL routePath):
-- SELECT "name", "routePath", "active" FROM "public"."Permission"
-- WHERE "name" = 'incidents:read';

UPDATE "public"."Permission"
SET "routePath" = NULL
WHERE "name" = 'incidents:read'
  AND "routePath" IS NOT NULL;
