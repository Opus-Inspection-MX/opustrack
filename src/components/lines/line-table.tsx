"use client";

import { Edit, Eye, List, MoreHorizontal, Trash2 } from "lucide-react";
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

interface Line {
  id: number;
  name: string;
  description?: string | null;
  vic: { name: string; code: string };
  equipments: any[];
  active: boolean;
  createdAt: string;
}

interface LineTableProps {
  lines: Line[];
  totalCount: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (id: number) => void;
}

export function LineTable({
  lines,
  totalCount,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  onEdit,
  onDelete,
  onView,
}: LineTableProps) {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>CVV</TableHead>
              <TableHead>Equipos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{line.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {line.description || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {line.vic.name} ({line.vic.code})
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {line.equipments.length} equipos
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      line.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {line.active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Abrir menú</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(line.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(line.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(line.id)}
                        className="text-destructive"
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
        totalPages={Math.ceil(totalCount / itemsPerPage)}
        itemsPerPage={itemsPerPage}
        totalItems={totalCount}
        startIndex={startIndex}
        endIndex={endIndex}
        onPageChange={onPageChange}
        onItemsPerPageChange={onItemsPerPageChange}
      />
    </div>
  );
}
