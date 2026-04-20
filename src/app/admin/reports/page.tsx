import {
  AlertTriangle,
  Bell,
  Car,
  CheckCircle,
  CheckCircle2,
  ClipboardList,
  Package,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRouteAccess } from "@/lib/auth/auth";

const reports = [
  {
    title: "Rendimiento de FSR",
    description:
      "Analiza el desempeno de los Field Service Representatives: ordenes completadas, tiempos de respuesta y kilometraje.",
    href: "/admin/reports/fsr-performance",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    title: "Estado de Ordenes de Trabajo",
    description:
      "Distribucion de ordenes por estado, tendencias y metricas de completitud.",
    href: "/admin/reports/work-orders",
    icon: ClipboardList,
    color: "bg-emerald-500",
  },
  {
    title: "Analisis de Incidentes",
    description:
      "Tendencias de incidentes, distribucion por tipo y tiempos de resolucion.",
    href: "/admin/reports/incidents",
    icon: AlertTriangle,
    color: "bg-amber-500",
  },
  {
    title: "Viajes de Vehiculos",
    description:
      "Seguimiento de viajes, kilometraje por FSR y utilizacion de la flota.",
    href: "/admin/reports/vehicle-trips",
    icon: Car,
    color: "bg-violet-500",
  },
  {
    title: "Uso de Partes",
    description:
      "Consumo de inventario, partes mas utilizadas y costos asociados.",
    href: "/admin/reports/parts-usage",
    icon: Package,
    color: "bg-pink-500",
  },
  {
    title: "Cumplimiento Diario de Viajes",
    description:
      "Que FSRs han registrado su viaje diario y cuales no, con matriz de cumplimiento por dia.",
    href: "/admin/reports/daily-trip-compliance",
    icon: CheckCircle2,
    color: "bg-teal-500",
  },
  {
    title: "Engagement de Notificaciones",
    description:
      "Que FSRs han abierto sus notificaciones de trabajo y cuales tienen pendientes criticas.",
    href: "/admin/reports/notification-engagement",
    icon: Bell,
    color: "bg-orange-500",
  },
];

export default async function ReportsPage() {
  await requireRouteAccess("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground mt-1">
          Analiza el rendimiento del sistema con graficos y metricas detalladas.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reportes Disponibles
                </p>
                <p className="text-2xl font-bold">{reports.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Exportacion PDF
                </p>
                <p className="text-2xl font-bold">Disponible</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Graficos Interactivos
                </p>
                <p className="text-2xl font-bold">Si</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Wrench className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Filtros de Fecha
                </p>
                <p className="text-2xl font-bold">Personalizables</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Reportes Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <Link key={report.href} href={report.href}>
              <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer group">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg ${report.color} flex items-center justify-center`}
                    >
                      <report.icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {report.title}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {report.description}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
