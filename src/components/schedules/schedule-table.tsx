"use client";

import {
  Building2,
  Calendar,
  Edit,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import { formatMX } from "@/lib/utils/datetime";

interface Schedule {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  endDate?: string | null;
  clients: Array<{ id: string; code: string; name: string }>;
  incidentCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleTableProps {
  data: Schedule[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
  onQuickEdit?: (id: string) => void;
}

function scheduleTone(scheduledAt: string): {
  label: string;
  tone: StatusTone;
} {
  const now = new Date();
  const scheduleDate = new Date(scheduledAt);

  if (scheduleDate < now) {
    return { label: "Pasado", tone: "neutral" };
  } else if (scheduleDate.toDateString() === now.toDateString()) {
    return { label: "Hoy", tone: "info" };
  } else {
    return { label: "Próximo", tone: "open" };
  }
}

export function ScheduleTable({
  data,
  onEdit,
  onDelete,
  onView,
  onQuickEdit,
}: ScheduleTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  return (
    <div className="space-y-4">
      <ResponsiveTable
        data={currentData}
        rowKey={(schedule) => schedule.id}
        columns={[
          {
            header: "Título",
            cell: (schedule) => (
              <div>
                <div className="font-medium">{schedule.title}</div>
                {schedule.description && (
                  <div className="text-sm text-muted-foreground">
                    {schedule.description.length > 50
                      ? `${schedule.description.substring(0, 50)}...`
                      : schedule.description}
                  </div>
                )}
              </div>
            ),
          },
          {
            header: "Clientes",
            cell: (schedule) => (
              <div className="flex flex-wrap gap-1 max-w-full sm:max-w-[220px]">
                {schedule.clients.length === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    Sin Clientes
                  </span>
                ) : (
                  <>
                    <Badge
                      variant="secondary"
                      className="gap-1"
                      title={schedule.clients[0].name}
                    >
                      <Building2 className="h-3 w-3" aria-hidden />
                      {schedule.clients[0].code}
                    </Badge>
                    {schedule.clients.length > 1 && (
                      <Badge
                        variant="outline"
                        title={schedule.clients
                          .slice(1)
                          .map((v) => `${v.code} — ${v.name}`)
                          .join("\n")}
                      >
                        +{schedule.clients.length - 1} más
                      </Badge>
                    )}
                  </>
                )}
              </div>
            ),
          },
          {
            header: "Fecha Programada",
            cell: (schedule) => (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Calendar
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden
                  />
                  <div>
                    <div className="text-xs font-medium text-muted-foreground">
                      Inicio:
                    </div>
                    <div className="text-sm">
                      {formatMX(schedule.scheduledAt, {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatMX(schedule.scheduledAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
                {schedule.endDate && (
                  <div className="flex items-center gap-1 pl-5">
                    <div>
                      <div className="text-xs font-medium text-muted-foreground">
                        Fin:
                      </div>
                      <div className="text-sm">
                        {formatMX(schedule.endDate, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatMX(schedule.endDate, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ),
          },
          {
            header: "Status",
            cell: (schedule) => {
              const status = scheduleTone(schedule.scheduledAt);
              return (
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              );
            },
          },
          {
            header: "Incidentes",
            cell: (schedule) => <span>{schedule.incidentCount}</span>,
          },
          {
            header: "Activo",
            cell: (schedule) => (
              <StatusBadge tone={schedule.active ? "success" : "neutral"}>
                {schedule.active ? "Activo" : "Inactivo"}
              </StatusBadge>
            ),
          },
          {
            header: "Acciones",
            headerClassName: "text-right",
            className: "text-right",
            cell: (schedule) => (
              <div className="flex items-center justify-end gap-1">
                {onQuickEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onQuickEdit(schedule.id)}
                    title="Edición rápida (Clientes y fechas)"
                    aria-label="Edición rápida"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      aria-label="Más acciones"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onView(schedule.id)}>
                      <Eye className="mr-2 h-4 w-4" aria-hidden />
                      Ver
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEdit(schedule.id)}>
                      <Edit className="mr-2 h-4 w-4" aria-hidden />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDelete(schedule.id)}
                      disabled={schedule.incidentCount > 0}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ),
          },
        ]}
        mobileCard={(schedule) => {
          const status = scheduleTone(schedule.scheduledAt);
          return (
            <div className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                <StatusBadge tone={schedule.active ? "success" : "neutral"}>
                  {schedule.active ? "Activo" : "Inactivo"}
                </StatusBadge>
              </div>
              <p className="font-medium">{schedule.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatMX(schedule.scheduledAt, {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {schedule.incidentCount} incidentes
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onView(schedule.id)}
                >
                  Ver
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onEdit(schedule.id)}
                >
                  Editar
                </Button>
              </div>
            </div>
          );
        }}
        emptyTitle="Sin programaciones"
        emptyMessage="No hay programaciones para los filtros seleccionados."
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={data.length}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
