# Catalog Screen Consistency Specification (RF-650–699)

> Delta type: **NEW SPEC** (no prior spec exists for this domain)
> Change: `catalog-screens-consistency`
> Covers: all admin catalog screens except `/admin/permissions`

---

## Purpose

Defines the required behavioral pattern for all admin catalog screens: server-side search contract, header language normalization, action normalization, pagination consolidation, and preservation constraints. Establishes which screens are in scope and which are excluded.

---

## Requirements

---

### RF-651 — Server-Side Search Contract for Catalog Actions

Server actions that power migrated catalog screens MUST accept `{ page: number, limit: number, search: string }` as their input contract and MUST return `{ data: T[], pagination: { total: number, page: number, limit: number, totalPages: number } }`. Search MUST filter by: record id (partial match) AND record name AND the catalog's obvious secondary field (see RF-652). Client-side filtering over a full dataset is PROHIBITED in migrated screens.

Affected actions: `getStatesAdmin`, `getLines`, equipments equivalent, `getRoles`, `getUsers`, `getParts`. Each MUST preserve its existing RBAC guard (`requirePermission` / `requireAction` / `requireRouteAccess`) unchanged.

#### Scenario: Search with matching results

- GIVEN the user types "DF" in the search bar of the States catalog
- WHEN the search fires and `getStatesAdmin({ page: 1, limit: 10, search: "DF" })` is called
- THEN the server action filters states by id OR name containing "DF"
- AND returns `{ data: [...], pagination: { total: N, page: 1, limit: 10, totalPages: M } }`

#### Scenario: Search with no results

- GIVEN the user types a term that matches no records
- WHEN the server action executes
- THEN it returns `{ data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } }`
- AND the table renders the empty-state message (RF-601)

#### Scenario: RBAC guard preserved after upgrade

- GIVEN a server action is upgraded to the new contract
- WHEN an unauthenticated or unauthorized request calls the action
- THEN the action rejects with the same authorization error as before the upgrade

---

### RF-652 — Search Fields by Catalog

Each catalog's search MUST include id + name + the catalog-specific obvious field listed below. Adding extra fields is allowed; the minimum set MUST be met.

| Catalog | Minimum search fields |
|---------|----------------------|
| States | id, name |
| Lines | id, name |
| Equipments | id, name |
| Roles | id, name |
| Users | id, name, email |
| Parts | id, name |
| Incident Types | id, name |
| Incident Status | id, name |
| User / Equipment / Assignment / Line / Vehicle / Vehicle Trip Status | id, name |

---

### RF-653 — Column Header Language Normalization

All column headers in migrated catalog tables MUST be in neutral Spanish. Existing English headers (e.g., "Name", "Status", "Actions") MUST be replaced.

#### Scenario: Migrated table renders Spanish headers

- GIVEN a catalog table is migrated to `CatalogTable`
- WHEN the page renders
- THEN all column headers are in neutral Spanish (e.g., "Nombre", "Estado", "Acciones")
- AND no English column header labels are present

---

### RF-654 — Single Pagination Component

After migration of each slice, affected screens MUST use only `ui/pagination.tsx`. `common/table-pagination.tsx` MUST be marked deprecated in Slice 0 and MUST be physically deleted when its last consumer is removed. No new code MAY import `common/table-pagination.tsx`.

#### Scenario: Deprecated component not used post-migration

- GIVEN a catalog screen has been migrated in its slice
- WHEN the screen renders
- THEN the page uses `ui/pagination.tsx` and not `common/table-pagination.tsx`

#### Scenario: table-pagination.tsx deleted after last consumer

- GIVEN all catalog screens have been migrated
- WHEN the codebase is scanned for imports of `common/table-pagination.tsx`
- THEN zero imports are found
- AND the file is removed from the repository

---

### RF-655 — Roles Table Consolidation

The duplicate `roles-table` (paths: `src/components/roles/role-table.tsx` and `src/components/admin/roles/roles-table.tsx`) MUST be consolidated into a single component in Slice 4. After consolidation, only one implementation MAY exist.

#### Scenario: Single roles table component post-consolidation

- GIVEN Slice 4 has been applied
- WHEN the codebase is scanned for roles table implementations
- THEN only one roles table component file exists
- AND all routes that previously used either path now use the consolidated component

---

### RF-656 — assignment-status Banner Preservation

The warning banner in `assignment-status` (communicates state machine coupling) MUST survive migration to `CatalogTable` in Slice 1. The banner MUST render in the same position and with the same content after migration.

#### Scenario: Banner visible after Slice 1 migration

- GIVEN the assignment-status screen has been migrated to `CatalogTable`
- WHEN an administrator navigates to `/admin/settings/assignment-status`
- THEN the state machine warning banner is visible
- AND the CatalogTable renders without suppressing the banner

---

### RF-657 — Vehicles Custom Exception

The vehicles catalog MUST NOT be migrated to `CatalogTable`. However, its per-row actions MUST be updated to use icon buttons (Eye, Pencil, Trash2) with tooltip and aria-label (RF-602). The card layout MUST be preserved.

#### Scenario: Vehicles use icon actions, not 3-dot menu

- GIVEN the vehicles admin page renders
- WHEN an administrator views the vehicle list
- THEN each vehicle card/row shows icon buttons for actions (not a dropdown menu)
- AND each icon button has aria-label and tooltip

#### Scenario: Card layout preserved

- GIVEN the vehicles admin page renders on a mobile viewport
- WHEN an administrator views the list
- THEN the card-based layout is intact

---

### RF-658 — Permissions Screen Exclusion

The `/admin/permissions` screen MUST NOT be migrated as part of this change. It MUST remain in its current state and MUST NOT break as a side effect of this change.

#### Scenario: Permissions screen unaffected

- GIVEN the `catalog-screens-consistency` change is fully applied
- WHEN an administrator navigates to `/admin/permissions`
- THEN the page renders identically to its pre-change state

---

### RF-659 — No window.confirm in Migrated Screens

After each slice is applied, zero uses of `window.confirm()` MAY remain in the migrated screens. All confirmation interactions MUST use the `confirm-dialog` component (RF-606).

#### Scenario: Delete via confirm-dialog only

- GIVEN a migrated catalog screen
- WHEN the developer scans the screen's component files for `window.confirm`
- THEN zero occurrences are found

---

## Cross-Reference: Existing Domain RFs

| Area | Impact |
|------|--------|
| RBAC / authorization (transversal) | RF-651 explicitly preserves all guards — no authorization requirement is weakened |
| Incident catalogs (specs 01–09 domain) | UI pattern changes (actions + confirmation); data model and business rules unchanged |
| User / Roles / Parts management | UI pattern changes only; permission semantics untouched |
| `common/table-pagination.tsx` tech debt | Resolved by RF-654 |
