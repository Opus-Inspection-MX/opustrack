"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CatalogAction, CatalogTableProps } from "./types";

/**
 * Generic catalog table component.
 *
 * - Controlled search input (rendered only when `onSearchChange` is provided).
 * - Render-prop columns (`CatalogColumn<T>`).
 * - Icon-button actions with tooltip + aria-label (`CatalogAction<T>`).
 * - Actions that set `requiresConfirm` open an internal ConfirmDialog.
 * - Controlled pagination (rendered only when pagination props are provided).
 * - Loading and empty states.
 */
export function CatalogTable<T>({
  data,
  columns,
  actions,
  rowKey,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  loading = false,
  emptyMessage = "Sin resultados.",
}: CatalogTableProps<T>) {
  // Internal confirm dialog state.
  const [pendingAction, setPendingAction] = useState<{
    action: CatalogAction<T>;
    row: T;
  } | null>(null);

  const showSearch = typeof onSearchChange === "function";

  // All pagination props must be present to render pagination controls.
  const paginationReady =
    typeof currentPage === "number" &&
    typeof totalPages === "number" &&
    typeof totalItems === "number" &&
    typeof itemsPerPage === "number" &&
    typeof onPageChange === "function" &&
    typeof onItemsPerPageChange === "function" &&
    totalPages > 1;

  function handleActionClick(action: CatalogAction<T>, row: T) {
    if (action.requiresConfirm) {
      setPendingAction({ action, row });
    } else {
      action.onClick?.(row);
    }
  }

  function handleConfirm() {
    if (pendingAction) {
      pendingAction.action.onClick?.(pendingAction.row);
      setPendingAction(null);
    }
  }

  function handleCancelConfirm() {
    setPendingAction(null);
  }

  const colSpan = columns.length + (actions && actions.length > 0 ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {showSearch && (
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={searchValue ?? ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </div>
      )}

      {/* Table */}
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
            {actions && actions.length > 0 && (
              <TableHead className="text-right">Acciones</TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="h-24 text-center">
                <div className="flex justify-center">
                  <Spinner text="Cargando..." />
                </div>
              </TableCell>
            </TableRow>
          ) : data.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((col, colIdx) => (
                  <TableCell
                    // biome-ignore lint/suspicious/noArrayIndexKey: static column order
                    key={colIdx}
                    className={col.className}
                  >
                    {col.cell(row)}
                  </TableCell>
                ))}

                {actions && actions.length > 0 && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {actions.map((action, actionIdx) => {
                        const isDisabled = action.disabled?.(row) ?? false;
                        const Icon = action.icon;

                        if (action.href) {
                          const href = action.href(row);
                          return (
                            <Tooltip
                              // biome-ignore lint/suspicious/noArrayIndexKey: static action order
                              key={actionIdx}
                            >
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  asChild
                                  aria-label={action.label}
                                  aria-disabled={isDisabled}
                                  className={
                                    isDisabled
                                      ? "pointer-events-none opacity-50"
                                      : undefined
                                  }
                                >
                                  <Link href={href} aria-label={action.label}>
                                    <Icon className="h-4 w-4" />
                                  </Link>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{action.label}</TooltipContent>
                            </Tooltip>
                          );
                        }

                        return (
                          <Tooltip
                            // biome-ignore lint/suspicious/noArrayIndexKey: static action order
                            key={actionIdx}
                          >
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={action.label}
                                disabled={isDisabled}
                                onClick={() => handleActionClick(action, row)}
                              >
                                <Icon className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{action.label}</TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination — rendered only when all pagination props are present and there are multiple pages */}
      {paginationReady && (
        <Pagination
          currentPage={currentPage as number}
          totalPages={totalPages as number}
          totalItems={totalItems as number}
          itemsPerPage={itemsPerPage as number}
          onPageChange={onPageChange as (page: number) => void}
          onItemsPerPageChange={
            onItemsPerPageChange as (itemsPerPage: number) => void
          }
        />
      )}

      {/* Internal confirmation dialog for requiresConfirm actions */}
      {pendingAction !== null && (
        <ConfirmDialog
          open={pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) setPendingAction(null);
          }}
          title={
            pendingAction.action.confirmTitle ??
            `¿Confirmar ${pendingAction.action.label.toLowerCase()}?`
          }
          message={
            pendingAction.action.confirmMessage?.(pendingAction.row) ??
            "Esta acción no se puede deshacer."
          }
          variant={
            pendingAction.action.variant === "destructive"
              ? "destructive"
              : "default"
          }
          confirmLabel={
            pendingAction.action.variant === "destructive"
              ? "Eliminar"
              : "Confirmar"
          }
          onConfirm={handleConfirm}
          onCancel={handleCancelConfirm}
        />
      )}
    </div>
  );
}
