"use client";

import { DollarSign, Package, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import {
  BarChart,
  ChartCard,
  DateRangeFilter,
  PDFExportButton,
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
import type { PartUsageData } from "@/lib/actions/reports";
import { getPartsUsageData, getReportSummary } from "@/lib/actions/reports";

interface PartsUsageReportClientProps {
  initialData: PartUsageData[];
  initialSummary: Awaited<ReturnType<typeof getReportSummary>>;
}

export function PartsUsageReportClient({
  initialData,
  initialSummary,
}: PartsUsageReportClientProps) {
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
        getPartsUsageData({ startDate: newStartDate, endDate: newEndDate }),
        getReportSummary({ startDate: newStartDate, endDate: newEndDate }),
      ]);
      setData(newData);
      setSummary(newSummary);
    });
  };

  // Calculate totals
  const totalPartsUsed = data.reduce((sum, d) => sum + d.totalUsed, 0);
  const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);
  const avgCostPerPart = totalPartsUsed > 0 ? totalCost / totalPartsUsed : 0;
  const uniqueParts = data.length;

  // Prepare chart data (top 10 by usage)
  const usageChartData = data.slice(0, 10).map((d) => ({
    name:
      d.partName.length > 15 ? `${d.partName.substring(0, 15)}...` : d.partName,
    Cantidad: d.totalUsed,
  }));

  const costChartData = data.slice(0, 10).map((d) => ({
    name:
      d.partName.length > 15 ? `${d.partName.substring(0, 15)}...` : d.partName,
    Costo: d.totalCost,
  }));

  // Check for low stock parts
  const lowStockParts = data.filter((d) => d.currentStock < 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Uso de Partes</h1>
          <p className="text-muted-foreground mt-1">
            Consumo de inventario, costos y niveles de stock.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton reportTitle="Uso de Partes" reportId="parts-usage" />
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
          title="Total Partes Usadas"
          value={summary.totalPartsUsed}
          description="Unidades en el periodo"
          icon={Package}
        />
        <StatCard
          title="Costo Total"
          value={`$${totalCost.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`}
          description="Valor de partes consumidas"
          icon={DollarSign}
        />
        <StatCard
          title="Partes Diferentes"
          value={uniqueParts}
          description="Tipos de partes utilizadas"
          icon={TrendingUp}
        />
        <StatCard
          title="Costo Promedio"
          value={`$${avgCostPerPart.toFixed(2)}`}
          description="Por unidad utilizada"
        />
      </div>

      {/* Low Stock Alert */}
      {lowStockParts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
            Partes con Stock Bajo
          </h3>
          <div className="flex flex-wrap gap-2">
            {lowStockParts.map((part) => (
              <Badge
                key={part.partId}
                variant="outline"
                className="border-amber-500 text-amber-700 dark:text-amber-300"
              >
                {part.partName}: {part.currentStock} unidades
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Top 10 Partes por Uso"
          description="Partes mas utilizadas en el periodo"
        >
          {usageChartData.length > 0 ? (
            <BarChart
              data={usageChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Cantidad",
                  name: "Cantidad",
                  color: "#EC4899",
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

        <ChartCard
          title="Top 10 Partes por Costo"
          description="Partes con mayor costo total en el periodo"
        >
          {costChartData.length > 0 ? (
            <BarChart
              data={costChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Costo",
                  name: "Costo ($)",
                  color: "#06B6D4",
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
        title="Detalle de Partes"
        description="Uso completo de partes en el periodo"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parte</TableHead>
                <TableHead className="text-right">Usado</TableHead>
                <TableHead className="text-right">Costo Total</TableHead>
                <TableHead className="text-right">Stock Actual</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((part) => (
                <TableRow key={part.partId}>
                  <TableCell className="font-medium">{part.partName}</TableCell>
                  <TableCell className="text-right">{part.totalUsed}</TableCell>
                  <TableCell className="text-right">
                    $
                    {part.totalCost.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {part.currentStock}
                  </TableCell>
                  <TableCell>
                    {part.currentStock < 5 ? (
                      <Badge variant="destructive">Bajo</Badge>
                    ) : part.currentStock < 10 ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800"
                      >
                        Moderado
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800"
                      >
                        OK
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay datos de uso de partes para el periodo seleccionado
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
