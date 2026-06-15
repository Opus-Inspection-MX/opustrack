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

## S2 — Incident Types & Incident Status: Icons + Confirm (PR 3, base: main, dep: S0 merged)

**Objective**: Replace 3-dot dropdown actions with icon buttons; replace `window.confirm` with `ConfirmDialog` in incident-types and incident-status screens.
**Spec coverage**: RF-602, RF-606, RF-653, RF-654, RF-659
**Touches server actions**: No (search already server-side per design note)
**Rollback**: Revert component changes; S0 stays.

- [ ] S2.1 — Grep importers: `rg "incident-type-table|incident-status-table" src --include="*.tsx" --include="*.ts"` — confirm which pages import these components.
- [ ] S2.2 — Migrate `src/components/incident-types/incident-type-table.tsx` to `CatalogTable`; define `columns` (Spanish headers); define `actions` array with Eye, Pencil, Trash2 — Trash2 with `requiresConfirm: true`, `confirmTitle`, `confirmMessage`; remove `TablePagination` import; pass controlled pagination from page.
- [ ] S2.3 — Update the incident-types page (find from S2.1 grep) to be a client component with `page/limit/search/loading` state; wire `useDebounce`; call existing action; pass props to migrated table.
- [ ] S2.4 — Migrate `src/components/incident-status/incident-status-table.tsx` to `CatalogTable`; same pattern as S2.2.
- [ ] S2.5 — Update the incident-status page to client component pattern (same as S2.3).
- [ ] S2.6 — Manual verification: confirm no 3-dot dropdown menus in either screen; Trash2 opens `ConfirmDialog` (not `window.confirm`); keyboard Escape cancels; Enter/Space confirms; all headers in Spanish.

---

## S3 — States, Lines, Equipments: Action Upgrade + Page Migration (PR 4, base: main, dep: S0 merged)

**Objective**: Upgrade 3 server actions to `{page,limit,search}→{data,pagination}` contract; migrate their pages and table components to `CatalogTable`.
**Spec coverage**: RF-651, RF-652, RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getStatesAdmin` (lookups.ts), `getLines` (lines.ts), equipments action
**Rollback**: Revert action + page + component changes together; callers migrated in same PR so no orphan callers.

- [ ] S3.1 — Grep callers before touching actions: `rg "getStatesAdmin" src --include="*.tsx" --include="*.ts"` — list every file that imports `getStatesAdmin`; record the list.
- [ ] S3.2 — Upgrade `getStatesAdmin` in `src/lib/actions/lookups.ts`: add optional `params?: {page?,limit?,search?}`; add `Promise.all([findMany,count])`; return `{data, pagination}`; preserve `requirePermission` and `where.active:true`; search OR on name+code (String fields); numeric id → no id search.
- [ ] S3.3 — Update every caller found in S3.1 to consume `{data, pagination}` (destructure `r.data` / `r.pagination.total`).
- [ ] S3.4 — Migrate `src/components/states/state-table.tsx` to `CatalogTable`; drop `TablePagination` import; neutralize column headers.
- [ ] S3.5 — Convert the states admin page to client component pattern; add `page/limit/search/debounce/loading` state; wire to upgraded `getStatesAdmin`; pass controlled props to `CatalogTable`.
- [ ] S3.6 — Grep callers: `rg "getLines" src --include="*.tsx" --include="*.ts"` — record list.
- [ ] S3.7 — Upgrade `getLines` in `src/lib/actions/lines.ts` to `{page,limit,search}→{data,pagination}` contract; same pattern as S3.2.
- [ ] S3.8 — Update every getLines caller found in S3.6.
- [ ] S3.9 — Migrate `src/components/lines/line-table.tsx` to `CatalogTable`; drop `TablePagination`; Spanish headers.
- [ ] S3.10 — Convert the lines admin page to client component pattern; wire to upgraded `getLines`.
- [ ] S3.11 — Grep callers: `rg "getEquipments\|getEquipmentAdmin" src --include="*.tsx" --include="*.ts"` — record list.
- [ ] S3.12 — Upgrade equipments action in `src/lib/actions/equipments.ts` to `{page,limit,search}→{data,pagination}` contract.
- [ ] S3.13 — Update every equipments caller found in S3.11.
- [ ] S3.14 — Migrate `src/components/equipments/equipment-table.tsx` to `CatalogTable`; drop `TablePagination`; Spanish headers.
- [ ] S3.15 — Convert the equipments admin page to client component pattern; wire to upgraded action.
- [ ] S3.16 — Manual verification: each of the 3 screens — pagination works; search filters server-side; RBAC rejections still work for unauthorized roles; no double pagination; no `window.confirm`.

---

## S4a — Parts + getParts Upgrade (PR 5, base: main, dep: S0 merged)

**Objective**: Upgrade `getParts` to `{page,limit,search}→{data,pagination}`; migrate part-table and parts page to `CatalogTable`.
**Spec coverage**: RF-651, RF-652, RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getParts` in `src/lib/actions/parts.ts`
**Rollback**: Revert action + component + page.

