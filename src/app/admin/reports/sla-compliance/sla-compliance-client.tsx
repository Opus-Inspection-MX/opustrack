"use client";

import { AlertTriangle, CheckCircle, Clock, Target } from "lucide-react";
import { useState, useTransition } from "react";
import {
  BarChart,
  ChartCard,
  DateRangeFilter,
  PDFExportButton,
  PieChart,
  StatCard,
} from "@/components/reports";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SLAComplianceData, SLASummary } from "@/lib/actions/reports";
import { getSLAComplianceData } from "@/lib/actions/reports";

interface SLAComplianceClientProps {
  initialData: {
    incidents: SLAComplianceData[];
    summary: SLASummary;
  };
}

export function SLAComplianceClient({ initialData }: SLAComplianceClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData.incidents);
  const [summary, setSummary] = useState(initialData.summary);

  // Date range state
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(
    thirtyDaysAgo.toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    startTransition(async () => {
      const result = await getSLAComplianceData({
        startDate: newStartDate,
        endDate: newEndDate,
      });
      setData(result.incidents);
      setSummary(result.summary);
    });
  };

  // Prepare chart data
  const complianceDistribution = [
    { name: "Cumplido", value: summary.compliantCount },
    { name: "Incumplido", value: summary.breachedCount },
    { name: "Pendiente", value: summary.pendingCount },
  ].filter((d) => d.value > 0);

  const priorityChartData = summary.byPriority.map((p) => ({
    name: `Prioridad ${p.priority}`,
    Cumplido: p.compliant,
    Incumplido: p.breached,
    "% Cumplimiento": p.complianceRate,
  }));

  const formatHours = (hours: number | null) => {
    if (hours === null) return "Pendiente";
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    return `${hours.toFixed(1)}h`;
  };

  const getPriorityLabel = (priority: number) => {
    const labels: Record<number, string> = {
      1: "Critica",
      2: "Alta",
      3: "Media",
      4: "Baja",
    };
    return labels[priority] || `P${priority}`;
  };

  const getPriorityColor = (priority: number) => {
    const colors: Record<number, string> = {
      1: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      2: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      3: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      4: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    };
    return colors[priority] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cumplimiento de SLA
          </h1>
          <p className="text-muted-foreground mt-1">
            Analisis de tiempos de respuesta y cumplimiento de acuerdos de
            servicio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Cumplimiento de SLA"
            reportId="sla-compliance"
          />
        </div>
      </div>

      {isPending && (
        <div className="text-center py-4 text-muted-foreground">
          Cargando datos...
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tasa de Cumplimiento"
          value={`${summary.complianceRate.toFixed(1)}%`}
          description="Incidentes resueltos a tiempo"
          icon={Target}
        />
        <StatCard
          title="Cumplidos"
          value={summary.compliantCount}
          description={`de ${summary.totalIncidents} incidentes`}
          icon={CheckCircle}
        />
        <StatCard
          title="Incumplidos"
          value={summary.breachedCount}
          description="Fuera de SLA"
          icon={AlertTriangle}
        />
        <StatCard
          title="Tiempo Promedio"
          value={formatHours(summary.avgResolutionTime)}
          description="De resolucion"
          icon={Clock}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Distribucion de Cumplimiento"
          description="Estado de SLA de todos los incidentes"
        >
          {complianceDistribution.length > 0 ? (
            <PieChart
              data={complianceDistribution}
              nameKey="name"
              valueKey="value"
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Cumplimiento por Prioridad"
          description="Comparativa de SLA por nivel de prioridad"
        >
          {priorityChartData.length > 0 ? (
            <BarChart
              data={priorityChartData}
              xAxisKey="name"
              bars={[
                { dataKey: "Cumplido", name: "Cumplido", color: "#10B981" },
                { dataKey: "Incumplido", name: "Incumplido", color: "#EF4444" },
              ]}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ChartCard>
      </div>

      {/* Priority Summary Table */}
      <ChartCard
        title="Resumen por Prioridad"
        description="Detalle de cumplimiento por nivel de prioridad"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Cumplido</TableHead>
                <TableHead className="text-right">Incumplido</TableHead>
                <TableHead className="text-right">% Cumplimiento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byPriority.map((p) => (
                <TableRow key={p.priority}>
                  <TableCell>
                    <Badge className={getPriorityColor(p.priority)}>
                      {getPriorityLabel(p.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{p.total}</TableCell>
                  <TableCell className="text-right text-green-600">
                    {p.compliant}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    {p.breached}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {p.complianceRate.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      {/* Detailed Data Table */}
      <ChartCard
        title="Detalle de Incidentes"
        description="Todos los incidentes con su estado de SLA"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Titulo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">SLA</TableHead>
                <TableHead className="text-right">Tiempo Real</TableHead>
                <TableHead>Estado SLA</TableHead>
                <TableHead>Estatus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((incident) => (
                <TableRow key={incident.incidentId}>
                  <TableCell className="font-mono text-sm">
                    #{incident.incidentId}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {incident.title}
                  </TableCell>
                  <TableCell>
                    <Badge className={getPriorityColor(incident.priority)}>
                      {getPriorityLabel(incident.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {incident.slaHours}h
                  </TableCell>
                  <TableCell className="text-right">
                    {formatHours(incident.actualHours)}
                  </TableCell>
                  <TableCell>
                    {incident.actualHours === null ? (
                      <Badge variant="outline">Pendiente</Badge>
                    ) : incident.isCompliant ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Cumplido
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Incumplido</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{incident.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay incidentes para el periodo seleccionado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
    </div>
  );
}
