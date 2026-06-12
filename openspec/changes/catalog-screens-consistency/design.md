# Design: Catalog Screens Consistency

## Technical Approach

Introduce one client-side foundation component `CatalogTable<T>` (render-prop columns + icon-actions + optional server-driven search + page-controlled pagination) plus `ConfirmDialog` over the existing `ui/dialog`. Standardize every catalog server action on the contract already proven in `lib/actions/lookups.ts` (`getUserStatuses`): input `{page, limit, search}` → output `{ data: T[], pagination: { total, page, limit, totalPages } }`. Pages become the single source of truth for pagination/search state (kills double pagination). Vehicles stay custom (mobile card layout intact) but swap the 3-dot `DropdownMenu` for the same icon-action set. Pagination consolidates on `ui/pagination.tsx`; `common/table-pagination.tsx` is deprecated and physically removed only after its last consumer migrates (S4).

## Architecture Decisions

| Decision | Choice | Rejected | Rationale |
|---|---|---|---|
| Column API | Render-prop `cell(item) => ReactNode` + `header` string | Declarative `accessorKey`/formatter map (TanStack-style) | Render-prop matches existing inline JSX (badges, links, icons) with zero abstraction tax; no new dep |
| Search location | 100% server-side, controlled via `searchValue`/`onSearchChange` | Client filter on loaded page | Contract closed in proposal; tables already paginate server-side in lookups |
| Pagination ownership | Page owns `currentPage`/`itemsPerPage`; CatalogTable is controlled-only | Internal `useState` in table | Internal state is the double-pagination bug; controlled = one source of truth |
| Pagination component | Reuse `ui/pagination.tsx` (Spanish copy, total-aware) | `common/table-pagination.tsx` | ui/pagination already has neutral-Spanish copy and the `total` prop; the other duplicates it |
| Confirm flow | CatalogTable owns one internal `ConfirmDialog`, opened by `action.requiresConfirm` | Each page wires its own dialog | Centralizes accessibility; removes 30 `window.confirm` in one place |
| Server contract | `{ data, pagination }` (copy `getUserStatuses` shape) | Tuple / bare array+count | Already the de-facto standard in lookups.ts; minimizes net-new surface |
| Vehicles | Custom component, NOT inside CatalogTable; shares only icon/tooltip set | Force into CatalogTable with card slot | Card+desktop dual layout doesn't fit the generic table; copying icon set is cheap and keeps generic API clean |
| Roles-table dedup | Keep `admin/roles/roles-table.tsx` (live, page-wired); delete unused `roles/role-table.tsx` | Keep generic `roles/role-table.tsx` | The live one is imported by `admin/roles/page.tsx`; the other has zero importers (proposal/report only) |

## Interfaces / Contracts

### `CatalogTable<T>` — `src/components/common/catalog-table/`

```ts
import type { LucideIcon } from "lucide-react";

export interface CatalogColumn<T> {
  header: string;                       // neutral-Spanish label
  cell: (item: T) => React.ReactNode;   // render-prop
  className?: string;                   // e.g. responsive hide "hidden md:table-cell"
  headerClassName?: string;
}

export interface CatalogAction<T> {
  icon: LucideIcon;                     // Eye | Pencil | Trash2 | Shield ...
  label: string;                        // aria-label + tooltip text
  onClick: (item: T) => void;
  variant?: "default" | "destructive";  // destructive => text-destructive
  href?: (item: T) => string;           // optional: render as <Link> (asChild)
  requiresConfirm?: boolean;
  confirmTitle?: (item: T) => string;
  confirmMessage?: (item: T) => string;
  disabled?: (item: T) => boolean;      // e.g. count > 0
}

export interface CatalogTableProps<T> {
  data: T[];
  columns: CatalogColumn<T>[];
  actions?: CatalogAction<T>[];
  rowKey: (item: T) => string | number;

  // search (server-side) — omit all to hide the search box
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  // pagination (controlled by the page) — omit all to hide pagination
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
  onItemsPerPageChange?: (n: number) => void;

  loading?: boolean;                    // shows Spinner row
  emptyMessage?: string;                // default "No hay registros"
}
```

