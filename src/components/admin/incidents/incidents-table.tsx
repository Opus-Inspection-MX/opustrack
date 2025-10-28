"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Edit, Trash2, Eye, AlertTriangle, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { deleteIncident } from "@/lib/actions/incidents";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TablePagination } from "@/components/common/table-pagination";

type Incident = {
  id: number;
  title: string;
  description: string;
  priority: number;
  sla: number;
  reportedAt: Date;
  type: {
    name: string;
  } | null;
  status: {
    name: string;
  } | null;
  vic: {
    name: string;
    code: string;
  } | null;
  reportedBy: {
    name: string;
  } | null;
  _count: {
    workOrders: number;
  };
};

export function IncidentsTable({ incidents }: { incidents: Incident[] }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = incidents.slice(startIndex, endIndex);
  const totalPages = Math.ceil(incidents.length / itemsPerPage);

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Esta seguro de que desea eliminar el incidente "${title}"?`)) {
      return;
    }

    setDeleting(id);
    try {
      await deleteIncident(id);
      router.refresh();
    } catch (error) {
      alert("Error al eliminar incidente: " + (error as Error).message);
      setDeleting(null);
    }
  };

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive";
    if (priority >= 5) return "default";
    return "secondary";
  };

  if (incidents.length === 0) {
    return (
      <div className="text-center py-12 border rounded-lg">
        <p className="text-muted-foreground">No hay incidentes registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titulo</TableHead>
              <TableHead className="hidden md:table-cell">Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead className="hidden lg:table-cell">VIC</TableHead>
              <TableHead className="hidden xl:table-cell">Reportado Por</TableHead>
              <TableHead className="hidden sm:table-cell">Ordenes</TableHead>
              <TableHead className="hidden md:table-cell">Fecha</TableHead>
              <TableHead className="w-[70px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((incident) => (
            <TableRow key={incident.id}>
              <TableCell className="font-medium">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    {incident.priority >= 8 && (
                      <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
                    )}
                    <span className="truncate">{incident.title}</span>
                  </div>
                  <div className="md:hidden flex flex-wrap gap-1 mt-1">
                    {incident.type && (
                      <Badge variant="outline" className="text-xs">{incident.type.name}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs">{incident._count.workOrders} ordenes</Badge>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {incident.type ? (
                  <Badge variant="outline">{incident.type.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin tipo</span>
                )}
              </TableCell>
              <TableCell>
                {incident.status ? (
                  <Badge variant="secondary">{incident.status.name}</Badge>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin estado</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={getPriorityColor(incident.priority)}>
                  {incident.priority}/10
                </Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {incident.vic ? (
                  <span className="text-sm">
                    {incident.vic.name}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">Sin VIC</span>
                )}
              </TableCell>
              <TableCell className="hidden xl:table-cell">
                {incident.reportedBy ? (
                  <span className="text-sm">{incident.reportedBy.name}</span>
                ) : (
                  <span className="text-muted-foreground text-sm">Desconocido</span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge variant="outline">{incident._count.workOrders}</Badge>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                {new Date(incident.reportedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/incidents/${incident.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/incidents/${incident.id}/edit`}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(incident.id, incident.title)}
                      disabled={deleting === incident.id}
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        itemsPerPage={itemsPerPage}
        totalItems={incidents.length}
        startIndex={startIndex}
        endIndex={Math.min(endIndex, incidents.length)}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
