# Tasks: Catalog Screens Consistency

> SDD · Phase TASKS · Change: `catalog-screens-consistency`
> Artifact store: hybrid (engram `sdd/catalog-screens-consistency/tasks` + this file)
> Delivery strategy: ask-on-risk · Chain strategy: stacked-to-main · Strict TDD: false

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (total) | ~1 700–2 050 across 7 PRs |
| 400-line budget risk | **High (total); Low per slice** |
| Chained PRs recommended | **Yes** |
| Suggested split | S0 → S1 → S2 → S3 → S4a → S4b → S4c → S5 (stacked to main) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

> Each individual slice is ≤400 lines and can be reviewed independently.
> The orchestrator MUST ask the user whether to proceed slice-by-slice before launching `sdd-apply`.

### Suggested Work Units

| Unit | Goal | Likely PR | Est. lines | Notes |
|------|------|-----------|------------|-------|
| S0 | Foundation: CatalogTable + ConfirmDialog + use-debounce | PR 1 | 200–250 | Pure-add; base for all others |
| S1 | Status tables (6 screens) + fix double pagination | PR 2 | 300–350 | Depends on S0 |
| S2 | incident-types, incident-status icons + confirm | PR 3 | 200–250 | Depends on S0 |
| S3 | States, lines, equipments: action upgrade + page migration | PR 4 | 300–350 | Depends on S0 |
| S4a | Parts + getParts upgrade | PR 5 | 140–160 | Depends on S0 |
| S4b | Users + getUsers upgrade | PR 6 | 160–180 | Depends on S0 |
| S4c | Roles + getRoles + roles-table consolidation + delete table-pagination | PR 7 | 160–175 | Depends on S0; runs last (last consumer of table-pagination) |
| S5 | Vehicles: icon-actions, keep cards | PR 8 | 300–400 | Depends on S0 |

---

## S0 — Foundation (PR 1, base: main) ✅ COMPLETE

**Objective**: Create the shared building blocks; zero migration; zero deletions; pure-add rollback.
**Spec coverage**: RF-601, RF-602, RF-603, RF-604, RF-605, RF-606
**Touches server actions**: No
**Rollback**: Delete the 5 new files.
**Branch**: feat/catalog-table-foundation
**Commits**: 94e26f4 (use-debounce), 422c419 (CatalogTable + ConfirmDialog)

- [x] S0.1 — Create `src/hooks/use-debounce.ts`: single-value debounce hook, generic `T`, delay param defaulting to 300 ms.
- [x] S0.2 — Create `src/components/common/catalog-table/types.ts`: export `CatalogColumn<T>`, `CatalogAction<T>`, `CatalogTableProps<T>` matching the design contract exactly.
- [x] S0.3 — Create `src/components/common/catalog-table/catalog-table.tsx`: implement `CatalogTable<T>` — search `Input` (controlled, calls `onSearchChange`; no debounce inside the component), `Table` body with render-prop columns, actions cell (each action: `Tooltip` + `Button size="icon"` + `aria-label={action.label}`), `ui/pagination.tsx` when pagination props are present, one internal `ConfirmDialog` driven by `requiresConfirm`, loading row, empty-state row (RF-601–605).
- [x] S0.4 — Add `@/components/common/table-pagination` deprecation comment to `src/components/common/table-pagination.tsx` (JSDoc `@deprecated` — do NOT delete; do NOT touch consumers).
- [x] S0.5 — Create `src/components/ui/confirm-dialog.tsx`: `ConfirmDialog` built on `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter`; confirm `Button` uses `destructive` variant when `props.variant === "destructive"`; defaults `confirmLabel="Confirmar"`, `cancelLabel="Cancelar"` (RF-606). Note: confirmLabel default is "Confirmar" (not "Eliminar") to be generic; destructive actions in CatalogTable pass "Eliminar" explicitly.
- [x] S0.6 — Create `src/components/common/catalog-table/index.ts`: barrel exports for `CatalogTable`, `CatalogColumn`, `CatalogAction`, `CatalogTableProps`.
- [x] S0.7 — Verification: `npm run lint` → 0 errors; `npx tsc --noEmit` → 0 errors (filtering .next/). Pure-add confirmed: only new files + @deprecated annotation on table-pagination.tsx.

---

## S1 — Status Tables / Fix Double Pagination (PR 2, base: main, dep: S0 merged) ✅ COMPLETE

**Objective**: Migrate 6 GenericStatusTable usages to `CatalogTable`; eliminate internal pagination `useState`; preserve assignment-status banner.
**Spec coverage**: RF-603, RF-653, RF-654, RF-656, RF-659
**Touches server actions**: No (status lookups return full arrays; no pagination contract upgrade needed)
**Rollback**: Revert component + page changes; S0 stays.
**Branch**: feat/catalog-status-tables
**Commits**: d070a33, 0458039, a2ada82, bdb187a, 4d13fab

