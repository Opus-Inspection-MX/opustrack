"use client";

import { Eye, EyeOff, Timer } from "lucide-react";
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
import type { SeenTimeData, SeenTimeSummary } from "@/lib/actions/reports";
import { getSeenTimeData } from "@/lib/actions/reports";

interface SeenTimeClientProps {
  initialData: {
    assignments: SeenTimeData[];
    summary: SeenTimeSummary;
  };
}

export function SeenTimeClient({ initialData }: SeenTimeClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData.assignments);
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
      const result = await getSeenTimeData({
        startDate: newStartDate,
        endDate: newEndDate,
      });
      setData(result.assignments);
      setSummary(result.summary);
    });
  };

  // Prepare chart data
  const seenDistribution = [
    { name: "Vista", value: summary.seenCount },
    { name: "Pendiente", value: summary.pendingSeenCount },
  ].filter((d) => d.value > 0);

  const fsrChartData = summary.byFSR.map((fsr) => ({
    name: fsr.fsrName.split(" ")[0], // First name only
    Vistas: fsr.seen,
    Pendientes: fsr.totalAssigned - fsr.seen,
    "Tiempo Promedio": fsr.avgTimeMinutes,
  }));

  const fsrTimeChartData = summary.byFSR
    .filter((fsr) => fsr.avgTimeMinutes > 0)
    .map((fsr) => ({
      name: fsr.fsrName.split(" ")[0],
      Minutos: fsr.avgTimeMinutes,
    }));

  const formatTime = (minutes: number | null) => {
    if (minutes === null || minutes === 0) return "N/A";
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("es-MX", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeColor = (minutes: number | null) => {
    if (minutes === null) return "text-muted-foreground";
    if (minutes <= 30) return "text-green-600";
    if (minutes <= 60) return "text-yellow-600";
    if (minutes <= 120) return "text-orange-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Tiempo de Visualización
          </h1>
          <p className="text-muted-foreground mt-1">
            Análisis del tiempo que toman los FSR en marcar como vistas las
            asignaciones.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Tiempo de Visualización"
            reportId="seen-time"
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
          title="Tasa de Visualización"
          value={`${summary.seenRate.toFixed(1)}%`}
          description="Asignaciones vistas"
          icon={Eye}
        />
        <StatCard
          title="Vistas"
          value={summary.seenCount}
          description={`de ${summary.totalAssignments} asignaciones`}
          icon={Eye}
        />
        <StatCard
          title="Tiempo Promedio"
          value={formatTime(summary.avgTimeToSeen)}
          description="Para visualizar"
          icon={Timer}
        />
        <StatCard
          title="Tiempo Mediana"
          value={formatTime(summary.medianTimeToSeen)}
          description="Valor central"
          icon={Timer}
        />
      </div>

      {/* Warning for pending views */}
      {summary.pendingSeenCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <EyeOff className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                Asignaciones pendientes de visualizar
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Hay {summary.pendingSeenCount} asignaciones que aún no han sido
                vistas por los FSR asignados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Estado de visualización"
          description="Distribución de asignaciones vistas vs pendientes"
        >
          {seenDistribution.length > 0 ? (
            <PieChart
              data={seenDistribution}
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
          title="Visualizaciones por FSR"
          description="Comparativa de asignaciones vistas por técnico"
        >
          {fsrChartData.length > 0 ? (
            <BarChart
              data={fsrChartData}
              xAxisKey="name"
              bars={[
                { dataKey: "Vistas", name: "Vistas", color: "#10B981" },
                { dataKey: "Pendientes", name: "Pendientes", color: "#F59E0B" },
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

      {/* FSR Time Comparison */}
      {fsrTimeChartData.length > 0 && (
        <ChartCard
          title="Tiempo promedio por FSR"
          description="Tiempo promedio para marcar como vista por técnico"
        >
          <BarChart
            data={fsrTimeChartData}
            xAxisKey="name"
            bars={[{ dataKey: "Minutos", name: "Minutos", color: "#8B5CF6" }]}
            height={300}
            showLegend={false}
          />
        </ChartCard>
      )}

      {/* FSR Summary Table */}
      <ChartCard
        title="Rendimiento por FSR"
        description="Detalle de tiempos de visualización por técnico"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FSR</TableHead>
                <TableHead className="text-right">Asignadas</TableHead>
                <TableHead className="text-right">Vistas</TableHead>
                <TableHead className="text-right">% Vistas</TableHead>
                <TableHead className="text-right">Tiempo promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.byFSR.map((fsr) => (
                <TableRow key={fsr.fsrId}>
                  <TableCell className="font-medium">{fsr.fsrName}</TableCell>
                  <TableCell className="text-right">
                    {fsr.totalAssigned}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    {fsr.seen}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fsr.totalAssigned > 0
                      ? ((fsr.seen / fsr.totalAssigned) * 100).toFixed(1)
                      : 0}
                    %
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getTimeColor(fsr.avgTimeMinutes)}`}
                  >
                    {formatTime(fsr.avgTimeMinutes)}
                  </TableCell>
                </TableRow>
              ))}
              {summary.byFSR.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay datos de FSR disponibles
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </ChartCard>

      {/* Detailed Data Table */}
      <ChartCard
        title="Detalle de asignaciones"
        description="Todas las asignaciones con su tiempo de visualización"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Incidente</TableHead>
                <TableHead>FSR</TableHead>
                <TableHead>Asignada</TableHead>
                <TableHead>Vista</TableHead>
                <TableHead className="text-right">Tiempo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((wo) => (
                <TableRow key={wo.assignmentId}>
                  <TableCell className="font-mono text-sm">
                    AS-{wo.folio}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {wo.incidentTitle}
                  </TableCell>
                  <TableCell>{wo.fsrName}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(wo.assignedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(wo.seenAt)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getTimeColor(wo.timeToSeenMinutes)}`}
                  >
                    {formatTime(wo.timeToSeenMinutes)}
                  </TableCell>
                  <TableCell>
                    {wo.isSeen ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <Eye className="h-3 w-3 mr-1" />
                        Vista
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 dark:text-amber-300"
                      >
                        <EyeOff className="h-3 w-3 mr-1" />
                        Pendiente
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay asignaciones para el periodo seleccionado
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
