"use client";

import { Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AssignmentFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  assigneeFilter: string;
  setAssigneeFilter: (value: string) => void;
  dateFromFilter: string;
  setDateFromFilter: (value: string) => void;
  dateToFilter: string;
  setDateToFilter: (value: string) => void;
  dateFilterType: string;
  setDateFilterType: (value: string) => void;
  sortField: string;
  setSortField: (value: string) => void;
  sortDirection: string;
  setSortDirection: (value: string) => void;
  uniqueAssignees: string[];
}

export function AssignmentFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  assigneeFilter,
  setAssigneeFilter,
  dateFromFilter,
  setDateFromFilter,
  dateToFilter,
  setDateToFilter,
  dateFilterType,
  setDateFilterType,
  sortField,
  setSortField,
  sortDirection,
  setSortDirection,
  uniqueAssignees,
}: AssignmentFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Filtros y Búsqueda
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar asignaciones..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Estados</SelectItem>
                <SelectItem value="PENDING">Pendiente</SelectItem>
                <SelectItem value="IN_PROGRESS">En Progreso</SelectItem>
                <SelectItem value="COMPLETED">Completada</SelectItem>
                <SelectItem value="CANCELLED">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Asignado a" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los Asignados</SelectItem>
                {uniqueAssignees.map((assignee) => (
                  <SelectItem key={assignee} value={assignee}>
                    {assignee}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={`${sortField}-${sortDirection}`}
              onValueChange={(value) => {
                const [field, direction] = value.split("-");
                setSortField(field);
                setSortDirection(direction);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt-desc">Más Recientes</SelectItem>
                <SelectItem value="createdAt-asc">Más Antiguas</SelectItem>
                <SelectItem value="startedAt-desc">
                  Iniciadas Últimas
                </SelectItem>
                <SelectItem value="startedAt-asc">
                  Iniciadas Primeras
                </SelectItem>
                <SelectItem value="incident.title-asc">
                  Incidente A-Z
                </SelectItem>
                <SelectItem value="assignedTo.name-asc">
                  Asignado A-Z
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
            <Select value={dateFilterType} onValueChange={setDateFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por Fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Fecha de Creación</SelectItem>
                <SelectItem value="startedAt">Fecha de Inicio</SelectItem>
                <SelectItem value="finishedAt">Fecha de Fin</SelectItem>
                <SelectItem value="updatedAt">
                  Fecha de Actualización
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-1">
              <Label
                htmlFor="dateFrom"
                className="text-xs text-muted-foreground"
              >
                Desde
              </Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFromFilter}
                onChange={(e) => setDateFromFilter(e.target.value)}
                placeholder="From date"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="dateTo" className="text-xs text-muted-foreground">
                Hasta
              </Label>
              <Input
                id="dateTo"
                type="date"
                value={dateToFilter}
                onChange={(e) => setDateToFilter(e.target.value)}
                placeholder="To date"
              />
            </div>
            {/* Clear All Filters Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setAssigneeFilter("all");
                  setDateFromFilter("");
                  setDateToFilter("");
                  setDateFilterType("createdAt");
                  setSortField("createdAt");
                  setSortDirection("desc");
                }}
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