- [x] S1.1 — Grep importers: confirmed 5 settings pages + 1 user-status page (/admin/user-status/) use GenericStatusTable. No separate status-table components used by these pages (user-status-table.tsx was dead code with 0 importers).
- [x] S1.2 — Migration approach: inline CatalogTable in each page directly (no intermediate component); columns defined as module-level constant; actions array defined inside component (closure over fetchData/router).
- [x] S1.3 — Migrated /admin/user-status/page.tsx: CatalogTable + useDebounce + controlled pagination; Spanish headers (ID, Nombre, Usuarios, Estado); ConfirmDialog via requiresConfirm on Trash2.
- [x] S1.4 — Migrated /admin/settings/equipment-status/page.tsx: same pattern; _count key: equipments.
- [x] S1.5 — Migrated /admin/settings/line-status/page.tsx: same pattern; _count key: lines.
- [x] S1.6 — Migrated /admin/settings/vehicle-status/page.tsx: same pattern; _count key: vehicles.
- [x] S1.7 — Migrated /admin/settings/vehicle-trip-status/page.tsx: same pattern; _count key: trips.
- [x] S1.8 — Migrated /admin/settings/assignment-status/page.tsx; warning banner preserved above CatalogTable (RF-656); _count key: assignments.
- [x] S1.9 — Manual verification: 0 window.confirm in src; 0 GenericStatusTable consumers; 0 table-pagination in migrated files; Spanish headers (ID/Nombre/[count]/Estado); lint 0 errors; tsc 0 errors; assignment-status banner present.

---

## S2 — Incident Types & Incident Status: Icons + Confirm (PR 3, base: main, dep: S0 merged) ✅ COMPLETE

**Objective**: Replace 3-dot dropdown actions with icon buttons; replace `window.confirm` with `ConfirmDialog` in incident-types and incident-status screens.
**Spec coverage**: RF-602, RF-606, RF-653, RF-654, RF-659
**Touches server actions**: No (search already server-side per design note)
**Rollback**: Revert page changes; S0 stays.
**Branch**: feat/catalog-incident-tables
**Commits**: a0a5496

- [x] S2.1 — Grep importers: incident-type-table only imported by /admin/incident-types/page.tsx; incident-status-table only imported by /admin/incident-status/page.tsx. Zero other consumers.
- [x] S2.2 — Migrated /admin/incident-types/page.tsx to inline CatalogTable; columns: ID, Nombre, Descripción, Prioridad (PriorityBadge preserved), Estado, Incidentes; Eye/Pencil href actions + Trash2 requiresConfirm; disabled when incidentCount > 0; useDebounce 300 ms; controlled pagination.
- [x] S2.3 — incident-types page already was "use client"; converted to direct CatalogTable inline (no intermediate component); removed old IncidentTypeTable, Pagination, Search/Label/Spinner block; 0 window.confirm.
- [x] S2.4 — Migrated /admin/incident-status/page.tsx to inline CatalogTable; columns: ID, Nombre, Color (swatch + hex), Vista previa (styled Badge with row.color), Incidentes, Estado; Spanish headers throughout; color preview badge preserved.
- [x] S2.5 — incident-status page same pattern; removed old IncidentStatusTable, double-Pagination, window.confirm; 0 DropdownMenu.
- [x] S2.6 — Manual verification: 0 window.confirm in src (global rg check); 0 DropdownMenu in migrated pages; PriorityBadge preserved in incident-types; color preview Badge preserved in incident-status; Spanish headers; lint 0 errors; tsc --noEmit 0 errors.

---

## S3 — States, Lines, Equipments: Action Upgrade + Page Migration (PR 4, base: main, dep: S0 merged) ✅ COMPLETE

