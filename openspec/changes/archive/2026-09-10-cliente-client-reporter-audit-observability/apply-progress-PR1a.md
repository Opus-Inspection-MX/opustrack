# Apply Progress — PR1a: schema + helpers + scopes (tasks 1.1–1.5)

Change: `cliente-client-reporter-audit-observability` | Slice: PR1a | Mode: Standard (strict_tdd false)
Chain: stacked-to-main | Date: 2026-09-10

## Completed Tasks

- [x] 1.1 Physical names confirmed from `20260609000000_rename_cliente_remove_priority_sla/migration.sql`
      (live `\d` unavailable — Docker daemon down; drift check documented in migration header).
      Created `prisma/migrations/20260910173827_rename_cliente_to_client/migration.sql`
      via `prisma migrate dev --create-only` (generated SQL discarded, hand-written RENAME-only).
      Zero Permission/Role UPDATEs, no sessionVersion bump.
- [x] 1.2 `prisma/schema.prisma`: `Cliente`→`Client`, `UserClienteAssignment`→`UserClientAssignment`,
      `ScheduleCliente`→`ScheduleClient`, `clienteId`→`clientId` (4 tables), `userId_clientId`,
      `UserProfile.createdAt` added, relation fields `cliente(s)`→`client(s)`,
      `clienteAssignments`→`clientAssignments`. `Client.updatedAt @updatedAt` already present (no change).
      `prisma generate` + `prisma validate` green.
- [x] 1.3 New `src/lib/utils/client-assignments.ts` (9 English fns); old path kept as a
      documented compat shim (aliases only) for 3 PR1b-owned importers; PR1b deletes it.
      Helper test rewritten as `src/lib/utils/client-assignments.test.ts` (old file deleted).
- [x] 1.4 `authz.ts`: `SCOPE_ALL_CLIENTS` identifier, value stays `"scope:all-clientes"` (JWT-safe, PR2 moves value).
      `filters.ts` / `report-scope.ts` fully English (`ReportScope.clientIds`, `scopeIncludesClient`,
      `*ScopeWhere`, `clientAssignments`). No `clientIds`→`reporterIds` collision in these files
      (`clientIds` here means real centers — the CLIENT-user-ids collision lives in PR1b's `clientes.ts`).
      Operator-facing denial message unchanged (Spanish prose; menu still "Cliente").
- [x] 1.5 `filters.test.ts` mock repointed to new path + full English update (13 tests).
      `report-scope.test.ts` English update (16 tests). The other 6 `vi.mock` paths intentionally
      LEFT targeting the shim: their sources (PR1b) still import the old path, and mocking the
      importer's path is correct — PR1b moves mocks with the sources and deletes the shim.
      Old JWT stays valid: no JWT-crossing string changed (verified: no UPDATE/DROP/CREATE in migration;
      `scope:all-clientes`, `clientes:*`, `CLIENT`, `clienteId` claim untouched).

## Work Unit Evidence

| Evidence | Value |
|---|---|
| Focused test command and exact result | `npx vitest run src/lib/utils/client-assignments.test.ts` → 14/14 passed; plus in-slice `filters.test.ts` 13/13, `report-scope.test.ts` 16/16 (43/43 total) |
| Runtime harness command/scenario and exact result | `test:e2e` ephemeral DB — N/A (Docker daemon unavailable in this environment; no DB to run against). Migration SQL hand-verified against migration history names |
| Rollback boundary | Delete `prisma/migrations/20260910173827_rename_cliente_to_client/` + `git checkout -- prisma/schema.prisma` + delete `client-assignments.*` + restore `cliente-assignments.*` + revert `authz.ts`/`filters.*`/`report-scope.*`. No data migration involved (rename not yet applied anywhere) |

## Deviations from Design

1. Migration file contains one safe additive statement (`ADD COLUMN "UserProfile"."createdAt" DEFAULT CURRENT_TIMESTAMP`)
   alongside the RENAMEs — required for schema/migration parity (task 1.2 mandates the column); loss-free, no backfill semantics change.
2. `cliente-assignments.ts` retained as an alias-only shim (marked for PR1b deletion) instead of hard delete,
   so the 3 PR1b source importers keep resolving until PR1b renames them.
3. Only 1 of the 7 `vi.mock` paths repointed (filters.test.ts); the other 6 stay on the shim path their
   PR1b sources still import (see 1.5 note above). No legacy export aliases added to filters/report-scope —
   property accesses (`incident.clienteId`, `prisma.cliente`, …) cannot be shimmed, so aliases would not
   have made `tsc` green anyway.
4. Physical names confirmed via migration history, not live `\d` (Docker down); migration header records
   the pre-deploy `\d` drift check.

## Issues Found

- `npm run check`: biome ✓, knip (files) ✓ standalone, `tsc` ✗ — 454 errors, ALL confined to PR1b-owned
  files (actions/routes/pages/components/src/test) and PR2-owned `src/app/client/**`. Zero errors in PR1a files.
  This is the exact PR1b hit list (tasks 2.1–2.5); tsc suggestions already name the new identifiers.
- `User.clienteId` scalar fallback references in comments use the historical column name — intentionally kept.

## Remaining (NOT this slice)

- PR1b tasks 2.1–2.5 (actions/routes/pages/CSV/seeds/fixtures + `test:unit` + full `npm run check` green)
- PR2 (REPORTER/JWT/bump/redirects), PR3 (audit), PR4 (observability)

## Workload / PR Boundary

- Mode: stacked PR slice (stacked-to-main); current work unit: PR1a schema-helpers-scopes
- Boundary: clean tree (only pre-existing .atl cache dirt) → migration + schema + helpers + scopes + scope tests
- Authored review size: ~557 changed lines tracked (208 ins/349 del) + 388 new-file lines (migration 49, helper 165, helper test 174) — over the 400 budget on paper, but the overage is mechanical renames; bones of PR1a cannot split further without breaking the schema↔code parity the slice exists to establish.
- NOTE: slice is NOT independently green (`tsc` red on PR1b/PR2 files) — PR1b must stack on this branch before merge; do not merge PR1a to main alone.
