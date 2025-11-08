"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Filter, X } from "lucide-react"

interface TrackingFiltersProps {
  vics: Array<{ id: string; name: string; code: string }>
  incidentTypes: Array<{ id: number; name: string }>
  incidentStatuses: Array<{ id: number; name: string }>
  fsrs: Array<{ id: string; name: string }>
  onFilterChange: (filters: {
    vicId?: string
    typeId?: number
    statusId?: number
    startDate?: string
    endDate?: string
    assignedFsrId?: string
  }) => void
  createButton?: React.ReactNode
}

export function TrackingFilters({
  vics,
  incidentTypes,
  incidentStatuses,
  fsrs,
  onFilterChange,
  createButton,
}: TrackingFiltersProps) {
  const today = new Date().toISOString().split('T')[0]
  const [showFilters, setShowFilters] = useState(true)
  const [filters, setFilters] = useState({
    vicId: "",
    typeId: "",
    statusId: "",
    startDate: today,
    endDate: today,
    assignedFsrId: "",
  })

  const handleFilterChange = (field: string, value: string) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)

    // Convert to proper types and remove empty values
    const cleanFilters: any = {}
    if (newFilters.vicId) cleanFilters.vicId = newFilters.vicId
    if (newFilters.typeId) cleanFilters.typeId = parseInt(newFilters.typeId)
    if (newFilters.statusId) cleanFilters.statusId = parseInt(newFilters.statusId)
    if (newFilters.startDate) cleanFilters.startDate = newFilters.startDate
    if (newFilters.endDate) cleanFilters.endDate = newFilters.endDate
    if (newFilters.assignedFsrId) cleanFilters.assignedFsrId = newFilters.assignedFsrId

    onFilterChange(cleanFilters)
  }

  const clearFilters = () => {
    const clearedFilters = {
      vicId: "",
      typeId: "",
      statusId: "",
      startDate: today,
      endDate: today,
      assignedFsrId: "",
    }
    setFilters(clearedFilters)
    onFilterChange({
      startDate: today,
      endDate: today,
    })
  }

  const hasActiveFilters = filters.vicId !== "" || filters.typeId !== "" || filters.statusId !== "" || filters.assignedFsrId !== ""

  // Trigger initial filter with today's date on mount
  useEffect(() => {
    onFilterChange({
      startDate: today,
      endDate: today,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Limpiar Filtros
          </Button>
        )}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Cliente Filter */}
              <div className="space-y-2">
                <Label htmlFor="vicId">Cliente</Label>
                <Select
                  key={`vicId-${filters.vicId}`}
                  value={filters.vicId || undefined}
                  onValueChange={(value) => handleFilterChange("vicId", value)}
                >
                  <SelectTrigger id="vicId">
                    <SelectValue placeholder="Todos los clientes" />
                  </SelectTrigger>
                  <SelectContent>
                    {vics.map((vic) => (
                      <SelectItem key={vic.id} value={vic.id}>
                        {vic.name} ({vic.code})
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
                  onValueChange={(value) => handleFilterChange("statusId", value)}
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
                  onValueChange={(value) => handleFilterChange("assignedFsrId", value)}
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
                  onChange={(e) => handleFilterChange("startDate", e.target.value)}
                />
              </div>

              {/* Fecha Fin Filter */}
              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha Fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange("endDate", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