**Objective**: Upgrade 3 server actions to `{page,limit,search}→{data,pagination}` contract; migrate their pages and table components to `CatalogTable`.
**Spec coverage**: RF-651, RF-652, RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getStatesAdmin` (lookups.ts), `getLines` (lines.ts), `getEquipments` (equipments.ts)
**Branch**: feat/catalog-geographic
**Commits**: cd0a566 (action upgrades), 3da69e2 (page migrations)

- [x] S3.1 — Grep callers of getStatesAdmin: only `src/app/admin/states/page.tsx`. Separate `getStates()` in clientes.ts is a selector for forms — untouched.
- [x] S3.2 — Upgraded `getStatesAdmin` in lookups.ts: {page,limit,search}→{data,pagination}; OR on name+code; Promise.all; requirePermission + active:true preserved.
- [x] S3.3 — states/page.tsx updated to consume {data, pagination}.
- [x] S3.4 — states/page.tsx migrated inline to CatalogTable; columns: ID/Nombre/Código/Clientes/Estado; Trash2 disabled when _count.clientes > 0.
- [x] S3.5 — States page wired with useDebounce(300ms), controlled pagination, reset page=1 on search change.
- [x] S3.6 — Grep callers of getLines: only `src/app/admin/lines/page.tsx`. `getLinesByClienteId` in lines.ts is a selector — untouched.
- [x] S3.7 — Upgraded `getLines` in lines.ts: {page,limit,search}→{data,pagination}; OR on name+description; equipments via select:{id} for count.
- [x] S3.8 — lines/page.tsx updated to consume {data, pagination}.
- [x] S3.9 — lines/page.tsx migrated inline to CatalogTable; columns: ID/Nombre/Descripción/Cliente/Equipos/Estado; Trash2 disabled when equipments.length > 0.
- [x] S3.10 — Lines page wired with useDebounce(300ms), controlled pagination.
- [x] S3.11 — Grep callers of getEquipments: only `src/app/admin/equipments/page.tsx`. `getEquipmentsByLineId` is a selector — untouched.
- [x] S3.12 — Upgraded `getEquipments` in equipments.ts: {page,limit,search}→{data,pagination}; OR on name+description.
- [x] S3.13 — equipments/page.tsx updated to consume {data, pagination}.
- [x] S3.14 — equipments/page.tsx migrated inline to CatalogTable; columns: ID/Nombre/Descripción/Línea/Cliente/Estado.
- [x] S3.15 — Equipments page wired with useDebounce(300ms), controlled pagination.
- [x] S3.16 — Manual: lint 0 errors, tsc 0 errors; 0 window.confirm globally; 0 DropdownMenu in 3 pages; server-side search on all 3; RBAC (requirePermission) preserved in all 3 actions.

---

## S4a — Parts + getParts Upgrade (PR 5, base: main, dep: S0 merged)

**Objective**: Upgrade `getParts` to `{page,limit,search}→{data,pagination}`; migrate part-table and parts page to `CatalogTable`.
**Spec coverage**: RF-651, RF-652, RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getParts` in `src/lib/actions/parts.ts`
**Rollback**: Revert action + component + page.

- [x] S4a.1 — Grep callers: `rg "getParts" src --include="*.tsx" --include="*.ts"` — record every importer.
- [x] S4a.2 — Upgrade `getParts` in `src/lib/actions/parts.ts` to `{page,limit,search}→{data,pagination}`; preserve RBAC guard; search OR on name (and code/sku if fields exist); numeric id → no id search.
- [x] S4a.3 — Update every getParts caller found in S4a.1 to consume `{data, pagination}`.
- [x] S4a.4 — Migrate parts admin page to inline CatalogTable (parts-table.tsx is now dead code); drop DropdownMenu; Spanish column headers; icon actions Eye/Pencil/Trash2.
- [x] S4a.5 — Convert the parts admin page to client component pattern; wire to upgraded `getParts`; `onSearchChange` resets page to 1.
- [x] S4a.6 — Manual verification: lint 0, tsc 0, no window.confirm globally, no DropdownMenu in parts page, no table-pagination in parts page, Spanish headers, icon actions, ConfirmDialog on delete.

---

## S4b — Users + getUsers Upgrade (PR 6, base: main, dep: S0 merged) ✅ COMPLETE