Internals: renders search `Input` (debounce lives in the page, NOT here — table just calls `onSearchChange`), `Table` body, an actions cell wrapping each action in `Tooltip` + `Button size="icon"` with `aria-label={label}`, and `ui/pagination.tsx` when pagination props are present. Holds one `ConfirmDialog` and a `pendingAction` state; when an action with `requiresConfirm` fires, it opens the dialog instead of calling `onClick`; on confirm it runs `onClick(item)`.

### `ConfirmDialog` — `src/components/ui/confirm-dialog.tsx`

```ts
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message: string;
  confirmLabel?: string;   // default "Eliminar"
  cancelLabel?: string;    // default "Cancelar"
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel?: () => void;
}
```

Built on `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription/DialogFooter`; confirm button uses `Button variant={variant === "destructive" ? "destructive" : "default"}`.

### Server action contract (upgrade pattern)

Standard shape `{ data: T[], pagination: { total, page, limit, totalPages } }`. To upgrade an array action (e.g. `getStatesAdmin`) — `id` is numeric here so search is name/code only; where `id` is a String (users) add `{ id: { contains } }`:

```ts
export async function getStatesAdmin(params?: {
  page?: number; limit?: number; search?: string;
}) {
  await requirePermission("states:read");          // RBAC preserved
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const skip = (page - 1) * limit;

  const where: Prisma.StateWhereInput = { active: true };  // soft delete preserved
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: "insensitive" } },
      { code: { contains: params.search, mode: "insensitive" } },
    ];
  }

  const [states, total] = await Promise.all([
    prisma.state.findMany({
      where,
      include: { _count: { select: { clientes: true } } },
      orderBy: { name: "asc" },
      skip, take: limit,
    }),
    prisma.state.count({ where }),
  ]);

  return { data: states, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}
```

Actions to upgrade (6): `getStatesAdmin` (lookups.ts), `getLines` (lines.ts), equipments, `getParts` (parts.ts), `getRoles` (roles.ts), `getUsers` (users.ts). For String-id models (users), search `OR` includes `id`, `name`, `email`.

### Page consumption pattern (e.g. states)

```tsx
"use client";
const [items, setItems] = useState<State[]>([]);
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(10);
const [total, setTotal] = useState(0);
const [search, setSearch] = useState("");
const [loading, setLoading] = useState(true);
const [confirmId, setConfirmId] = useState<number | null>(null);
const debounced = useDebounce(search, 300);   // small local hook

useEffect(() => {
  setLoading(true);
  getStatesAdmin({ page, limit, search: debounced })
    .then((r) => { setItems(r.data.map(transform)); setTotal(r.pagination.total); })
    .finally(() => setLoading(false));
}, [page, limit, debounced]);

<CatalogTable
  data={items} columns={columns} actions={actions} rowKey={(s) => s.id}
  searchValue={search} onSearchChange={setSearch} searchPlaceholder="Buscar estados..."
  currentPage={page} totalPages={Math.ceil(total / limit)} totalItems={total}
  itemsPerPage={limit} onPageChange={setPage} onItemsPerPageChange={setLimit}
  loading={loading} emptyMessage="No hay estados"
/>
```

