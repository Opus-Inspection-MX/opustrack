import type React from "react";
import { EmptyState } from "@/components/common/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface ResponsiveColumn<T> {
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  headerClassName?: string;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: readonly T[];
  columns: ResponsiveColumn<T>[];
  rowKey: (row: T, index: number) => string | number;
  /** Card rendered per row below the `md` breakpoint. */
  mobileCard: (row: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  emptyTitle?: string;
  className?: string;
}

/**
 * Table on desktop, cards on mobile — from a single column definition.
 *
 * Deliberately a Server Component even though it renders client UI
 * (`Table`, `VacationApprovalButtons` en las celdas): `rowKey`/`columns`/
 * `mobileCard` son funciones, y pasar funciones de una página servidor a un
 * Client Component rompe la serialización RSC ("Functions cannot be passed
 * directly to Client Components") y tira la página al error boundary — era
 * lo que rompía `/admin/vacations` y `/vacations`. Mismo patrón que
 * `StatCard`, que envuelve al cliente `AnimatedNumber` desde el servidor.
 *
 * The desktop table keeps native `<table>` semantics so e2e
 * `getByRole("row")` lookups keep passing; the mobile list renders below
 * `md` with the `mobileCard` render prop. Base for CatalogTable.
 */
export function ResponsiveTable<T>({
  data,
  columns,
  rowKey,
  mobileCard,
  emptyMessage = "Sin resultados.",
  emptyTitle = "Sin datos",
  className,
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyMessage} />;
  }

  return (
    <div className={cn(className)}>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, idx) => (
                <TableHead
                  // biome-ignore lint/suspicious/noArrayIndexKey: static column order
                  key={idx}
                  className={col.headerClassName}
                >
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={rowKey(row, index)}>
                {columns.map((col, colIdx) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: static column order
                    key={colIdx}
                    className={col.className}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul className="space-y-3 md:hidden">
        {data.map((row, index) => (
          <li key={rowKey(row, index)}>{mobileCard(row, index)}</li>
        ))}
      </ul>
    </div>
  );
}
