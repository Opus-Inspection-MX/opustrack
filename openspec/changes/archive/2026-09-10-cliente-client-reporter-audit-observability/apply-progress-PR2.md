# Apply Progress — PR2: REPORTER + JWT + redirects (tasks 3.1–3.3) — CUMULATIVE with PR1a+PR1b

Change: `cliente-client-reporter-audit-observability` | Slice: PR2 (stacked on PR1a+PR1b worktree, unmerged) | Mode: Standard (strict_tdd false)
Chain: stacked-to-main | Date: 2026-09-10

> PR1a detail lives in `apply-progress-PR1a.md` (tasks 1.1–1.5); PR1b detail in
> `apply-progress-PR1b.md` (tasks 2.1–2.5). This file is the cumulative state:
> everything below marked [x] is done in the worktree. Do NOT merge (PR1a/PR1b
> unmerged); do NOT touch PR3 (audit) or PR4 (logger).

## Completed Tasks (cumulative)

- [x] 1.1 RENAME-only migration `20260910173827_rename_cliente_to_client` (see PR1a file)
- [x] 1.2 `prisma/schema.prisma`: `Cliente`→`Client`, junctions, `clientId`, `userId_clientId`, `UserProfile.createdAt`, `Client.updatedAt @updatedAt`
- [x] 1.3 New `src/lib/utils/client-assignments.ts` (9 English fns) + English helper test
- [x] 1.4 `authz.ts` (`SCOPE_ALL_CLIENTS`), `filters.ts` / `report-scope.ts` fully English; operator Spanish messages kept
- [x] 1.5 Scope tests green; old JWT stays valid (PR1a boundary)
- [x] 2.1 `src/lib/actions/clients.ts`: `reporterIds`, `getReporterUsers`, `fsrCountByClient`, `by:["clientId"]`, `revalidatePath("/admin/clients…")`
- [x] 2.2 `admin/clientes/` → `admin/clients/`, `api/clientes/` → `api/clients/`, `cliente-form.tsx` → `client-form.tsx`; DOM ids English
- [x] 2.3 Longest-match-first sweep incl. tsc-invisible keys/fixtures/scripts; live `clienteIds`/`clientIds` download-URL bug fixed
- [x] 2.4 CSV dual header (`cliente` legacy / `client` new, `client` wins; snapshot `clientId`); 19/19 bulk tests
- [x] 2.5 Seeds/fixtures/test-db moved; `npm run check` green; `test:unit` 714 green (PR1b boundary)
- [x] 3.1 New hand-written migration `prisma/migrations/20260910210000_rename_client_to_reporter/migration.sql` (RENAME-only discipline for data): 4× `UPDATE Permission` (`clientes:read/create/update/delete` → `clients:*` with `resource: "clients"` + `View Clients` descriptions; `route:client` → `route:reporter` with `Access to reporter dashboard` + `routePath /reporter`; `scope:all-clientes` → `scope:all-clients` with `action: "all-clients"`) + 1× `UPDATE Role` (`CLIENT` → `REPORTER`, `Reporter user - Raises incidents from Client`, `defaultPath /reporter`) + ONE `sessionVersion` bump scoped to REPORTER users via the `user_roles` join (AFTER the role rename). `RolePermission` rows untouched (ids stable). Rollback documented in-file (re-rename + second bump). One re-login semantic verified statically (see Evidence): pre-PR2 JWT → `null` on next request → fresh login emits `REPORTER` + `clients:*`.
- [x] 3.2 JWT-crossing strings moved: `SCOPE_ALL_CLIENTS` value → `"scope:all-clients"` (`authz.ts`, PR1a NOTE comment updated to PR2); `src/app/client/` → `src/app/reporter/` via `git mv` (7 files: `layout`, `loading`, `page`, `new/page`, `new/loading`, `assignments/[id]/page`, `incidents/[id]/page`); component names `ClientDashboard`/`ClientAssignmentDetailPage`/`ClientIncidentDetailPage` → `Reporter*`; every `/client…` route string → `/reporter…` (`requireRouteAccess`, `Link`, `router.push`, `BackButton`); menu "Mi Centro" urls → `/reporter`, `/reporter/new` (Spanish labels kept); `getMyProfile().client` entity reads kept. FINDING: no literal `clienteId` key exists in the JWT — `authorize()` never issued a per-user Cliente claim (scope resolves from the junction per request; RF-100/spec prose lists it but code does not implement it). The claim rename is therefore a verified no-op; the JWT-crossing renames are roleNames/permission-names/scope-value/routePaths/defaultPath, all moved with the bump. `reporter@` seeds: `seed.example.ts` role row + 3 accounts (`reporter@`, `reporter2@`, `reporter3@`) + comments at :197/:967/:1253/:1299 + log line; `e2e/fixtures/auth.ts` (`Role` union → `"reporter"`, `E2E_REPORTER_EMAIL`, `roleName: "REPORTER"`, `defaultPath: "/reporter"`); `config/e2e.env`, `config/e2e.local.env.example`, `e2e/README.md`; `rbac-roles.spec.ts` block renamed `CLIENT` → `REPORTER` (test-name sentence kept: "no tiene vacaciones: es la cuenta del centro, no una persona").
- [x] 3.3 `next.config.ts` `redirects()` (permanent 308): `/admin/clientes/:path*` → `/admin/clients/:path*`, `/api/clientes/:path*` → `/api/clients/:path*`, `/client/:path*` → `/reporter/:path*` (+ removal note); new `next.config.test.ts` pins all three rules (source/destination/permanent). `createIncidentAsClient` → `createIncidentAsReporter`, `getClientIncidents` → `getReporterIncidents` (all call sites: reporter pages); `IncidentClientCreateSchema`/`IncidentClientCreateInput` → `IncidentReporter*` (validations + test); every `revalidatePath("/client…")` → `/reporter…` (`incidents.ts` ×6 incl. backtick template, `incident-attachments.ts` ×3, `assignments.ts`, `incidents-bulk.ts`).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/auth next.config.test.ts src/app/layout-guards.test.ts src/lib/validations/incidents.test.ts src/lib/actions/catalog-deletes.test.ts src/lib/actions/incident-attachments.test.ts` → 10 files / 109 tests pass (incl. new redirect test 1/1, filters 13/13, layout-guards with `reporter` portal); full `npm run test:unit` → 58 files / 715 tests pass (714 PR1b + 1 new) |
| Runtime harness command/scenario and exact result | `test:e2e` ephemeral DB — N/A (Docker daemon down, same as PR1a/PR1b; e2e specs type-check clean via `tsc`, storage-state keys + URLs + role names moved consistently). Migration SQL hand-verified against schema (`user_roles` map, `Role`/`Permission`/`User` columns); live-deploy drift check embedded in migration header |
| Rollback boundary | Migration file delete + reverse UPDATEs per in-file rollback note (second bump against restored `CLIENT`); `git mv src/app/reporter src/app/client` + reverse the renames per tasks table; next.config `redirects()` block delete with its test. No PR1a/PR1b file needs reverting for a PR2-only rollback |

### One re-login verification (3.1, static — runtime pending Docker)

1. Migration §5 increments `sessionVersion` exactly once, only for users holding REPORTER after the rename (`JOIN "Role" … WHERE r."name" = 'REPORTER' AND ur."active"`; inactive users excluded). No blanket invalidation.
2. `getAuthenticatedUser` (`src/lib/auth/auth.ts:67-76`): JWT version ≠ DB version → returns `null` → every page/action treats the session as unauthenticated. First request after deploy → `null` (spec ADDED-2 "primer request retorna null/re-login").
3. Fresh login (`authorize`, `auth-options.ts:126-140`) re-reads role names, `routePaths`, `defaultPath` from the DB → new JWT carries `REPORTER` + `clients:*` + `/reporter`.
4. Stale names inside the old token (`CLIENT`, `clientes:*`, `/client`) never get a half-state: the version check fires before any permission/route evaluation.
5. Live proof (single login round-trip on the ephemeral DB) still required once Docker is available; tracked as the PR2 follow-up, not a gap in the slice.

## Deviations from Design

1. No literal `clienteId` JWT key existed to rename (verified: `auth-options.ts`, `next-auth.d.ts`, `authz.ts`, middleware carry no such claim; only RF-100/spec prose lists it). Implemented as documented no-op; all real JWT-crossing strings moved.
2. `IncidentEvent` payload `{ source: "client" }` (`incidents.ts:447`) KEPT — event telemetry, no reader, outside 3.1–3.3; renaming historic event semantics is not part of this slice.
3. Spanish operator/UI prose kept throughout (`Mi Centro`, `Cliente` labels/cards, `Debes tener un Cliente asignado`, scope description `Ver datos de todos los Clientes…`, `Test Cliente` entity) per PR1b discipline; only identifiers, routes, role names, and credential emails moved.
4. `scripts/generate-seed-data.ts` log string (`usuarios CLIENT`) untouched — private-data pipeline generator, outside the slice file list; mirror with the real seed.
5. `biome format` (`format`, not logic) applied once at the end; two import-order fixes by hand (`organizeImports` is a `check` rule, `format` does not apply it).

## Issues Found (and fixed)

- Backtick template `revalidatePath(`/client/…`)` in `incidents.ts:1007` and `incident-attachments.ts:27` survived the quote-prefix replaceAll — caught by grep, fixed.
- `requirePermission("clientes:*")` / `withPermission("clientes:read")` live in `clients.ts` (×7), `api/clients/route.ts`, `catalog-deletes.test.ts` — JWT-crossing names the initial sweep missed; moved to `clients:*`.
- Scattered `CLIENT`-role prose (`incident-timeline`, `role-form` placeholder, `create-incident-dialog`, `incident-attachments` + test, admin incident page, `vacations.ts` exclusion comment) moved to REPORTER.
- `role-form.tsx` placeholder `ej. ADMINISTRADOR, FSR, CLIENT` → REPORTER (a stale example would invite recreating the old role).

## Remaining (NOT this slice)

- PR3 (audit RF-550–554), PR4 (observability RF-555–557)
- `test:e2e` runtime + live one-re-login proof once Docker is available
- Real-seed mirror (`initial_load/seed.ts` gitignored) + `clientes.csv`/`users.csv` regeneration by whoever holds them
- Docs checklist (`CLAUDE.md` JWT `clienteId` mention :77, `README.md`, `openspec/config.yaml` context) — apply checklist item, suggested for the archive pass

## Workload / PR Boundary

- Mode: stacked PR slice (stacked-to-main); current work unit: PR2 REPORTER-JWT-redirects
- Boundary: PR1a+PR1b worktree state → tasks 3.1–3.3 complete, FULL `npm run check` green (exit 0: biome + tsc + knip), `test:unit` 715/715
- Start: `SCOPE_ALL_CLIENTS` value `scope:all-clientes`, `CLIENT` role, `/client` portal → finish: `scope:all-clients`, `REPORTER`, `/reporter` + 308 bridges + data migration
- NOTE: stack on the current branch; do NOT merge (PR1a/PR1b unmerged). Slice vs HEAD overlaps PR1a/PR1b shared files so no isolated line count exists; the combined worktree is ~147 files vs HEAD. PR2 alone touches 44 files (migration + 7 moved pages + actions + seeds + e2e) — over the 400-line budget on mechanical renames; recommend `size:exception` with this file + check/test evidence as the review aid.
