"use client";

import { CheckCircle, Clock, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import {
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
import type { WorkOrderStatusData } from "@/lib/actions/reports";
import {
  getReportSummary,
  getWorkOrderStatusData,
} from "@/lib/actions/reports";

interface WorkOrdersReportClientProps {
  initialData: WorkOrderStatusData[];
  initialSummary: Awaited<ReturnType<typeof getReportSummary>>;
}

const statusColors: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800",
  ASIGNADO: "bg-purple-100 text-purple-800",
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  COMPLETADO: "bg-green-100 text-green-800",
  CANCELADO: "bg-red-100 text-red-800",
  "Sin Estado": "bg-gray-100 text-gray-800",
};

export function WorkOrdersReportClient({
  initialData,
  initialSummary,
}: WorkOrdersReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [summary, setSummary] = useState(initialSummary);

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
      const [newData, newSummary] = await Promise.all([
        getWorkOrderStatusData({
          startDate: newStartDate,
          endDate: newEndDate,
        }),
        getReportSummary({ startDate: newStartDate, endDate: newEndDate }),
      ]);
      setData(newData);
      setSummary(newSummary);
    });
  };

  // Calculate totals
  const totalWorkOrders = data.reduce((sum, d) => sum + d.count, 0);
  const completedCount =
    data.find((d) => d.status === "COMPLETADO")?.count || 0;
  const pendingCount =
    (data.find((d) => d.status === "PENDIENTE")?.count || 0) +
    (data.find((d) => d.status === "ASIGNADO")?.count || 0);
  const inProgressCount =
    data.find((d) => d.status === "EN_PROGRESO")?.count || 0;

  // Prepare chart data
  const chartData = data.map((d) => ({
    name: d.status,
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Estado de Ordenes de Trabajo
          </h1>
          <p className="text-muted-foreground mt-1">
            Distribucion y metricas de ordenes de trabajo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Estado de Ordenes de Trabajo"
            reportId="work-orders"
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
          title="Total Ordenes"
          value={totalWorkOrders}
          description="En el periodo seleccionado"
        />
        <StatCard
          title="Completadas"
          value={completedCount}
          description={`${summary.workOrderCompletionRate}% del total`}
          icon={CheckCircle}
        />
        <StatCard
          title="En Progreso"
          value={inProgressCount}
          description="Actualmente en ejecucion"
          icon={Clock}
        />
        <StatCard
          title="Pendientes"
          value={pendingCount}
          description="Por iniciar"
          icon={XCircle}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Distribucion por Estado"
          description="Proporcion de ordenes segun su estado"
        >
          {data.length > 0 ? (
            <PieChart
              data={chartData}
              nameKey="name"
              valueKey="value"
              height={350}
            />
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Detalle por Estado"
          description="Conteo y porcentaje de cada estado"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Porcentaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[row.status] || "bg-gray-100"}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">
                      {row.percentage}%
                    </TableCell>
                  </TableRow>
                ))}
                {data.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No hay datos disponibles
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </ChartCard>
      </div>

      {/* Summary Card */}
      <ChartCard
        title="Resumen del Periodo"
        description="Metricas clave del rango de fechas seleccionado"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Total Incidentes</p>
            <p className="text-2xl font-bold">{summary.totalIncidents}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              Incidentes Resueltos
            </p>
            <p className="text-2xl font-bold">{summary.resolvedIncidents}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Viajes Realizados</p>
            <p className="text-2xl font-bold">{summary.totalTrips}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">Partes Utilizadas</p>
            <p className="text-2xl font-bold">{summary.totalPartsUsed}</p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