**Objective**: Upgrade `getUsers` to `{page,limit,search}→{data,pagination}`; migrate user-table and users page to `CatalogTable`.
**Spec coverage**: RF-651, RF-652 (search: id+name+email), RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getUsers` in `src/lib/actions/users.ts`
**Rollback**: Revert action + component + page.

- [x] S4b.1 — Grep callers: `rg "getUsers" src --include="*.tsx" --include="*.ts"` — record every importer.
- [x] S4b.2 — Upgrade `getUsers` in `src/lib/actions/users.ts` to `{page,limit,search}→{data,pagination}`; preserve RBAC guard; search OR on `id` (String → `contains`), `name`, `email` (RF-652).
- [x] S4b.3 — Update every getUsers caller found in S4b.1 to consume `{data, pagination}`.
- [x] S4b.4 — Migrate `src/components/users/user-table.tsx` to `CatalogTable`; drop `TablePagination`; Spanish column headers.
- [x] S4b.5 — Convert the users admin page to client component pattern; wire to upgraded `getUsers`; `onSearchChange` resets page to 1.
- [x] S4b.6 — Manual verification: users screen — id/name/email search works; pagination; icon actions; confirm-dialog on delete; Spanish headers; no `window.confirm`.

---

## S4c — Roles + getRoles + Consolidation + Delete table-pagination (PR 7, base: main, dep: S0 + S4a + S4b merged)

**Objective**: Upgrade `getRoles`; migrate roles page; add Shield "Permisos" action to `admin/roles/roles-table`; delete unused `roles/role-table.tsx`; delete `common/table-pagination.tsx` (last consumer migrated).
**Spec coverage**: RF-602 (Shield extra action), RF-651, RF-652, RF-653, RF-654, RF-655, RF-659
**Touches server actions**: Yes — `getRoles` in `src/lib/actions/roles.ts`
**Rollback**: Revert all changes; do NOT re-add deleted files (use `git revert` if needed after merge).
**Dependency note**: S4c MUST run after S4a and S4b to guarantee `table-pagination.tsx` has no remaining live consumers before deletion.

- [x] S4c.1 — Grep `roles/role-table` importers — confirmed zero external importers (only self-declaration inside the file).
- [x] S4c.2 — Delete `src/components/roles/role-table.tsx` (RF-655; zero importers confirmed). `git rm` executed.
- [x] S4c.3 — Grep callers of `getRoles` — single caller: `src/app/admin/roles/page.tsx` (list page only). No selector callers found; `getRolesForSelect` added preemptively but no migration needed for callers.
- [x] S4c.4 — Upgrade `getRoles` in `src/lib/actions/roles.ts` to `{page,limit,search}→{data,pagination}`; OR search on name+description (case-insensitive); RBAC guard preserved. `getRolesForSelect` added for future selector use.
- [x] S4c.5 — `roles/page.tsx` migrated to consume `{data, pagination}` (inline CatalogTable; no separate component needed). `src/components/admin/roles/roles-table.tsx` deleted (zero importers after page rewrite).
- [x] S4c.6 — `admin/roles/roles-table.tsx` deleted (replaced by inline CatalogTable in page). Shield action with `label="Permisos"` navigates to `/admin/roles/{id}/permissions` (RF-602 extra action).
- [x] S4c.7 — `src/app/admin/roles/page.tsx` rewritten as `"use client"` component; `useDebounce` 300ms; `onSearchChange` resets page to 1; controlled pagination.
- [ ] S4c.8 — GATE FAILED: `table-pagination.tsx` has 5 active consumers in non-migrated components (work-parts, assignment-activities, schedules, permissions, incidents-table). Deletion deferred to future slices.
- [ ] S4c.9 — DEFERRED: `table-pagination.tsx` NOT deleted (S4c.8 gate failed — active consumers remain).
- [x] S4c.10 — Verification: lint 0 errors (Biome); tsc 0 errors; no `window.confirm` in roles page; Shield action present navigating to permissions; `rg "roles/role-table" src` → zero matches; `rg "admin/roles/roles-table" src` → zero matches.

---

## S5 — Vehicles: Icon Actions, Preserve Cards (PR 8, base: main, dep: S0 merged)

**Objective**: Replace 3-dot `DropdownMenu` with icon buttons (Eye, Pencil, Trash2) on the vehicles card-based list; DO NOT migrate to `CatalogTable`; preserve mobile card layout.
**Spec coverage**: RF-602, RF-606, RF-657, RF-659
**Touches server actions**: No
**Rollback**: Revert vehicle-table component change only.

- [x] S5.1 — Grep importers: `rg "vehicle-table\|VehicleTable" src --include="*.tsx" --include="*.ts"` — confirm which pages use the vehicles table.
- [x] S5.2 — Open `src/app/admin/vehicles/page.tsx`; identify how the vehicle list is rendered (server component vs client; existing DropdownMenu usage).
- [x] S5.3 — Replace the 3-dot `DropdownMenu` actions in the vehicles list with individual icon buttons (Eye → view detail, Pencil → edit, Trash2 → delete); wrap each in `Tooltip` with matching `aria-label` (RF-602); use `ConfirmDialog` from S0 for the delete action (RF-606, RF-659); do NOT use `CatalogTable` (RF-657).
- [x] S5.4 — Preserve the mobile card layout: do not change grid/flex structure, card JSX, or responsive breakpoints.
- [x] S5.5 — Manual verification: vehicles page on mobile viewport — cards intact; icon buttons visible; tooltip on hover; Escape cancels confirm; delete executes only after confirm; no `window.confirm`; no 3-dot dropdown menu.

---

## Cross-Slice Verification Checklist

After all slices are merged, run these checks against the full codebase:

- [ ] CV.1 — `rg "window\.confirm" src` → zero matches (RF-659)
- [ ] CV.2 — `rg "table-pagination" src` → zero matches (RF-654)
- [ ] CV.3 — `rg "roles/role-table" src` → zero matches (RF-655)
- [ ] CV.4 — Navigate to `/admin/permissions` — page renders unchanged (RF-658)
- [ ] CV.5 — Attempt unauthenticated call to each upgraded server action → receives same auth error as before (RF-651 RBAC preservation)
- [ ] CV.6 — Navigate to `/admin/settings/assignment-status` — warning banner is visible above the table (RF-656)
