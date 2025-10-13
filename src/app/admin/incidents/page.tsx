"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import Link from "next/link"
import { IncidentTable } from "@/components/incidents/incident-table"
import { IncidentFilters } from "@/components/incidents/incident-filters"
import { TablePagination } from "@/components/common/table-pagination"

// Mock data - replace with actual API calls
const mockIncidents = [
  {
    id: "inc_001",
    title: "Falla de Equipo",
    description: "Equipo de inspección no funciona correctamente",
    priority: "HIGH",
    sla: 24,
    type: { name: "Técnico" },
    status: { name: "Abierto" },
    vic: { name: "VIC Centro", code: "VIC001" },
    reportedBy: { name: "Juan Pérez" },
    reportedAt: "2024-01-15T10:30:00Z",
    resolvedAt: null,
    workOrders: [
      {
        id: "wo_001",
        status: "IN_PROGRESS",
        assignedTo: { name: "Soporte Técnico" },
        startedAt: "2024-01-15T11:00:00Z",
        finishedAt: null,
      },
    ],
  },
  {
    id: "inc_002",
    title: "Falla del Sistema",
    description: "Falla completa del sistema afectando todas las operaciones",
    priority: "CRITICAL",
    sla: 4,
    type: { name: "Sistema" },
    status: { name: "En Progreso" },
    vic: { name: "VIC Norte", code: "VIC002" },
    reportedBy: { name: "María García" },
    reportedAt: "2024-01-14T14:20:00Z",
    resolvedAt: null,
    workOrders: [
      {
        id: "wo_002",
        status: "COMPLETED",
        assignedTo: { name: "Administrador de Sistema" },
        startedAt: "2024-01-14T14:30:00Z",
        finishedAt: "2024-01-14T18:45:00Z",
      },
      {
        id: "wo_003",
        status: "PENDING",
        assignedTo: { name: "Equipo de Red" },
        startedAt: null,
        finishedAt: null,
      },
    ],
  },
]

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState(mockIncidents)
  const [filteredIncidents, setFilteredIncidents] = useState(mockIncidents)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter, setDateToFilter] = useState("")
  const [dateFilterType, setDateFilterType] = useState("reportedAt")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState("reportedAt")
  const [sortDirection, setSortDirection] = useState("desc")

  // Filter and search logic
  useEffect(() => {
    const filtered = incidents.filter((incident) => {
      const matchesSearch =
        incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        incident.description.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || incident.status.name === statusFilter
      const matchesPriority = priorityFilter === "all" || incident.priority === priorityFilter
      const matchesType = typeFilter === "all" || incident.type.name === typeFilter

      // Date filtering
      let matchesDate = true
      if (dateFromFilter || dateToFilter) {
        const incidentDate = new Date(incident[dateFilterType])
        if (dateFromFilter) {
          const fromDate = new Date(dateFromFilter)
          matchesDate = matchesDate && incidentDate >= fromDate
        }
        if (dateToFilter) {
          const toDate = new Date(dateToFilter)
          toDate.setHours(23, 59, 59, 999) // Include the entire day
          matchesDate = matchesDate && incidentDate <= toDate
        }
      }

      return matchesSearch && matchesStatus && matchesPriority && matchesType && matchesDate
    })

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortField]
      const bValue = b[sortField]
      const direction = sortDirection === "asc" ? 1 : -1

      if (aValue < bValue) return -1 * direction
      if (aValue > bValue) return 1 * direction
      return 0
    })

    setFilteredIncidents(filtered)
    setCurrentPage(1)
  }, [
    incidents,
    searchTerm,
    statusFilter,
    priorityFilter,
    typeFilter,
    sortField,
    sortDirection,
    dateFromFilter,
    dateToFilter,
    dateFilterType,
  ])

  // Pagination
  const totalPages = Math.ceil(filteredIncidents.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredIncidents.length)
  const paginatedIncidents = filteredIncidents.slice(startIndex, startIndex + itemsPerPage)

  const handleDelete = (incidentId: string) => {
    if (confirm("¿Está seguro de que desea eliminar este incidente?")) {
      setIncidents(incidents.filter((inc) => inc.id !== incidentId))
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Incidentes</h1>
          <p className="text-muted-foreground">Administre y rastree todos los incidentes y órdenes de trabajo</p>
        </div>
        <Link href="/admin/incidents/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Incidente
          </Button>
        </Link>
      </div>

      <IncidentFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        dateFromFilter={dateFromFilter}
        setDateFromFilter={setDateFromFilter}
        dateToFilter={dateToFilter}
        setDateToFilter={setDateToFilter}
        dateFilterType={dateFilterType}
        setDateFilterType={setDateFilterType}
        sortField={sortField}
        setSortField={setSortField}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
      />

      <Card>
        <CardHeader>
          <CardTitle>Incidentes ({filteredIncidents.length})</CardTitle>
          <CardDescription>
            Mostrando {startIndex + 1}-{endIndex} de {filteredIncidents.length} incidentes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IncidentTable incidents={paginatedIncidents} onDelete={handleDelete} />
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredIncidents.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(newItemsPerPage) => {
              setItemsPerPage(newItemsPerPage)
              setCurrentPage(1)
            }}
            startIndex={startIndex}
            endIndex={endIndex}
          />
        </CardContent>
      </Card>
    </div>
  )
}
