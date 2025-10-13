"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus } from "lucide-react"
import Link from "next/link"
import { WorkOrderTable } from "@/components/work-orders/work-order-table"
import { WorkOrderFilters } from "@/components/work-orders/work-order-filters"
import { WorkOrderStats } from "@/components/work-orders/work-order-stats"
import { TablePagination } from "@/components/common/table-pagination"

// Mock data - replace with actual API calls
const mockWorkOrders = [
  {
    id: "wo_001",
    incident: {
      id: "inc_001",
      title: "Falla de Equipo",
      priority: "HIGH",
    },
    assignedTo: { name: "Juan Pérez", role: "FSR" },
    status: "IN_PROGRESS",
    notes: "Revisando sensores y calibración del equipo",
    startedAt: "2024-01-15T11:00:00Z",
    finishedAt: null,
    createdAt: "2024-01-15T10:45:00Z",
    workActivities: [{ description: "Diagnóstico inicial completado", performedAt: "2024-01-15T11:30:00Z" }],
  },
  {
    id: "wo_002",
    incident: {
      id: "inc_002",
      title: "Falla del Sistema",
      priority: "CRITICAL",
    },
    assignedTo: { name: "María García", role: "Administrador de Sistema" },
    status: "COMPLETED",
    notes: "Sistema restaurado, causa raíz identificada",
    startedAt: "2024-01-14T14:30:00Z",
    finishedAt: "2024-01-14T18:45:00Z",
    createdAt: "2024-01-14T14:25:00Z",
    workActivities: [
      { description: "Diagnóstico del sistema", performedAt: "2024-01-14T15:00:00Z" },
      { description: "Recuperación de base de datos", performedAt: "2024-01-14T16:30:00Z" },
      { description: "Pruebas del sistema", performedAt: "2024-01-14T18:00:00Z" },
    ],
  },
]

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState(mockWorkOrders)
  const [filteredWorkOrders, setFilteredWorkOrders] = useState(mockWorkOrders)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [assigneeFilter, setAssigneeFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState("createdAt")
  const [sortDirection, setSortDirection] = useState("desc")
  const [dateFromFilter, setDateFromFilter] = useState("")
  const [dateToFilter, setDateToFilter] = useState("")
  const [dateFilterType, setDateFilterType] = useState("createdAt")

  // Filter and search logic
  useEffect(() => {
    const filtered = workOrders.filter((workOrder) => {
      const matchesSearch =
        workOrder.incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workOrder.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workOrder.assignedTo.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "all" || workOrder.status === statusFilter
      const matchesAssignee = assigneeFilter === "all" || workOrder.assignedTo.name === assigneeFilter

      // Date filtering
      let matchesDate = true
      if (dateFromFilter || dateToFilter) {
        const workOrderDate = workOrder[dateFilterType] ? new Date(workOrder[dateFilterType]) : null
        if (workOrderDate) {
          if (dateFromFilter) {
            const fromDate = new Date(dateFromFilter)
            matchesDate = matchesDate && workOrderDate >= fromDate
          }
          if (dateToFilter) {
            const toDate = new Date(dateToFilter)
            toDate.setHours(23, 59, 59, 999) // Include the entire day
            matchesDate = matchesDate && workOrderDate <= toDate
          }
        } else if (dateFromFilter || dateToFilter) {
          // If date filter is applied but workOrder doesn't have the date field, exclude it
          matchesDate = false
        }
      }

      return matchesSearch && matchesStatus && matchesAssignee && matchesDate
    })

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue

      if (sortField === "createdAt" || sortField === "startedAt" || sortField === "finishedAt") {
        aValue = new Date(a[sortField] || 0).getTime()
        bValue = new Date(b[sortField] || 0).getTime()
      } else if (sortField === "incident.title") {
        aValue = a.incident.title
        bValue = b.incident.title
      } else if (sortField === "assignedTo.name") {
        aValue = a.assignedTo.name
        bValue = b.assignedTo.name
      } else {
        aValue = a[sortField]
        bValue = b[sortField]
      }

      const direction = sortDirection === "asc" ? 1 : -1

      if (aValue < bValue) return -1 * direction
      if (aValue > bValue) return 1 * direction
      return 0
    })

    setFilteredWorkOrders(filtered)
    setCurrentPage(1)
  }, [
    workOrders,
    searchTerm,
    statusFilter,
    assigneeFilter,
    sortField,
    sortDirection,
    dateFromFilter,
    dateToFilter,
    dateFilterType,
    itemsPerPage,
  ])

  // Pagination
  const totalPages = Math.ceil(filteredWorkOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, filteredWorkOrders.length)
  const paginatedWorkOrders = filteredWorkOrders.slice(startIndex, startIndex + itemsPerPage)

  const handleDelete = (workOrderId: string) => {
    if (confirm("¿Está seguro de que desea eliminar esta orden de trabajo?")) {
      setWorkOrders(workOrders.filter((wo) => wo.id !== workOrderId))
    }
  }

  // Get unique assignees for filter
  const uniqueAssignees = [...new Set(workOrders.map((wo) => wo.assignedTo.name))]

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Órdenes de Trabajo</h1>
          <p className="text-muted-foreground">Rastree y administre todas las órdenes de trabajo</p>
        </div>
        <Link href="/admin/work-orders/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden de Trabajo
          </Button>
        </Link>
      </div>

      <WorkOrderStats workOrders={workOrders} />

      <WorkOrderFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        assigneeFilter={assigneeFilter}
        setAssigneeFilter={setAssigneeFilter}
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
        uniqueAssignees={uniqueAssignees}
      />

      <Card>
        <CardHeader>
          <CardTitle>Órdenes de Trabajo ({filteredWorkOrders.length})</CardTitle>
          <CardDescription>
            Mostrando {startIndex + 1}-{endIndex} de {filteredWorkOrders.length} órdenes de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkOrderTable workOrders={paginatedWorkOrders} onDelete={handleDelete} />
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredWorkOrders.length}
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