- [ ] S4a.1 — Grep callers: `rg "getParts" src --include="*.tsx" --include="*.ts"` — record every importer.
- [ ] S4a.2 — Upgrade `getParts` in `src/lib/actions/parts.ts` to `{page,limit,search}→{data,pagination}`; preserve RBAC guard; search OR on name (and code/sku if fields exist); numeric id → no id search.
- [ ] S4a.3 — Update every getParts caller found in S4a.1 to consume `{data, pagination}`.
- [ ] S4a.4 — Migrate `src/components/parts/part-table.tsx` to `CatalogTable`; drop `TablePagination`; Spanish column headers.
- [ ] S4a.5 — Convert the parts admin page to client component pattern; wire to upgraded `getParts`; `onSearchChange` resets page to 1.
- [ ] S4a.6 — Manual verification: parts screen — pagination, search, icon actions, confirm-dialog on delete, Spanish headers, no `window.confirm`.

---

## S4b — Users + getUsers Upgrade (PR 6, base: main, dep: S0 merged)

**Objective**: Upgrade `getUsers` to `{page,limit,search}→{data,pagination}`; migrate user-table and users page to `CatalogTable`.
**Spec coverage**: RF-651, RF-652 (search: id+name+email), RF-653, RF-654, RF-659
**Touches server actions**: Yes — `getUsers` in `src/lib/actions/users.ts`
**Rollback**: Revert action + component + page.

- [ ] S4b.1 — Grep callers: `rg "getUsers" src --include="*.tsx" --include="*.ts"` — record every importer.
- [ ] S4b.2 — Upgrade `getUsers` in `src/lib/actions/users.ts` to `{page,limit,search}→{data,pagination}`; preserve RBAC guard; search OR on `id` (String → `contains`), `name`, `email` (RF-652).
- [ ] S4b.3 — Update every getUsers caller found in S4b.1 to consume `{data, pagination}`.
- [ ] S4b.4 — Migrate `src/components/users/user-table.tsx` to `CatalogTable`; drop `TablePagination`; Spanish column headers.
- [ ] S4b.5 — Convert the users admin page to client component pattern; wire to upgraded `getUsers`; `onSearchChange` resets page to 1.
- [ ] S4b.6 — Manual verification: users screen — id/name/email search works; pagination; icon actions; confirm-dialog on delete; Spanish headers; no `window.confirm`.

---

## S4c — Roles + getRoles + Consolidation + Delete table-pagination (PR 7, base: main, dep: S0 + S4a + S4b merged)

**Objective**: Upgrade `getRoles`; migrate roles page; add Shield "Permisos" action to `admin/roles/roles-table`; delete unused `roles/role-table.tsx`; delete `common/table-pagination.tsx` (last consumer migrated).
**Spec coverage**: RF-602 (Shield extra action), RF-651, RF-652, RF-653, RF-654, RF-655, RF-659
**Touches server actions**: Yes — `getRoles` in `src/lib/actions/roles.ts`
**Rollback**: Revert all changes; do NOT re-add deleted files (use `git revert` if needed after merge).
**Dependency note**: S4c MUST run after S4a and S4b to guarantee `table-pagination.tsx` has no remaining live consumers before deletion.

