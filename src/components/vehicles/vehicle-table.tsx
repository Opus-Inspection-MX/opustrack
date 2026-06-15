"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { VehicleStatusBadge } from "./vehicle-status-badge";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  status: string | { id: number; name: string; active: boolean };
  assignedFsr?: { id: string; name: string; email: string } | null;
  _count?: {
    trips: number;
  };
}

interface VehicleTableProps {
  vehicles: Vehicle[];
  onDelete?: (id: string) => void;
}

export function VehicleTable({ vehicles, onDelete }: VehicleTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleDeleteConfirm() {
    if (confirmId && onDelete) {
      onDelete(confirmId);
    }
    setConfirmId(null);
  }

  if (vehicles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No se encontraron vehículos. Crea el primero para comenzar.
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card Layout */}
      <div className="lg:hidden space-y-4">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-semibold text-lg">
                    {vehicle.make} {vehicle.model}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {vehicle.licensePlate}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Ver"
                      >
                        <Link
                          href={`/admin/vehicles/${vehicle.id}`}
                          aria-label="Ver"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Editar"
                      >
                        <Link
                          href={`/admin/vehicles/${vehicle.id}/edit`}
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Editar</TooltipContent>
                  </Tooltip>
                  {onDelete && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Eliminar"
                          onClick={() => setConfirmId(vehicle.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Año:</span>{" "}
                  {vehicle.year}
                </div>
                <div>
                  <span className="text-muted-foreground">Viajes:</span>{" "}
                  {vehicle._count?.trips || 0}
                </div>
                <div>
                  <span className="text-muted-foreground">FSR:</span>{" "}
                  {vehicle.assignedFsr?.name || "—"}
                </div>
                <div>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden lg:block border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Placa</TableHead>
              <TableHead>Marca y Modelo</TableHead>
              <TableHead>Año</TableHead>
              <TableHead>FSR Asignado</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Viajes</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles.map((vehicle) => (
              <TableRow key={vehicle.id}>
                <TableCell className="font-medium">
                  {vehicle.licensePlate}
                </TableCell>
                <TableCell>
                  {vehicle.make} {vehicle.model}
                </TableCell>
                <TableCell>{vehicle.year}</TableCell>
                <TableCell>
                  {vehicle.assignedFsr ? (
                    <span className="text-sm">{vehicle.assignedFsr.name}</span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <VehicleStatusBadge status={vehicle.status} />
                </TableCell>
                <TableCell>{vehicle._count?.trips || 0}</TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label="Ver"
                        >
                          <Link
                            href={`/admin/vehicles/${vehicle.id}`}
                            aria-label="Ver"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          aria-label="Editar"
                        >
                          <Link
                            href={`/admin/vehicles/${vehicle.id}/edit`}
                            aria-label="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>
                    {onDelete && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Eliminar"
                            onClick={() => setConfirmId(vehicle.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Eliminar</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Confirmation dialog for delete */}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmId(null);
        }}
        title="Eliminar vehículo"
        message="¿Estás seguro de que deseas eliminar este vehículo? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmId(null)}
      />
    </>
  );
}
