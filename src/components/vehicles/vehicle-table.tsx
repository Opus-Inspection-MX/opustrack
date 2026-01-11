"use client";

import Link from "next/link";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { VehicleStatusBadge } from "./vehicle-status-badge";

interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  licensePlate: string;
  status: string;
  _count?: {
    trips: number;
  };
}

interface VehicleTableProps {
  vehicles: Vehicle[];
  onDelete?: (id: string) => void;
}

export function VehicleTable({ vehicles, onDelete }: VehicleTableProps) {
  if (vehicles.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No vehicles found. Create your first vehicle to get started.
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/admin/vehicles/${vehicle.id}`}
                        className="flex items-center cursor-pointer"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/admin/vehicles/${vehicle.id}/edit`}
                        className="flex items-center cursor-pointer"
                      >
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </Link>
                    </DropdownMenuItem>
                    {onDelete && (
                      <DropdownMenuItem
                        onClick={() => onDelete(vehicle.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Year:</span>{" "}
                  {vehicle.year}
                </div>
                <div>
                  <span className="text-muted-foreground">Trips:</span>{" "}
                  {vehicle._count?.trips || 0}
                </div>
                <div className="col-span-2">
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
              <TableHead>License Plate</TableHead>
              <TableHead>Make & Model</TableHead>
              <TableHead>Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Trips</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
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
                  <VehicleStatusBadge status={vehicle.status} />
                </TableCell>
                <TableCell>{vehicle._count?.trips || 0}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/admin/vehicles/${vehicle.id}`}
                          className="flex items-center cursor-pointer"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/admin/vehicles/${vehicle.id}/edit`}
                          className="flex items-center cursor-pointer"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(vehicle.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
