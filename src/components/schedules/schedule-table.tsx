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
import { TablePagination } from "@/components/common/table-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMX } from "@/lib/utils/datetime";

interface Schedule {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  endDate?: string | null;
  clientes: Array<{ id: string; code: string; name: string }>;
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

  const getScheduleStatus = (scheduledAt: string) => {
    const now = new Date();
    const scheduleDate = new Date(scheduledAt);

    if (scheduleDate < now) {
      return { label: "Pasado", variant: "secondary" as const };
    } else if (scheduleDate.toDateString() === now.toDateString()) {
      return { label: "Hoy", variant: "default" as const };
    } else {
      return { label: "Próximo", variant: "outline" as const };
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Fecha Programada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Incidentes</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead className="w-[120px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((schedule) => {
              const status = getScheduleStatus(schedule.scheduledAt);
              return (
                <TableRow key={schedule.id}>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[220px]">
                      {schedule.clientes.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          Sin Clientes
                        </span>
                      ) : (
                        <>
                          <Badge
                            variant="secondary"
                            className="gap-1"
                            title={schedule.clientes[0].name}
                          >
                            <Building2 className="h-3 w-3" />
                            {schedule.clientes[0].code}
                          </Badge>
                          {schedule.clientes.length > 1 && (
                            <Badge
                              variant="outline"
                              title={schedule.clientes
                                .slice(1)
                                .map((v) => `${v.code} — ${v.name}`)
                                .join("\n")}
                            >
                              +{schedule.clientes.length - 1} más
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
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
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <span>{schedule.incidentCount}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={schedule.active ? "default" : "secondary"}>
                      {schedule.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onQuickEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onQuickEdit(schedule.id)}
                          title="Edición rápida (Clientes y fechas)"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onView(schedule.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(schedule.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDelete(schedule.id)}
                            disabled={schedule.incidentCount > 0}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={data.length}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
