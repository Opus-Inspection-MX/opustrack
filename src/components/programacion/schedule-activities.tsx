"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Settings, Wrench, Search, Filter } from "lucide-react"

interface ScheduleActivitiesProps {
  dateRange: {
    start: Date
    end: Date
    type: "day" | "week" | "month"
  }
}

export function ScheduleActivities({ dateRange }: ScheduleActivitiesProps) {
  const [selectedVic, setSelectedVic] = useState<string>("all")
  const [selectedFsr, setSelectedFsr] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Mock data - replace with actual data
  const mockIncidents = [
    {
      id: "1",
      title: "Fallo en sistema de frenos",
      vic: "VIC CDMX Norte",
      fsr: "Juan Pérez",
      date: "2025-11-20",
      time: "09:00",
      priority: 8,
      status: "Programado",
    },
    {
      id: "2",
      title: "Revisión de luces",
      vic: "VIC CDMX Sur",
      fsr: "María González",
      date: "2025-11-21",
      time: "10:30",
      priority: 5,
      status: "Pendiente",
    },
    {
      id: "3",
      title: "Inspección general",
      vic: "VIC Guadalajara",
      fsr: "Carlos Rodríguez",
      date: "2025-11-22",
      time: "14:00",
      priority: 3,
      status: "Programado",
    },
  ]

  const mockCalibrations = [
    {
      id: "1",
      title: "Calibración de Analizador de Gases",
      vic: "VIC CDMX Norte",
      fsr: "Juan Pérez",
      date: "2025-11-20",
      time: "08:00",
      equipment: "Analizador Modelo X-2000",
      status: "Programado",
    },
    {
      id: "2",
      title: "Calibración de Opacímetro",
      vic: "VIC CDMX Sur",
      fsr: "María González",
      date: "2025-11-23",
      time: "11:00",
      equipment: "Opacímetro Digital Pro",
      status: "Pendiente",
    },
  ]

  const mockMaintenances = [
    {
      id: "1",
      title: "Mantenimiento Preventivo General",
      vic: "VIC CDMX Norte",
      fsr: "Carlos Rodríguez",
      date: "2025-11-25",
      time: "07:00",
      type: "Preventivo",
      status: "Programado",
    },
    {
      id: "2",
      title: "Mantenimiento Sistema Hidráulico",
      vic: "VIC Guadalajara",
      fsr: "Juan Pérez",
      date: "2025-11-26",
      time: "13:00",
      type: "Correctivo",
      status: "Pendiente",
    },
  ]

  const getPriorityColor = (priority: number) => {
    if (priority >= 8) return "destructive"
    if (priority >= 6) return "default"
    return "secondary"
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "programado":
        return "default"
      case "pendiente":
        return "secondary"
      case "completado":
        return "outline"
      default:
        return "secondary"
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Actividades Programadas</CardTitle>
        <div className="text-sm text-muted-foreground">
          {dateRange.start.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}{" "}
          -{" "}
          {dateRange.end.toLocaleDateString("es-MX", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4">
          <div className="space-y-2">
            <Label className="text-xs">Filtrar por VIC</Label>
            <Select value={selectedVic} onValueChange={setSelectedVic}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los VICs</SelectItem>
                <SelectItem value="vic-1">VIC CDMX Norte</SelectItem>
                <SelectItem value="vic-2">VIC CDMX Sur</SelectItem>
                <SelectItem value="vic-3">VIC Guadalajara</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Filtrar por FSR</Label>
            <Select value={selectedFsr} onValueChange={setSelectedFsr}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los FSRs</SelectItem>
                <SelectItem value="fsr-1">Juan Pérez</SelectItem>
                <SelectItem value="fsr-2">María González</SelectItem>
                <SelectItem value="fsr-3">Carlos Rodríguez</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar actividad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto">
        <Tabs defaultValue="incidents" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="incidents" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Incidentes</span>
              <Badge variant="secondary" className="ml-1">
                {mockIncidents.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="calibrations" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Calibraciones</span>
              <Badge variant="secondary" className="ml-1">
                {mockCalibrations.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="maintenances" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="hidden sm:inline">Mantenimientos</span>
              <Badge variant="secondary" className="ml-1">
                {mockMaintenances.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Incidents Table */}
          <TabsContent value="incidents" className="flex-1 overflow-auto mt-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>VIC</TableHead>
                    <TableHead>FSR Asignado</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Prioridad</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockIncidents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay incidentes programados
                      </TableCell>
                    </TableRow>
                  ) : (
                    mockIncidents.map((incident) => (
                      <TableRow key={incident.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{incident.title}</TableCell>
                        <TableCell>{incident.vic}</TableCell>
                        <TableCell>
                          <Select defaultValue={incident.fsr}>
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Juan Pérez">Juan Pérez</SelectItem>
                              <SelectItem value="María González">María González</SelectItem>
                              <SelectItem value="Carlos Rodríguez">Carlos Rodríguez</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(incident.date).toLocaleDateString("es-MX")}</div>
                            <div className="text-muted-foreground">{incident.time}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPriorityColor(incident.priority)}>
                            {incident.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(incident.status)}>{incident.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Calibrations Table */}
          <TabsContent value="calibrations" className="flex-1 overflow-auto mt-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>VIC</TableHead>
                    <TableHead>FSR Asignado</TableHead>
                    <TableHead>Equipo</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockCalibrations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay calibraciones programadas
                      </TableCell>
                    </TableRow>
                  ) : (
                    mockCalibrations.map((calibration) => (
                      <TableRow key={calibration.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{calibration.title}</TableCell>
                        <TableCell>{calibration.vic}</TableCell>
                        <TableCell>
                          <Select defaultValue={calibration.fsr}>
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Juan Pérez">Juan Pérez</SelectItem>
                              <SelectItem value="María González">María González</SelectItem>
                              <SelectItem value="Carlos Rodríguez">Carlos Rodríguez</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm">{calibration.equipment}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(calibration.date).toLocaleDateString("es-MX")}</div>
                            <div className="text-muted-foreground">{calibration.time}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(calibration.status)}>
                            {calibration.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* Maintenances Table */}
          <TabsContent value="maintenances" className="flex-1 overflow-auto mt-4">
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>VIC</TableHead>
                    <TableHead>FSR Asignado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockMaintenances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No hay mantenimientos programados
                      </TableCell>
                    </TableRow>
                  ) : (
                    mockMaintenances.map((maintenance) => (
                      <TableRow key={maintenance.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="font-medium">{maintenance.title}</TableCell>
                        <TableCell>{maintenance.vic}</TableCell>
                        <TableCell>
                          <Select defaultValue={maintenance.fsr}>
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Juan Pérez">Juan Pérez</SelectItem>
                              <SelectItem value="María González">María González</SelectItem>
                              <SelectItem value="Carlos Rodríguez">Carlos Rodríguez</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{maintenance.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>{new Date(maintenance.date).toLocaleDateString("es-MX")}</div>
                            <div className="text-muted-foreground">{maintenance.time}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(maintenance.status)}>
                            {maintenance.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
