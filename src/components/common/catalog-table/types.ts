import type { ComponentType, ReactNode } from "react";

/** Column definition for CatalogTable. */
export interface CatalogColumn<T> {
  /** Column header label (should be in neutral Spanish). */
  header: string;
  /** Render function for each cell in this column. */
  cell: (row: T) => ReactNode;
  /** Optional CSS class for the `<td>` cell. */
  className?: string;
  /** Optional CSS class for the `<th>` header cell. */
  headerClassName?: string;
}

/** Per-row action definition for CatalogTable. */
export interface CatalogAction<T> {
  /** Lucide icon component to render in the action button. */
  icon: ComponentType<{ className?: string }>;
  /**
   * Human-readable label. Used as both the tooltip text and the
   * `aria-label` for the action button.
   */
  label: string;
  /** Click handler; receives the row item. Mutually exclusive with `href`. */
  onClick?: (row: T) => void;
  /**
   * Navigation target; receives the row item and returns a URL string.
   * Renders a `<Link>` instead of a `<button>`.
   */
  href?: (row: T) => string;
  /** Button visual variant. Defaults to "ghost". */
  variant?: "default" | "destructive" | "ghost";
  /**
   * When true, clicking the action opens a confirmation dialog before
   * invoking `onClick`.
   */
  requiresConfirm?: boolean;
  /** Title shown in the confirmation dialog. */
  confirmTitle?: string;
  /** Message/description shown in the confirmation dialog. */
  confirmMessage?: (row: T) => string;
  /** When returns true, the action button is rendered as disabled for that row. */
  disabled?: (row: T) => boolean;
}

/** Props for the CatalogTable component. */
export interface CatalogTableProps<T> {
  /** Array of data items to display. */
  data: T[];
  /** Column definitions. */
  columns: CatalogColumn<T>[];
  /** Per-row action definitions. */
  actions?: CatalogAction<T>[];
  /** Returns a unique key for each row item. */
  rowKey: (row: T) => string | number;

  // Search (optional — omit both to hide the search bar)
  /** Current search input value (controlled). */
  searchValue?: string;
  /** Called when the user types in the search input. */
  onSearchChange?: (value: string) => void;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;

  // Pagination (optional — omit to hide pagination controls)
  /** Current page number (1-based). */
  currentPage?: number;
  /** Total number of pages. */
  totalPages?: number;
  /** Total number of items across all pages. */
  totalItems?: number;
  /** Number of items per page. */
  itemsPerPage?: number;
  /** Called when the user navigates to a different page. */
  onPageChange?: (page: number) => void;
  /** Called when the user changes the page size. */
  onItemsPerPageChange?: (itemsPerPage: number) => void;

  // State
  /** When true, renders a loading indicator instead of rows. */
  loading?: boolean;
  /** Message shown when `data` is empty and `loading` is false. */
  emptyMessage?: string;
}
