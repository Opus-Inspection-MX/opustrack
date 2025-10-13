import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, AlertTriangle, Wrench, Calendar } from "lucide-react"

export default function AdminDashboard() {
  const stats = [
    {
      title: "Total de Usuarios",
      value: "1,234",
      icon: Users,
      description: "+12% del mes pasado",
      color: "text-blue-600",
    },
    {
      title: "Incidentes Activos",
      value: "45",
      icon: AlertTriangle,
      description: "5 críticos",
      color: "text-red-600",
    },
    {
      title: "Órdenes de Trabajo Abiertas",
      value: "89",
      icon: Wrench,
      description: "23 vencen hoy",
      color: "text-orange-600",
    },
    {
      title: "Tareas Programadas",
      value: "156",
      icon: Calendar,
      description: "32 esta semana",
      color: "text-green-600",
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Panel</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Bienvenido al panel de administración</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incidentes Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Incidente #{1000 + i}</p>
                    <p className="text-xs text-muted-foreground">Reportado hace 2 horas</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">Crítico</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Órdenes de Trabajo Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">Orden de Trabajo #{2000 + i}</p>
                    <p className="text-xs text-muted-foreground">Vence en 3 días</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Pendiente</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
