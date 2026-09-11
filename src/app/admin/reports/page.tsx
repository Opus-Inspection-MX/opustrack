import { CheckCircle, ClipboardList, TrendingUp, Wrench } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function ReportsPage() {
  await requireRouteAccess("/admin");

  return (
    <PageContainer>
      <PageHeader
        title="Reportes"
        description="Analiza el rendimiento del sistema con gráficos y métricas detalladas. Elige un reporte en las pestañas de arriba."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Reportes Disponibles"
          value={10}
          icon={ClipboardList}
          tone="info"
        />
        <StatCard
          title="Exportación PDF"
          value="Disponible"
          icon={CheckCircle}
          tone="success"
        />
        <StatCard
          title="Gráficos Interactivos"
          value="Sí"
          icon={TrendingUp}
          tone="warning"
        />
        <StatCard
          title="Filtros de Fecha"
          value="Personalizables"
          icon={Wrench}
        />
      </div>
    </PageContainer>
  );
}
