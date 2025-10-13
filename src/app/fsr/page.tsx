"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AlertCircle, Wrench, Calendar } from "lucide-react"
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
    reportedAt: new Date().toISOString(),
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
    reportedAt: new Date().toISOString(),
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
    reportedAt: new Date().toISOString(),
    workOrders: [],
  },
  {
    id: "inc_004",
    title: "Reparación de Cerradura de Puerta",
    description: "Cerradura de puerta de entrada principal está atascada",
    priority: "LOW",
    sla: 48,
    type: { name: "Mantenimiento" },
    status: { name: "Abierto" },
    vic: { name: "VIC Centro", code: "VIC001" },
    reportedBy: { name: "Juana Pérez" },
    reportedAt: new Date().toISOString(),
    workOrders: [],
  },
  {
    id: "inc_005",
    title: "Revisión de Sistema de Alarma Contra Incendios",
    description: "Se requiere inspección y prueba de rutina",
    priority: "MEDIUM",
    sla: 12,
    type: { name: "Seguridad" },
    status: { name: "Abierto" },
    vic: { name: "VIC Este", code: "VIC004" },
    reportedBy: { name: "Oficial de Seguridad" },
    reportedAt: new Date().toISOString(),
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

export default function MyWorkPage() {
  const router = useRouter()

  const todayIncidents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    return mockIncidents.filter((incident) => {
      const incidentDate = new Date(incident.reportedAt)
      return incidentDate >= today && incidentDate < tomorrow
    })
  }, [])

  const handleCompleteIncident = (incidentId: string) => {
    router.push(`/fsr/incidents/${incidentId}/complete`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString()
  }

  const stats = useMemo(() => {
    return {
      total: todayIncidents.length,
      open: todayIncidents.filter((i) => i.status.name === "Abierto").length,
      inProgress: todayIncidents.filter((i) => i.status.name === "En Progreso").length,
      highPriority: todayIncidents.filter((i) => i.priority === "HIGH" || i.priority === "CRITICAL").length,
    }
  }, [todayIncidents])

  return (
    <div className="space-y-4 md:space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Mi Trabajo</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">Incidentes de hoy asignados a ti</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Total de Hoy</CardTitle>
            <Calendar className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Abiertos</CardTitle>
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">En Progreso</CardTitle>
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
            <CardTitle className="text-xs md:text-sm font-medium">Alta Prioridad</CardTitle>
            <AlertCircle className="h-3 w-3 md:h-4 md:w-4 text-red-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
            <div className="text-xl md:text-2xl font-bold">{stats.highPriority}</div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Incidents List */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Incidentes de Hoy ({todayIncidents.length})</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Haz clic en un incidente para completarlo con detalles de orden de trabajo
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          <div className="space-y-3 md:space-y-4">
            {todayIncidents.map((incident) => (
              <div
                key={incident.id}
                className="flex flex-col md:flex-row md:items-start md:justify-between p-3 md:p-4 border rounded-lg hover:bg-accent transition-colors gap-3 md:gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 md:gap-2 flex-wrap">
                    <Badge className={`${priorityColors[incident.priority]} text-xs`}>{incident.priority}</Badge>
                    <Badge className={`${statusColors[incident.status.name]} text-xs`}>{incident.status.name}</Badge>
                    <Badge variant="outline" className="text-xs">
                      {incident.type.name}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      SLA: {incident.sla}h
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-base md:text-lg break-words">{incident.title}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground break-words">{incident.description}</p>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs md:text-sm text-muted-foreground">
                    <span className="break-words">
                      <strong>VIC:</strong> {incident.vic.name} ({incident.vic.code})
                    </span>
                    <span className="break-words">
                      <strong>Reportado por:</strong> {incident.reportedBy.name}
                    </span>
                    <span className="break-words">
                      <strong>Reportado:</strong> {formatDate(incident.reportedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 w-full md:w-auto md:ml-4">
                  <Button onClick={() => handleCompleteIncident(incident.id)} className="w-full md:w-auto text-sm">
                    <Wrench className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                    Completar Incidente
                  </Button>
                </div>
              </div>
            ))}
            {todayIncidents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="mx-auto h-12 w-12 mb-4" />
                <p className="text-sm md:text-base">No hay incidentes asignados para hoy</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
