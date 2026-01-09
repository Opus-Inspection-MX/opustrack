"use client";

import { Edit, Eye, MoreHorizontal, Trash2, Wrench } from "lucide-react";
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

interface Equipment {
  id: number;
  name: string;
  description?: string | null;
  line: {
    id: number;
    name: string;
    vic: { name: string; code: string };
  };
  active: boolean;
  createdAt: string;
}

interface EquipmentTableProps {
  equipments: Equipment[];
  totalCount: number;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (id: number) => void;
}

export function EquipmentTable({
  equipments,
  totalCount,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  onEdit,
  onDelete,
  onView,
}: EquipmentTableProps) {
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
              <TableHead>Línea</TableHead>
              <TableHead>CVV</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipments.map((equipment) => (
              <TableRow key={equipment.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{equipment.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {equipment.description || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{equipment.line.name}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {equipment.line.vic.name} ({equipment.line.vic.code})
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    className={
                      equipment.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }
                  >
                    {equipment.active ? "Activo" : "Inactivo"}
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
                      <DropdownMenuItem onClick={() => onView(equipment.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(equipment.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(equipment.id)}
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
