"use client";

import { Users } from "lucide-react";
import { useState, useTransition } from "react";
import {
  BarChart,
  ChartCard,
  DateRangeFilter,
  PDFExportButton,
  StatCard,
} from "@/components/reports";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FSRPerformanceData } from "@/lib/actions/reports";
import { getFSRPerformanceData, getReportSummary } from "@/lib/actions/reports";
import { mxDaysAgoString } from "@/lib/utils/datetime";

interface FSRPerformanceClientProps {
  initialData: FSRPerformanceData[];
  initialSummary: Awaited<ReturnType<typeof getReportSummary>>;
}

export function FSRPerformanceClient({
  initialData,
  initialSummary,
}: FSRPerformanceClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);
  const [_summary, setSummary] = useState(initialSummary);

  // Date range state — CDMX today / N days ago (avoids UTC date drift)

  const [startDate, setStartDate] = useState(() => mxDaysAgoString(30));
  const [endDate, setEndDate] = useState(() => mxDaysAgoString(0));

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    startTransition(async () => {
      const [newData, newSummary] = await Promise.all([
        getFSRPerformanceData({ startDate: newStartDate, endDate: newEndDate }),
        getReportSummary({ startDate: newStartDate, endDate: newEndDate }),
      ]);
      setData(newData);
      setSummary(newSummary);
    });
  };

  // Calculate totals
  const totalAssignments = data.reduce(
    (sum, fsr) => sum + fsr.totalAssignments,
    0,
  );
  const totalCompleted = data.reduce(
    (sum, fsr) => sum + fsr.completedAssignments,
    0,
  );
  const totalKm = data.reduce((sum, fsr) => sum + fsr.totalKmDriven, 0);
  const avgCompletionTime =
    data.length > 0
      ? data.reduce((sum, fsr) => sum + fsr.averageCompletionTime, 0) /
        data.length
      : 0;

  // Prepare chart data
  const chartData = data.map((fsr) => ({
    name: fsr.fsrName.split(" ")[0], // First name only for chart
    "Asignaciones Completadas": fsr.completedAssignments,
    "Ordenes Totales": fsr.totalAssignments,
    Viajes: fsr.totalTrips,
  }));

  const kmChartData = data.map((fsr) => ({
    name: fsr.fsrName.split(" ")[0],
    Kilometros: fsr.totalKmDriven,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Rendimiento de FSR
          </h1>
          <p className="text-muted-foreground mt-1">
            Analisis del desempeno de los Field Service Representatives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Rendimiento de FSR"
            reportId="fsr-performance"
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
          title="FSRs Activos"
          value={data.length}
          description="Con actividad en el periodo"
          icon={Users}
        />
        <StatCard
          title="Asignaciones Completadas"
          value={totalCompleted}
          description={`de ${totalAssignments} totales (${totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0}%)`}
        />
        <StatCard
          title="Tiempo Promedio"
          value={`${avgCompletionTime.toFixed(1)}h`}
          description="Para completar asignaciones"
        />
        <StatCard
          title="Total Kilometros"
          value={totalKm.toLocaleString()}
          description="Recorridos en el periodo"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Asignaciones por FSR"
          description="Comparativa de asignaciones asignadas vs completadas"
        >
          {data.length > 0 ? (
            <BarChart
              data={chartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Ordenes Totales",
                  name: "Ordenes Totales",
                  color: "#94A3B8",
                },
                {
                  dataKey: "Asignaciones Completadas",
                  name: "Asignaciones Completadas",
                  color: "#3B82F6",
                },
              ]}
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Kilometros por FSR"
          description="Total de kilometros recorridos por cada FSR"
        >
          {data.length > 0 ? (
            <BarChart
              data={kmChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Kilometros",
                  name: "Kilometros",
                  color: "#10B981",
                },
              ]}
              height={300}
              showLegend={false}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay datos disponibles
            </div>
          )}
        </ChartCard>
      </div>

      {/* Data Table */}
      <ChartCard
        title="Detalle por FSR"
        description="Metricas detalladas de cada FSR"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FSR</TableHead>
                <TableHead className="text-right">Ordenes</TableHead>
                <TableHead className="text-right">Completadas</TableHead>
                <TableHead className="text-right">% Completado</TableHead>
                <TableHead className="text-right">Tiempo Prom.</TableHead>
                <TableHead className="text-right">Actividades</TableHead>
                <TableHead className="text-right">Viajes</TableHead>
                <TableHead className="text-right">Km</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((fsr) => (
                <TableRow key={fsr.fsrId}>
                  <TableCell className="font-medium">{fsr.fsrName}</TableCell>
                  <TableCell className="text-right">
                    {fsr.totalAssignments}
                  </TableCell>
                  <TableCell className="text-right">
                    {fsr.completedAssignments}
                  </TableCell>
                  <TableCell className="text-right">
                    {fsr.totalAssignments > 0
                      ? Math.round(
                          (fsr.completedAssignments / fsr.totalAssignments) *
                            100,
                        )
                      : 0}
                    %
                  </TableCell>
                  <TableCell className="text-right">
                    {fsr.averageCompletionTime.toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-right">
                    {fsr.totalActivities}
                  </TableCell>
                  <TableCell className="text-right">{fsr.totalTrips}</TableCell>
                  <TableCell className="text-right">
                    {fsr.totalKmDriven.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay datos de FSR para el periodo seleccionado
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
