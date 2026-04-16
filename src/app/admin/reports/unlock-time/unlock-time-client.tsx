"use client";

import { Lock, LockOpen, Timer } from "lucide-react";
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
import type { UnlockTimeData, UnlockTimeSummary } from "@/lib/actions/reports";
import { getUnlockTimeData } from "@/lib/actions/reports";

interface UnlockTimeClientProps {
  initialData: {
    workOrders: UnlockTimeData[];
    summary: UnlockTimeSummary;
  };
}

export function UnlockTimeClient({ initialData }: UnlockTimeClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData.workOrders);
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
      const result = await getUnlockTimeData({
        startDate: newStartDate,
        endDate: newEndDate,
      });
      setData(result.workOrders);
      setSummary(result.summary);
    });
  };

  // Prepare chart data
  const unlockDistribution = [
    { name: "Desbloqueado", value: summary.unlockedCount },
    { name: "Pendiente", value: summary.pendingUnlockCount },
  ].filter((d) => d.value > 0);

  const fsrChartData = summary.byFSR.map((fsr) => ({
    name: fsr.fsrName.split(" ")[0], // First name only
    Desbloqueados: fsr.unlocked,
    Pendientes: fsr.totalAssigned - fsr.unlocked,
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
            Tiempo de Desbloqueo
          </h1>
          <p className="text-muted-foreground mt-1">
            Analisis del tiempo que toman los FSR en reconocer y desbloquear
            ordenes de trabajo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Tiempo de Desbloqueo"
            reportId="unlock-time"
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
          title="Tasa de Desbloqueo"
          value={`${summary.unlockRate.toFixed(1)}%`}
          description="Ordenes reconocidas"
          icon={LockOpen}
        />
        <StatCard
          title="Desbloqueados"
          value={summary.unlockedCount}
          description={`de ${summary.totalWorkOrders} ordenes`}
          icon={LockOpen}
        />
        <StatCard
          title="Tiempo Promedio"
          value={formatTime(summary.avgTimeToUnlock)}
          description="Para desbloquear"
          icon={Timer}
        />
        <StatCard
          title="Tiempo Mediana"
          value={formatTime(summary.medianTimeToUnlock)}
          description="Valor central"
          icon={Timer}
        />
      </div>

      {/* Warning for pending unlocks */}
      {summary.pendingUnlockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                Ordenes Pendientes de Desbloqueo
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Hay {summary.pendingUnlockCount} ordenes de trabajo que aun no
                han sido reconocidas por los FSR asignados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Estado de Desbloqueo"
          description="Distribucion de ordenes desbloqueadas vs pendientes"
        >
          {unlockDistribution.length > 0 ? (
            <PieChart
              data={unlockDistribution}
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
          title="Desbloqueos por FSR"
          description="Comparativa de desbloqueos por tecnico"
        >
          {fsrChartData.length > 0 ? (
            <BarChart
              data={fsrChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Desbloqueados",
                  name: "Desbloqueados",
                  color: "#10B981",
                },
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
          title="Tiempo Promedio por FSR"
          description="Tiempo promedio de desbloqueo por cada tecnico"
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
        description="Detalle de tiempos de desbloqueo por tecnico"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FSR</TableHead>
                <TableHead className="text-right">Asignadas</TableHead>
                <TableHead className="text-right">Desbloqueadas</TableHead>
                <TableHead className="text-right">% Desbloqueo</TableHead>
                <TableHead className="text-right">Tiempo Promedio</TableHead>
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
                    {fsr.unlocked}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {fsr.totalAssigned > 0
                      ? ((fsr.unlocked / fsr.totalAssigned) * 100).toFixed(1)
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
        title="Detalle de Ordenes"
        description="Todas las ordenes con su tiempo de desbloqueo"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Incidente</TableHead>
                <TableHead>FSR</TableHead>
                <TableHead>Asignada</TableHead>
                <TableHead>Desbloqueada</TableHead>
                <TableHead className="text-right">Tiempo</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((wo) => (
                <TableRow key={wo.workOrderId}>
                  <TableCell className="font-mono text-sm">
                    {wo.folio || `#${wo.workOrderId.slice(0, 8)}`}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {wo.incidentTitle}
                  </TableCell>
                  <TableCell>{wo.fsrName}</TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(wo.assignedAt)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDateTime(wo.unlockedAt)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getTimeColor(wo.timeToUnlockMinutes)}`}
                  >
                    {formatTime(wo.timeToUnlockMinutes)}
                  </TableCell>
                  <TableCell>
                    {wo.isUnlocked ? (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        <LockOpen className="h-3 w-3 mr-1" />
                        Desbloqueado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-amber-500 text-amber-700 dark:text-amber-300"
                      >
                        <Lock className="h-3 w-3 mr-1" />
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
                    No hay ordenes de trabajo para el periodo seleccionado
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
