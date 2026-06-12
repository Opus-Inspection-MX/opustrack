"use client";

import { AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import {
  AreaChart,
  ChartCard,
  DateRangeFilter,
  PDFExportButton,
  PieChart,
  StatCard,
} from "@/components/reports";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  IncidentByTypeData,
  IncidentTrendData,
} from "@/lib/actions/reports";
import {
  getIncidentsByTypeData,
  getIncidentTrendData,
  getReportSummary,
} from "@/lib/actions/reports";

interface IncidentsReportClientProps {
  initialTrendData: IncidentTrendData[];
  initialTypeData: IncidentByTypeData[];
  initialSummary: Awaited<ReturnType<typeof getReportSummary>>;
  incidentTypes: Array<{ id: number; name: string }>;
}

export function IncidentsReportClient({
  initialTrendData,
  initialTypeData,
  initialSummary,
  incidentTypes,
}: IncidentsReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [trendData, setTrendData] = useState(initialTrendData);
  const [typeData, setTypeData] = useState(initialTypeData);
  const [summary, setSummary] = useState(initialSummary);

  // Date range state — initialized to CDMX today / 30 days ago (avoids UTC
  // date drift for users viewing reports between 18:00 and 23:59 CDMX)
  const mxDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Mexico_City",
    }).format(d);
  };

  const [startDate, setStartDate] = useState(() => mxDate(30));
  const [endDate, setEndDate] = useState(() => mxDate(0));
  const [selectedTypeIds, setSelectedTypeIds] = useState<string[]>([]);

  const refetch = (
    newStartDate: string,
    newEndDate: string,
    typeIdStrings: string[],
  ) => {
    const typeIds = typeIdStrings.map((id) => Number.parseInt(id, 10));
    startTransition(async () => {
      const range = { startDate: newStartDate, endDate: newEndDate };
      const [newTrendData, newTypeData, newSummary] = await Promise.all([
        getIncidentTrendData(range, typeIds),
        getIncidentsByTypeData(range, typeIds),
        getReportSummary(range),
      ]);
      setTrendData(newTrendData);
      setTypeData(newTypeData);
      setSummary(newSummary);
    });
  };

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);
    refetch(newStartDate, newEndDate, selectedTypeIds);
  };

  const handleTypeChange = (typeIdStrings: string[]) => {
    setSelectedTypeIds(typeIdStrings);
    refetch(startDate, endDate, typeIdStrings);
  };

  // Calculate totals
  const totalIncidents = trendData.reduce((sum, d) => sum + d.count, 0);
  const totalResolved = trendData.reduce((sum, d) => sum + d.resolved, 0);
  const resolutionRate =
    totalIncidents > 0 ? Math.round((totalResolved / totalIncidents) * 100) : 0;

  // Calculate daily average
  const daysInRange = trendData.length || 1;
  const dailyAverage = (totalIncidents / daysInRange).toFixed(1);

  // Prepare chart data for trend
  const formattedTrendData = trendData.map((d) => ({
    fecha: d.date.substring(5), // MM-DD format
    Reportados: d.count,
    Resueltos: d.resolved,
  }));

  // Prepare chart data for types
  const typeChartData = typeData.map((d) => ({
    name: d.type,
    value: d.count,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Analisis de Incidentes
          </h1>
          <p className="text-muted-foreground mt-1">
            Tendencias, tipos y metricas de resolucion de incidentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-56">
            <MultiSelect
              options={incidentTypes.map((t) => ({
                value: t.id.toString(),
                label: t.name,
              }))}
              value={selectedTypeIds}
              onValueChange={handleTypeChange}
              placeholder="Todos los tipos"
              searchPlaceholder="Buscar tipo..."
              emptyMessage="No se encontraron tipos."
            />
          </div>
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Analisis de Incidentes"
            reportId="incidents"
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
          title="Total Incidentes"
          value={summary.totalIncidents}
          description="En el periodo seleccionado"
          icon={AlertTriangle}
        />
        <StatCard
          title="Resueltos"
          value={summary.resolvedIncidents}
          description={`${summary.incidentResolutionRate}% del total`}
          icon={CheckCircle}
        />
        <StatCard
          title="Promedio Diario"
          value={dailyAverage}
          description="Incidentes reportados"
          icon={TrendingUp}
        />
        <StatCard
          title="Tasa de Resolucion"
          value={`${resolutionRate}%`}
          description="Incidentes cerrados vs reportados"
        />
      </div>

      {/* Trend Chart */}
      <ChartCard
        title="Tendencia de Incidentes"
        description="Incidentes reportados y resueltos por dia"
      >
        {formattedTrendData.length > 0 ? (
          <AreaChart
            data={formattedTrendData}
            xAxisKey="fecha"
            areas={[
              {
                dataKey: "Reportados",
                name: "Reportados",
                color: "#F59E0B",
                fillOpacity: 0.4,
              },
              {
                dataKey: "Resueltos",
                name: "Resueltos",
                color: "#10B981",
                fillOpacity: 0.4,
              },
            ]}
            height={350}
          />
        ) : (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No hay datos disponibles para el rango seleccionado
          </div>
        )}
      </ChartCard>

      {/* Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Distribucion por Tipo"
          description="Proporcion de incidentes segun su tipo"
        >
          {typeChartData.length > 0 ? (
            <PieChart
              data={typeChartData}
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
          title="Detalle por Tipo"
          description="Conteo y porcentaje de cada tipo de incidente"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Porcentaje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeData.map((row) => (
                  <TableRow key={row.type}>
                    <TableCell className="font-medium">{row.type}</TableCell>
                    <TableCell>
                      <PriorityBadge priority={row.priority} />
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                    <TableCell className="text-right">
                      {row.percentage}%
                    </TableCell>
                  </TableRow>
                ))}
                {typeData.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
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
    </div>
  );
}