Note: changing `debounced`/`limit` must reset `page` to 1 when results shrink (guard in `onSearchChange`).

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/common/catalog-table/catalog-table.tsx` | Create | Generic table |
| `src/components/common/catalog-table/types.ts` | Create | `CatalogColumn`/`CatalogAction`/props |
| `src/components/common/catalog-table/index.ts` | Create | Barrel export |
| `src/hooks/use-debounce.ts` | Create | 300ms debounce hook (if absent) |
| `src/components/ui/confirm-dialog.tsx` | Create | Accessible confirm over Dialog |
| `src/components/states/state-table.tsx` (+ incident, status, line, equipment, parts) | Modify | Replace with CatalogTable usage; drop internal pagination `useState` |
| `src/app/admin/{states,lines,parts,roles,users,incident-types}/page.tsx` | Modify | Server state (page/limit/search/debounce), call upgraded action |
| `src/lib/actions/{lookups,lines,equipments,parts,roles,users}.ts` | Modify | Add `{page,limit,search}`→`{data,pagination}` |
| `src/components/admin/roles/roles-table.tsx` | Modify | Icon-actions + Shield "Permisos"; drop internal pagination |
| `src/components/roles/role-table.tsx` | Delete | Unused duplicate (zero importers) |
| `src/components/vehicles/vehicle-table.tsx` | Modify | Swap DropdownMenu → icon-actions + tooltip; keep cards |
| `src/components/common/table-pagination.tsx` | Delete | After last consumer migrates (S4) |

## Migration / Rollout — Slicing Plan (stacked-to-main)

All slices depend ONLY on S0. Each is an independent PR with its own rollback (revert the slice; S0 stays).

| Slice | Scope | Est. lines | <400? | Rollback boundary |
|---|---|---|---|---|
| **S0** | CatalogTable + ConfirmDialog + use-debounce; NO migration; do NOT delete table-pagination | 200-250 | Yes | Pure-add; revert deletes new files only |
| **S1** | Status tables (user/equipment/assignment/line/vehicle/vehicle-trip-status) via GenericStatusTable→CatalogTable; fix double pagination; **preserve assignment-status banner** | 300-350 | Yes | Revert restores GenericStatusTable |
| **S2** | incident-types, incident-status: confirm + icons (search already exists) | 200-250 | Yes | Revert restores 3-dot menu |
| **S3** | states, lines, equipments: upgrade actions to `{page,limit,search}` + migrate pages | 300-350 | Yes | Action change is additive-compatible if callers migrate same PR |
| **S4** | parts, roles (Shield "Permisos"), users; upgrade getParts/getRoles/getUsers; consolidate roles-table; **delete table-pagination.tsx** | 400-500 | **No — split** | See below |
| **S5** | Vehicles: icon-actions, keep cards (depends on S0 confirm-dialog) | 300-400 | Yes | Revert restores DropdownMenu |

**S4 sub-division (exceeds 400):**
- **S4a** parts + getParts upgrade (~150)
- **S4b** users + getUsers upgrade (~180)
- **S4c** roles + getRoles upgrade + consolidate roles-table + delete table-pagination.tsx (~170) — runs last so no live importer of table-pagination remains.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | Server action returns `{data,pagination}`; search `where.OR`; RBAC guard kept | Args/shape assertions |
| Unit | ConfirmDialog confirm/cancel callbacks | RTL interaction |
| Integration | Page page/search/debounce drives action; no double pagination | RTL + mocked action |
| Manual | aria-labels present; assignment-status banner persists; keyboard confirm | a11y check |

## Risks

| Risk | Mitigation |
|---|---|
| Array→`{data,pagination}` breaks current callers (sync return today) | Migrate action + every caller in the SAME slice; grep importers first |
| Debounce missing → request per keystroke | `use-debounce` 300ms; effect keyed on debounced value only |
| Lose assignment-status banner during S1 | Banner is page-level, NOT in the table — keep page JSX; explicit S1 acceptance |
| Missing aria-labels | `action.label` is required and feeds both tooltip + `aria-label` |
| Premature table-pagination delete | Delete only in S4c after roles (its last consumer) migrates |
| Page index out of range after search shrinks results | Reset `page=1` in `onSearchChange` |

## Open Questions

None blocking. Spec (sdd-spec) may run in parallel; this design is anchored to the closed proposal contract.
