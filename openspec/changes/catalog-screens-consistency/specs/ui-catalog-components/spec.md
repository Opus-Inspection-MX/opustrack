# UI / Transversal Components Specification (RF-600–649)

> Delta type: **NEW SPEC** (no prior spec exists for this domain)
> Change: `catalog-screens-consistency`
> Slice scope: S0 (CatalogTable + confirm-dialog), consumed by S1–S5

---

## Purpose

Defines the shared building blocks used across all admin catalog screens: a reusable table component (`CatalogTable`) and an accessible confirmation dialog (`confirm-dialog`). These components eliminate 16 duplicated table implementations and 30 inaccessible `window.confirm()` calls.

---

## RF Range Note

RF-600..RF-649 is proposed as the "UI/Componentes transversales" bucket. The overview (spec/00-overview.md) should register this range.

---

## Requirements

---

### RF-601 — CatalogTable: Column Configuration

The system MUST provide a `CatalogTable` component that accepts column definitions as render-props. Each column definition MUST include a header label (Spanish neutral) and a cell render function. The component MUST render column headers exactly as provided; it MUST NOT hardcode any header text.

#### Scenario: Rendering configured columns

- GIVEN a catalog page passes N column definitions to `CatalogTable`
- WHEN the component renders
- THEN the table displays exactly N columns with the provided header labels
- AND each cell renders using the column's render function applied to the row data

#### Scenario: Empty dataset

- GIVEN a catalog page passes an empty data array to `CatalogTable`
- WHEN the component renders
- THEN the table displays an empty-state message (e.g., "Sin resultados")
- AND no table rows are rendered

---

### RF-602 — CatalogTable: Row Actions as Icons

The system MUST render per-row actions exclusively as icon buttons. Each action MUST carry a `tooltip` (visible on hover/focus) and an `aria-label` (for screen readers). The system MUST support at least the canonical set: Eye (view), Pencil (edit), Trash2 (delete). The component MUST support additional extra actions (e.g., Shield for Roles permissions) via an extensible actions prop. The system MUST NOT render a 3-dot dropdown menu for row actions in any migrated screen.

#### Scenario: Canonical actions rendered

- GIVEN a catalog row has view, edit, and delete actions configured
- WHEN the component renders that row
- THEN three icon buttons are visible: Eye, Pencil, Trash2
- AND each button has a matching aria-label (e.g., "Ver", "Editar", "Eliminar")
- AND each button shows a tooltip on hover/focus

#### Scenario: Extra action (Shield/Permissions)

- GIVEN the Roles catalog configures an additional Shield action
- WHEN the component renders a role row
- THEN a Shield icon button is rendered alongside Eye, Pencil, Trash2
- AND the Shield button carries aria-label "Permisos" and a matching tooltip

#### Scenario: Disabled action

- GIVEN an action is configured with `disabled: true` for a specific row
- WHEN the component renders that row
- THEN the corresponding icon button is visually disabled
- AND it is not clickable (pointer-events disabled or aria-disabled)

---

### RF-603 — CatalogTable: Controlled Pagination

The system MUST render pagination state that is fully controlled by the parent page. The component MUST NOT maintain internal pagination state. The parent page MUST pass current page, total items, and page size; the component MUST call the parent's `onPageChange` handler when the user navigates. The component MUST use `ui/pagination.tsx` as its pagination renderer; `common/table-pagination.tsx` MUST NOT be used.

#### Scenario: Page navigation

- GIVEN a catalog page has 3 pages of data
- WHEN the user clicks "next page"
- THEN the component calls `onPageChange(2)`
- AND the parent page fetches page 2 data and updates the component

#### Scenario: Single page — no pagination controls

- GIVEN a catalog page has fewer items than the page size
- WHEN the component renders
- THEN no pagination controls are rendered

---

### RF-604 — CatalogTable: Optional Search Bar

The system MUST render a search input above the table when a `searchable` prop (or equivalent) is provided. When `searchable` is not provided, the search bar MUST NOT render. The search bar MUST be a controlled input; the parent page owns the search state and triggers server-side data fetching on change.

#### Scenario: Search bar present when configured

- GIVEN a catalog page passes `searchable` to `CatalogTable` with an `onSearch` handler
- WHEN the component renders
- THEN a search input is visible above the table

#### Scenario: Search bar absent when not configured

- GIVEN a catalog page does NOT pass `searchable` to `CatalogTable`
- WHEN the component renders
- THEN no search input is rendered

#### Scenario: Search triggers parent handler

- GIVEN the search bar is rendered and the user types a term
- WHEN the user submits or the debounce fires
- THEN the component calls the parent's `onSearch` handler with the current term
- AND does NOT filter the table's data client-side

---

### RF-605 — CatalogTable: Loading State

The system MUST accept a `loading` prop. When `loading` is true, the component MUST display a loading indicator and MUST NOT render stale row data in a misleading state. When `loading` transitions to false, rows MUST render normally.

#### Scenario: Loading in progress

- GIVEN the parent page is fetching data and passes `loading={true}`
- WHEN the component renders
- THEN a loading indicator is visible
- AND no stale data rows are rendered as if fresh

---

### RF-606 — confirm-dialog: Accessible Destructive Confirmation

The system MUST provide a `confirm-dialog` UI component that replaces all `window.confirm()` calls in migrated catalog screens. The dialog MUST be a modal that traps focus, is keyboard-navigable (Escape to cancel, Enter/Space to confirm), and is announced by screen readers. It MUST display a configurable title and description. It MUST expose two outcomes: confirmed and cancelled.

#### Scenario: User confirms destructive action

- GIVEN a catalog row has a Trash2 button and the screen uses `confirm-dialog`
- WHEN the user clicks the Trash2 button
- THEN the confirm-dialog opens with a title and description describing the deletion
- AND focus is trapped inside the dialog
- WHEN the user clicks the confirm button (or presses Enter)
- THEN the dialog closes and the delete action executes
- AND the row is soft-deleted (active set to false)

#### Scenario: User cancels destructive action

- GIVEN the confirm-dialog is open for a deletion
- WHEN the user clicks the cancel button (or presses Escape)
- THEN the dialog closes without executing any action
- AND the row data remains unchanged

#### Scenario: Keyboard accessibility

- GIVEN the confirm-dialog is open
- WHEN the user presses Tab
- THEN focus cycles only within the dialog (focus trap)
- WHEN the user presses Escape
- THEN the dialog closes (cancel outcome)