- [ ] S4c.1 — Grep `roles/role-table` importers: `rg "roles/role-table" src --include="*.tsx" --include="*.ts"` — confirm zero importers (design decision: zero importers established at design phase; verify before deleting).
- [ ] S4c.2 — Delete `src/components/roles/role-table.tsx` (RF-655; confirmed zero importers in S4c.1).
- [ ] S4c.3 — Grep callers: `rg "getRoles" src --include="*.tsx" --include="*.ts"` — record every importer.
- [ ] S4c.4 — Upgrade `getRoles` in `src/lib/actions/roles.ts` to `{page,limit,search}→{data,pagination}`; preserve RBAC guard; search OR on name (numeric id → no id search).
- [ ] S4c.5 — Update every getRoles caller found in S4c.3 to consume `{data, pagination}`.
- [ ] S4c.6 — Migrate `src/components/admin/roles/roles-table.tsx` to `CatalogTable`; add Shield icon action with `label="Permisos"` and `aria-label="Permisos"` that navigates to the permissions assignment route (RF-602 extra action); drop `TablePagination` import; Spanish column headers.
- [ ] S4c.7 — Convert the admin roles page to client component pattern; wire to upgraded `getRoles`; `onSearchChange` resets page to 1.
- [ ] S4c.8 — Grep final check: `rg "table-pagination" src --include="*.tsx" --include="*.ts"` — confirm zero remaining imports (all consumers from S1–S4b must be gone; if any remain, stop and resolve before proceeding).
- [ ] S4c.9 — Delete `src/components/common/table-pagination.tsx` only after S4c.8 returns zero results (RF-654).
- [ ] S4c.10 — Manual verification: roles screen — pagination, search, Eye/Pencil/Trash2/Shield icon actions; Permisos action navigates correctly; confirm-dialog on delete; Spanish headers; `rg "table-pagination" src` returns zero matches; `rg "roles/role-table" src` returns zero matches.

---

## S5 — Vehicles: Icon Actions, Preserve Cards (PR 8, base: main, dep: S0 merged)

**Objective**: Replace 3-dot `DropdownMenu` with icon buttons (Eye, Pencil, Trash2) on the vehicles card-based list; DO NOT migrate to `CatalogTable`; preserve mobile card layout.
**Spec coverage**: RF-602, RF-606, RF-657, RF-659
**Touches server actions**: No
**Rollback**: Revert vehicle-table component change only.

- [ ] S5.1 — Grep importers: `rg "vehicle-table\|VehicleTable" src --include="*.tsx" --include="*.ts"` — confirm which pages use the vehicles table.
- [ ] S5.2 — Open `src/app/admin/vehicles/page.tsx`; identify how the vehicle list is rendered (server component vs client; existing DropdownMenu usage).
- [ ] S5.3 — Replace the 3-dot `DropdownMenu` actions in the vehicles list with individual icon buttons (Eye → view detail, Pencil → edit, Trash2 → delete); wrap each in `Tooltip` with matching `aria-label` (RF-602); use `ConfirmDialog` from S0 for the delete action (RF-606, RF-659); do NOT use `CatalogTable` (RF-657).
- [ ] S5.4 — Preserve the mobile card layout: do not change grid/flex structure, card JSX, or responsive breakpoints.
- [ ] S5.5 — Manual verification: vehicles page on mobile viewport — cards intact; icon buttons visible; tooltip on hover; Escape cancels confirm; delete executes only after confirm; no `window.confirm`; no 3-dot dropdown menu.

---

## Cross-Slice Verification Checklist

After all slices are merged, run these checks against the full codebase:

- [ ] CV.1 — `rg "window\.confirm" src` → zero matches (RF-659)
- [ ] CV.2 — `rg "table-pagination" src` → zero matches (RF-654)
- [ ] CV.3 — `rg "roles/role-table" src` → zero matches (RF-655)
- [ ] CV.4 — Navigate to `/admin/permissions` — page renders unchanged (RF-658)
- [ ] CV.5 — Attempt unauthenticated call to each upgraded server action → receives same auth error as before (RF-651 RBAC preservation)
- [ ] CV.6 — Navigate to `/admin/settings/assignment-status` — warning banner is visible above the table (RF-656)
