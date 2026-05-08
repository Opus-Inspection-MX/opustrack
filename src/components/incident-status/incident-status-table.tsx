"use client";

import { Edit, Eye, MoreHorizontal, Trash2 } from "lucide-react";
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

interface IncidentStatus {
  id: number;
  name: string;
  color: string;
  incidentCount: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface IncidentStatusTableProps {
  data: IncidentStatus[];
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  onView: (id: number) => void;
}

export function IncidentStatusTable({
  data,
  onEdit,
  onDelete,
  onView,
}: IncidentStatusTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  const handleDelete = (id: number, incidentCount: number) => {
    if (incidentCount > 0) {
      alert(
        `No se puede eliminar este estado. Está siendo usado por ${incidentCount} incidente(s).`,
      );
      return;
    }

    if (
      confirm("¿Estás seguro de que deseas eliminar este estado de incidente?")
    ) {
      onDelete(id);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Status Preview</TableHead>
              <TableHead>Incidents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentData.map((status) => (
              <TableRow key={status.id}>
                <TableCell className="font-medium">{status.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border border-gray-300"
                      style={{ backgroundColor: status.color }}
                      title={status.color}
                    />
                    <span className="font-mono text-sm text-muted-foreground">
                      {status.color}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    style={{
                      backgroundColor: status.color,
                      color: "#FFFFFF",
                      borderColor: status.color,
                    }}
                  >
                    {status.name}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {status.incidentCount} incidents
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={status.active ? "default" : "secondary"}>
                    {status.active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(status.createdAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onView(status.id)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(status.id)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleDelete(status.id, status.incidentCount)
                        }
                        className="text-red-600"
                        disabled={status.incidentCount > 0}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
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
        onItemsPerPageChange={(newItemsPerPage) => {
          setItemsPerPage(newItemsPerPage);
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
