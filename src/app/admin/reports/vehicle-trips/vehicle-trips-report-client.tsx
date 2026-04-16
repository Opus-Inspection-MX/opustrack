"use client";

import { Car, MapPin, TrendingUp } from "lucide-react";
import { useState, useTransition } from "react";
import {
  BarChart,
  ChartCard,
  DateRangeFilter,
  LineChart,
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
import type { FSRTripData, VehicleTripData } from "@/lib/actions/reports";
import {
  getReportSummary,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "@/lib/actions/reports";

interface VehicleTripsReportClientProps {
  initialTrendData: VehicleTripData[];
  initialFsrData: FSRTripData[];
  initialSummary: Awaited<ReturnType<typeof getReportSummary>>;
}

export function VehicleTripsReportClient({
  initialTrendData,
  initialFsrData,
  initialSummary,
}: VehicleTripsReportClientProps) {
  const [isPending, startTransition] = useTransition();
  const [trendData, setTrendData] = useState(initialTrendData);
  const [fsrData, setFsrData] = useState(initialFsrData);
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
      const [newTrendData, newFsrData, newSummary] = await Promise.all([
        getVehicleTripTrendData({
          startDate: newStartDate,
          endDate: newEndDate,
        }),
        getVehicleTripsByFSRData({
          startDate: newStartDate,
          endDate: newEndDate,
        }),
        getReportSummary({ startDate: newStartDate, endDate: newEndDate }),
      ]);
      setTrendData(newTrendData);
      setFsrData(newFsrData);
      setSummary(newSummary);
    });
  };

  // Calculate totals
  const totalTrips = trendData.reduce((sum, d) => sum + d.trips, 0);
  const totalKm = trendData.reduce((sum, d) => sum + d.totalKm, 0);
  const avgKmPerTrip = totalTrips > 0 ? Math.round(totalKm / totalTrips) : 0;
  const avgTripsPerDay =
    trendData.length > 0 ? (totalTrips / trendData.length).toFixed(1) : 0;

  // Prepare chart data for trend
  const formattedTrendData = trendData.map((d) => ({
    fecha: d.date.substring(5), // MM-DD format
    Viajes: d.trips,
    "Km Totales": d.totalKm,
  }));

  // Prepare chart data for FSR comparison
  const fsrChartData = fsrData.map((d) => ({
    name: d.fsrName.split(" ")[0], // First name only
    Viajes: d.trips,
    Kilometros: d.totalKm,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Viajes de Vehiculos
          </h1>
          <p className="text-muted-foreground mt-1">
            Seguimiento de viajes, kilometraje y utilizacion de la flota.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Viajes de Vehiculos"
            reportId="vehicle-trips"
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
          title="Total Viajes"
          value={summary.totalTrips}
          description="En el periodo seleccionado"
          icon={Car}
        />
        <StatCard
          title="Total Kilometros"
          value={summary.totalKmDriven.toLocaleString()}
          description="Recorridos en total"
          icon={MapPin}
        />
        <StatCard
          title="Promedio por Viaje"
          value={`${avgKmPerTrip} km`}
          description="Kilometros por viaje"
          icon={TrendingUp}
        />
        <StatCard
          title="Viajes por Dia"
          value={avgTripsPerDay}
          description="Promedio diario"
        />
      </div>

      {/* Trend Chart */}
      <ChartCard
        title="Tendencia de Viajes"
        description="Viajes realizados por dia"
      >
        {formattedTrendData.length > 0 ? (
          <LineChart
            data={formattedTrendData}
            xAxisKey="fecha"
            lines={[
              {
                dataKey: "Viajes",
                name: "Viajes",
                color: "#8B5CF6",
              },
            ]}
            height={300}
          />
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No hay datos disponibles para el rango seleccionado
          </div>
        )}
      </ChartCard>

      {/* FSR Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Viajes por FSR"
          description="Comparativa de viajes realizados por cada FSR"
        >
          {fsrChartData.length > 0 ? (
            <BarChart
              data={fsrChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Viajes",
                  name: "Viajes",
                  color: "#8B5CF6",
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
          title="Kilometros por FSR"
          description="Total de kilometros recorridos por cada FSR"
        >
          {fsrChartData.length > 0 ? (
            <BarChart
              data={fsrChartData}
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
        description="Metricas detalladas de viajes por cada FSR"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>FSR</TableHead>
                <TableHead className="text-right">Viajes</TableHead>
                <TableHead className="text-right">Km Totales</TableHead>
                <TableHead className="text-right">Km Promedio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fsrData.map((fsr) => (
                <TableRow key={fsr.fsrId}>
                  <TableCell className="font-medium">{fsr.fsrName}</TableCell>
                  <TableCell className="text-right">{fsr.trips}</TableCell>
                  <TableCell className="text-right">
                    {fsr.totalKm.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">{fsr.averageKm}</TableCell>
                </TableRow>
              ))}
              {fsrData.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay datos de viajes para el periodo seleccionado
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
