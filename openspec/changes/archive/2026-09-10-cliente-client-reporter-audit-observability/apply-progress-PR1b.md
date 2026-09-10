# Apply Progress — PR1b: actions + routes + pages (tasks 2.1–2.5) — CUMULATIVE with PR1a

Change: `cliente-client-reporter-audit-observability` | Slice: PR1b (stacked on PR1a branch, unmerged) | Mode: Standard (strict_tdd false)
Chain: stacked-to-main | Date: 2026-09-10

> PR1a detail lives in `apply-progress-PR1a.md` (tasks 1.1–1.5). This file is the
> cumulative state: everything below marked [x] is done in the worktree.

## Completed Tasks (cumulative)

- [x] 1.1 RENAME-only migration `20260910173827_rename_cliente_to_client` (see PR1a file)
- [x] 1.2 `prisma/schema.prisma`: `Cliente`→`Client`, junctions, `clientId`, `userId_clientId`, `UserProfile.createdAt`, `Client.updatedAt @updatedAt`
- [x] 1.3 New `src/lib/utils/client-assignments.ts` (9 English fns) + English helper test
- [x] 1.4 `authz.ts` (`SCOPE_ALL_CLIENTS`, value stays `"scope:all-clientes"`), `filters.ts` / `report-scope.ts` fully English; operator Spanish messages kept
- [x] 1.5 Scope tests green (filters 13, report-scope 16, helper 14); old JWT stays valid
- [x] 2.1 `src/lib/actions/clientes.ts` → `clients.ts`: `ClientFormData`, `getClients*`, `create/update/deleteClient`, `reporterIds` (ADDED-1, was `clientIds`), `getReporterUsers` (was `getClientUsers`), `fsrCountByClient`, `by:["clientId"]`, `userId_clientId`, `revalidatePath("/admin/clients…")`. Permission literals (`clientes:*`), role `"CLIENT"`, JWT-adjacent strings untouched. `cliente-assignments.ts` shim DELETED; its 3 source importers (`clients.ts`, `incidents.ts`, `users.ts`) repointed; 6 remaining `vi.mock` paths moved with their sources (`reports`, `tracking`, `reports-sla`, `tracking-sla`, `api/incidents`, `api/schedules/incidents`).
- [x] 2.2 `src/app/admin/clientes/` → `admin/clients/`, `src/app/api/clientes/` → `api/clients/`, `cliente-form.tsx` → `client-form.tsx` (components dir kept). Importers updated (`line-form`, `equipment-form`, `incident-program` page, `catalog-deletes.test`). DOM ids English: `clienteId`→`clientId` (tracking-filters, line/equipment/user/incident/program forms), `bulk-cliente-switch`→`bulk-client-switch`, `program-cliente`→`program-client`; e2e `selectByFieldId(..., "clientId")` moved with them. `menu.ts` path → `/admin/clients`, label `"Cliente"` kept. Operator Spanish UI copy kept everywhere (menu, buttons, table headers, placeholders).
- [x] 2.3 Longest-match-first sweep across remaining code (scripted codemod + human review): scope-helper callers (`assert/canAccess/getClientWhere/scopeIncludesClient`), `scope.clienteIds`→`scope.clientIds`, `prisma.cliente`→`prisma.client`, `clienteAssignments`→`clientAssignments`, `scheduleCliente(s)`→`scheduleClient(s)`, `syncScheduleClientes`, `getClientsForSchedules`, `getLinesByClientId`, user-form/users-pages singular `client`, local `Cliente*` interfaces → `Client*`, incident-program `clientCodes/clientCode/clientIds` (+ fixed a live bug: download URL used `clienteIds` while the API reads `clientIds`). tsc-invisible covered: `lookups.test.ts` dynamic `child: "client"`, e2e `catalogs.ts` dynamic `model: "client"` (+ `key: "clients"`), tracking-table sort key `"client"`, `revalidatePath`/fetch/`searchParams` pairs moved together, seed `route:admin-organization` routePath → `/admin/clients`. Skipped: `*-client.tsx` filenames, `"use client"`, `PrismaClient`/`TransactionClient`, migration history, `openspec/**`, `spec/**`, `TRANSLATION_REPORT.md`, docs; JWT/role/route strings (`clientes:*`, `"CLIENT"`, `scope:all-clientes` value, `route:client`, `/client`, `client@`) untouched for PR2.
- [x] 2.4 CSV dual header: template ingest accepts `cliente` (legacy) or `client` (new), `client` wins; generation emits `client`; snapshot uses `clientId`; resolution accent/case-insensitive (existing `normalizeForMatch`/`normalizeHeader`). `EditablePreviewRow` → `clientId`/`clientCodeRaw`/`clientResolved`; `BulkIncidentTemplateRowSchema` documents both keys; snapshot schema → `clientId`. New tests in `incidents-bulk.test.ts` (legacy resolve, accent-fold resolve, client-wins, error-column, snapshot `clientId`) — 19/19 green.
- [x] 2.5 `seed.example.ts` (prisma + junction + locals; permission/role/email rows kept for PR2), `e2e/fixtures/` (`catalogs`, `flows` `clientCode/clientName`, `db`, specs), `src/test/db.ts`; `spec/02-clientes-jerarquia.md` filename kept (no spec/ file touched). `npm run check` exit 0 (biome + tsc + knip); `test:unit` 57 files / 714 tests green.

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/actions` → 236 tests (233 pass, 3 fail lookups dynamic-key → fixed → rerun green); full `npm run test:unit` → 57 files / 714 tests, all pass; targeted `filters`+`report-scope`+`client-assignments`+2 API route suites → 68/68 pass; `incidents-bulk.test.ts` → 19/19 (incl. 5 new dual-header tests) |
| Runtime harness command/scenario and exact result | `test:e2e` ephemeral DB — N/A (Docker daemon down in this environment, same as PR1a; e2e specs type-check clean and selectors/fixtures moved consistently) |
| Rollback boundary | `git checkout` the PR1b file set (clients.ts/routes/pages/components/actions/validations/seeds/fixtures/tests) or reverse the renames per the tasks table; PR1a layer underneath untouched. No data migration involved |

## Deviations from Design

1. `src/components/admin/clientes/` directory name KEPT (only `cliente-form.tsx` → `client-form.tsx` renamed per task 2.2 literal scope).
2. Template generation emits the NEW `client` header (spec only mandates ingest acceptance; generation follows the rename so new downloads are canonical; legacy files still ingest).
3. Snapshot format is `clientId`-only (no legacy `clienteId` acceptance — machine round-trip, regenerated each export).
4. `getReporterUsers`/`reporterIds` cover the CLIENT-role-user meaning; deeper component locals renamed (`selectedReporters`, `reporterUsers` prop) to satisfy ADDED-1 zero-ambiguity; the `CLIENT` role name itself stays for PR2.
5. `npm run format` (biome) applied once at the end to normalize whitespace fallout from the scripted rename; no hand-written logic altered (formatter-only).

## Issues Found (and fixed)

- Codemod regex-dot bug: plain-string path rules fed to `re.sub` let `.` match any char (`/admin/clientes` → `/admi./clients`, 14 sites). Fixed by literal replacement + escaped patterns; corrupted sites repaired and verified gone.
- Codemod `//`-comment splitter broke a regex literal (`/^\//` in `ephemeral-db.ts`, excluded afterwards) and ` * //` JSDoc lines (repaired); blank-line doubling (two script bugs, both fixed; formatter normalized the rest).
- Bulk `git checkout` to recover from script damage reverted PR1a's `filters.ts`/`report-scope.ts`/`authz.ts`; restored byte-identical from the surviving pre-PR1b stash commit, then verified tests green.
- Live mismatch found by reading (not by tsc): incident-program download URL sent `clienteIds` while the API route reads `clientIds` — fixed as part of 2.3.
- `src/app/client/**` (PR2-owned dir) received schema-parity renames only; one JSX-copy touch reverted to Spanish.

## Remaining (NOT this slice)

- PR2 (REPORTER/JWT/bump/redirects), PR3 (audit), PR4 (observability)
- `test:e2e` runtime once Docker is available (type-level + selector-level consistency done here)

## Workload / PR Boundary

- Mode: stacked PR slice (stacked-to-main); current work unit: PR1b actions-routes-pages
- Boundary: PR1a worktree state → tasks 2.1–2.5 complete, FULL `npm run check` green (PR1b owns the green tree)
- Start: 454 tsc errors (PR1a hit list) → finish: 0 errors, check exit 0
- NOTE: stack on the current branch; do NOT merge (PR1a not merged yet). PR1a + PR1b joint review size exceeds the 400-line budget — the overage is mechanical renames; recommend `size:exception` with this file + tsc/test evidence as the review aid, or split PR1b's CSV (2.4) from the rename sweep on review if the maintainer prefers.
