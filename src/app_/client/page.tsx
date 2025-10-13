import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Search, AlertTriangle, Clock, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function IncidentsDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Incidentes</h1>
          <p className="text-muted-foreground mt-2">Rastrea y reporta incidentes</p>
        </div>
        <Link href="/client/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Reportar Incidente
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidentes Abiertos</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">Esperando respuesta</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Progreso</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
            <p className="text-xs text-muted-foreground">Siendo resueltos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resueltos</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar incidentes..." className="pl-10" />
        </div>
      </div>

      {/* Incidents List */}
      <Card>
        <CardHeader>
          <CardTitle>Incidentes Recientes</CardTitle>
          <CardDescription>Tus incidentes reportados y su estado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                id: "INC-001",
                title: "Cámara de seguridad no funciona",
                status: "En Progreso",
                priority: "alta",
                date: "2024-01-10",
                location: "Edificio A - Piso 2",
              },
              {
                id: "INC-002",
                title: "Mal funcionamiento del lector de tarjetas de acceso",
                status: "Abierto",
                priority: "media",
                date: "2024-01-09",
                location: "Entrada Principal",
              },
              {
                id: "INC-003",
                title: "Problemas de conectividad de red",
                status: "Abierto",
                priority: "alta",
                date: "2024-01-08",
                location: "Ala de Oficinas",
              },
            ].map((incident) => (
              <div
                key={incident.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
              >
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{incident.id}</span>
                    <Badge variant={incident.priority === "alta" ? "destructive" : "secondary"}>
                      {incident.priority}
                    </Badge>
                    <Badge variant="outline">{incident.status}</Badge>
                  </div>
                  <h3 className="font-semibold">{incident.title}</h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{incident.date}</span>
                    <span>{incident.location}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Ver Detalles
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
