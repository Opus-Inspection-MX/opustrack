"use client"

import { Label } from "@/components/ui/label"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Search, Wrench, X } from "lucide-react"
import { useRouter } from "next/navigation"

// Mock data - replace with actual API calls filtered by technician
const mockIncidents = [
  {
    id: "inc_001",
    title: "Mal Funcionamiento de Equipo - Edificio A",
    description: "Cámara de seguridad no funciona correctamente",
    priority: "HIGH",
    sla: 4,
    type: { name: "Equipo" },
    status: { name: "En Progreso" },
    vic: { name: "VIC Centro", code: "VIC001" },
    reportedBy: { name: "Juan Gerente" },
    reportedAt: "2024-01-15T09:00:00Z",
    workOrders: [],
  },
  {
    id: "inc_002",
    title: "Problema de Conectividad de Red",
    description: "Sala de servidores experimentando caídas intermitentes de red",
    priority: "CRITICAL",
    sla: 2,
    type: { name: "Red" },
    status: { name: "Abierto" },
    vic: { name: "VIC Norte", code: "VIC002" },
    reportedBy: { name: "Sara Admin" },
    reportedAt: "2024-01-15T10:30:00Z",
    workOrders: [],
  },
  {
    id: "inc_003",
    title: "Actualización de Sistema de Control de Acceso",
    description: "Necesita instalar nuevo sistema de control de acceso en entrada principal",
    priority: "MEDIUM",
    sla: 24,
    type: { name: "Sistema" },
    status: { name: "Abierto" },
    vic: { name: "VIC Sur", code: "VIC003" },
    reportedBy: { name: "Miguel Seguridad" },
    reportedAt: "2024-01-14T14:00:00Z",
    workOrders: [],
  },
]

const priorityColors: Record<string, string> = {
  LOW: "bg-green-100 text-green-800",
  MEDIUM: "bg-yellow-100 text-yellow-800",
  HIGH: "bg-orange-100 text-orange-800",
  CRITICAL: "bg-red-100 text-red-800",
}

const statusColors: Record<string, string> = {
  Abierto: "bg-blue-100 text-blue-800",
  "En Progreso": "bg-yellow-100 text-yellow-800",
  Resuelto: "bg-green-100 text-green-800",
  Cerrado: "bg-gray-100 text-gray-800",
}

export default function MyIncidentsPage() {
  const [incidents] = useState(mockIncidents)
  const [searchTerm, setSearchTerm] = useState("")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const router = useRouter()

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.vic.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPriority = priorityFilter === "all" || incident.priority === priorityFilter
    const matchesStatus = statusFilter === "all" || incident.status.name === statusFilter
    const matchesType = typeFilter === "all" || incident.type.name === typeFilter

    let matchesDateRange = true
    if (startDate || endDate) {
      const incidentDate = new Date(incident.reportedAt)
      if (startDate) {
        const start = new Date(startDate)
        start.setHours(0, 0, 0, 0)
        matchesDateRange = matchesDateRange && incidentDate >= start
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        matchesDateRange = matchesDateRange && incidentDate <= end
      }
    }

    return matchesSearch && matchesPriority && matchesStatus && matchesType && matchesDateRange
  })

  const handleCompleteIncident = (incidentId: string) => {
    router.push(`/fsr/incidents/${incidentId}/complete`)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setPriorityFilter("all")
    setStatusFilter("all")
    setTypeFilter("all")
    setStartDate("")
    setEndDate("")
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString()
  }

  const incidentTypes = Array.from(new Set(incidents.map((i) => i.type.name)))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mis Incidentes</h1>
        <p className="text-muted-foreground mt-2">Busca y filtra todos los incidentes asignados a ti</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Asignados</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Abiertos</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents.filter((i) => i.status.name === "Abierto").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{incidents.filter((i) => i.status.name === "En Progreso").length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alta Prioridad</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {incidents.filter((i) => i.priority === "HIGH" || i.priority === "CRITICAL").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filtrar Incidentes</CardTitle>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Label htmlFor="search">Buscar</Label>
              <Search className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Buscar incidentes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div>
              <Label htmlFor="priority">Prioridad</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger id="priority">
                  <SelectValue placeholder="Filtrar por prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las Prioridades</SelectItem>
                  <SelectItem value="LOW">Baja</SelectItem>
                  <SelectItem value="MEDIUM">Media</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                  <SelectItem value="CRITICAL">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="status">Estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Filtrar por estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Estados</SelectItem>
                  <SelectItem value="Abierto">Abierto</SelectItem>
                  <SelectItem value="En Progreso">En Progreso</SelectItem>
                  <SelectItem value="Resuelto">Resuelto</SelectItem>
                  <SelectItem value="Cerrado">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Tipos</SelectItem>
                  {incidentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">Fecha Inicio</Label>
              <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="endDate">Fecha Fin</Label>
              <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <Card>
        <CardHeader>
          <CardTitle>Incidentes ({filteredIncidents.length})</CardTitle>
          <CardDescription>Haz clic en un incidente para completarlo con detalles de orden de trabajo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={priorityColors[incident.priority]}>{incident.priority}</Badge>
                    <Badge className={statusColors[incident.status.name]}>{incident.status.name}</Badge>
                    <Badge variant="outline">{incident.type.name}</Badge>
                    <Badge variant="outline">SLA: {incident.sla}h</Badge>
                  </div>
                  <h3 className="font-semibold text-lg">{incident.title}</h3>
                  <p className="text-sm text-muted-foreground">{incident.description}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>
                      <strong>VIC:</strong> {incident.vic.name} ({incident.vic.code})
                    </span>
                    <span>
                      <strong>Reportado por:</strong> {incident.reportedBy.name}
                    </span>
                    <span>
                      <strong>Reportado:</strong> {formatDate(incident.reportedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button onClick={() => handleCompleteIncident(incident.id)}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Completar Incidente
                  </Button>
                </div>
              </div>
            ))}
            {filteredIncidents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="mx-auto h-12 w-12 mb-4" />
                <p>No se encontraron incidentes que coincidan con tus filtros</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
