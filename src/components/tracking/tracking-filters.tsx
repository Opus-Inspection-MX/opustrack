"use client";

import { Calendar, CalendarDays, Filter, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TrackingFiltersProps {
  clientes: Array<{ id: string; name: string; code: string }>;
  incidentTypes: Array<{ id: number; name: string }>;
  incidentStatuses: Array<{ id: number; name: string }>;
  fsrs: Array<{ id: string; name: string }>;
  onFilterChange: (filters: {
    clienteId?: string;
    typeId?: number;
    statusId?: number;
    startDate?: string;
    endDate?: string;
    assignedFsrId?: string;
    folio?: string;
  }) => void;
  createButton?: React.ReactNode;
}

export function TrackingFilters({
  clientes,
  incidentTypes,
  incidentStatuses,
  fsrs,
  onFilterChange,
  createButton,
}: TrackingFiltersProps) {
  const today = new Date().toISOString().split("T")[0];
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState({
    clienteId: "",
    typeId: "",
    statusId: "",
    startDate: today,
    endDate: today,
    assignedFsrId: "",
    folio: "",
  });

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    // Note: No longer auto-triggering search here
  };

  const handleSearch = () => {
    // Convert to proper types and remove empty values
    const cleanFilters: {
      clienteId?: string;
      typeId?: number;
      statusId?: number;
      startDate?: string;
      endDate?: string;
      assignedFsrId?: string;
      folio?: string;
    } = {};
    if (filters.clienteId) cleanFilters.clienteId = filters.clienteId;
    if (filters.typeId) cleanFilters.typeId = parseInt(filters.typeId, 10);
    if (filters.statusId)
      cleanFilters.statusId = parseInt(filters.statusId, 10);
    if (filters.startDate) cleanFilters.startDate = filters.startDate;
    if (filters.endDate) cleanFilters.endDate = filters.endDate;
    if (filters.assignedFsrId)
      cleanFilters.assignedFsrId = filters.assignedFsrId;
    if (filters.folio) cleanFilters.folio = filters.folio;

    onFilterChange(cleanFilters);
  };

  const setCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Monday as first day
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startDate = monday.toISOString().split("T")[0];
    const endDate = sunday.toISOString().split("T")[0];

    setFilters({ ...filters, startDate, endDate });
  };

  const setCurrentMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startDate = firstDay.toISOString().split("T")[0];
    const endDate = lastDay.toISOString().split("T")[0];

    setFilters({ ...filters, startDate, endDate });
  };

  const clearFilters = () => {
    const clearedFilters = {
      clienteId: "",
      typeId: "",
      statusId: "",
      startDate: filters.startDate, // Keep current date
      endDate: filters.endDate, // Keep current date
      assignedFsrId: "",
      folio: "",
    };
    setFilters(clearedFilters);
    // Trigger search with cleared filters
    onFilterChange({
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  };

  const hasActiveFilters =
    filters.clienteId !== "" ||
    filters.typeId !== "" ||
    filters.statusId !== "" ||
    filters.assignedFsrId !== "" ||
    filters.folio !== "";

  // Trigger initial filter with today's date on mount
  useEffect(() => {
    onFilterChange({
      startDate: today,
      endDate: today,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFilterChange, today]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {createButton}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          {showFilters ? "Ocultar Filtros" : "Mostrar Filtros"}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Date Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm font-medium">Rango de fechas:</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setFilters({ ...filters, startDate: today, endDate: today });
                }}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Hoy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setCurrentWeek}
                className="gap-2"
              >
                <Calendar className="h-4 w-4" />
                Semana Actual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setCurrentMonth}
                className="gap-2"
              >
                <CalendarDays className="h-4 w-4" />
                Mes Actual
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cliente Filter */}
              <div className="space-y-2">
                <Label htmlFor="clienteId">Cliente</Label>
                <Select
                  key={`clienteId-${filters.clienteId}`}
                  value={filters.clienteId || undefined}
                  onValueChange={(value) =>
                    handleFilterChange("clienteId", value)
                  }
                >
                  <SelectTrigger id="clienteId">
                    <SelectValue placeholder="Todos los Cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.name} ({cliente.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Incidente Filter */}
              <div className="space-y-2">
                <Label htmlFor="typeId">Tipo de Incidente</Label>
                <Select
                  key={`typeId-${filters.typeId}`}
                  value={filters.typeId || undefined}
                  onValueChange={(value) => handleFilterChange("typeId", value)}
                >
                  <SelectTrigger id="typeId">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="statusId">Status</Label>
                <Select
                  key={`statusId-${filters.statusId}`}
                  value={filters.statusId || undefined}
                  onValueChange={(value) =>
                    handleFilterChange("statusId", value)
                  }
                >
                  <SelectTrigger id="statusId">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    {incidentStatuses.map((status) => (
                      <SelectItem key={status.id} value={status.id.toString()}>
                        {status.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* FSR Asignado Filter */}
              <div className="space-y-2">
                <Label htmlFor="assignedFsrId">FSR Asignado</Label>
                <Select
                  key={`assignedFsrId-${filters.assignedFsrId}`}
                  value={filters.assignedFsrId || undefined}
                  onValueChange={(value) =>
                    handleFilterChange("assignedFsrId", value)
                  }
                >
                  <SelectTrigger id="assignedFsrId">
                    <SelectValue placeholder="Todos los FSRs" />
                  </SelectTrigger>
                  <SelectContent>
                    {fsrs.map((fsr) => (
                      <SelectItem key={fsr.id} value={fsr.id}>
                        {fsr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Fecha Inicio Filter */}
              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha Inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) =>
                    handleFilterChange("startDate", e.target.value)
                  }
                />
              </div>

              {/* Fecha Fin Filter */}
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) =>
                    handleFilterChange("endDate", e.target.value)
                  }
                />
              </div>

              {/* Folio Filter */}
              <div className="space-y-2">
                <Label htmlFor="folio">Folio</Label>
                <Input
                  id="folio"
                  type="text"
                  placeholder="Ej: INC-123, AS-45 o número..."
                  value={filters.folio}
                  onChange={(e) => handleFilterChange("folio", e.target.value)}
                />
              </div>
            </div>

            {/* Search and Clear Buttons */}
            <div className="flex justify-between gap-2 pt-4 border-t">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Limpiar Filtros
                </Button>
              )}
              <Button
                variant="default"
                onClick={handleSearch}
                className="gap-2 ml-auto"
              >
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
