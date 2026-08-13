"use client";

import {
  Activity,
  Edit,
  Eye,
  MoreHorizontal,
  Trash2,
  Wrench,
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

interface AssignmentActivity {
  id: string;
  description: string;
  performedAt: string;
  assignmentId: string;
  assignmentTitle: string;
  partsCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentActivityTableProps {
  data: AssignmentActivity[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}

export function AssignmentActivityTable({
  data,
  onEdit,
  onDelete,
  onView,
}: AssignmentActivityTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descripción</TableHead>
              <TableHead>Asignación</TableHead>
              <TableHead>Realizado</TableHead>
              <TableHead>Partes Usadas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <div className="font-medium">
                        {activity.description.length > 60
                          ? `${activity.description.substring(0, 60)}...`
                          : activity.description}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{activity.assignmentTitle}</span>
                  </div>
                </TableCell>
                <TableCell>{formatMX(activity.performedAt)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{activity.partsCount} partes</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={activity.active ? "default" : "secondary"}>
                    {activity.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(activity.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(activity.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(activity.id)}
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
        totalItems={data.length}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={setItemsPerPage}
      />
    </div>
  );
}
