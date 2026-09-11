import { CheckCircle, ClipboardList, TrendingUp, Wrench } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function ReportsPage() {
  await requireRouteAccess("/admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Analiza el rendimiento del sistema con gráficos y métricas detalladas. Elige un reporte en las pestañas de arriba."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <ClipboardList className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Reportes Disponibles
                </p>
                <p className="text-2xl font-bold">10</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Exportación PDF
                </p>
                <p className="text-2xl font-bold">Disponible</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/10">
                <TrendingUp className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Gráficos Interactivos
                </p>
                <p className="text-2xl font-bold">Sí</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-violet-500/10">
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
    </div>
  );
}
