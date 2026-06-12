"use client";

import { AlertCircle, Calendar, Clock, FileWarning } from "lucide-react";
import { useState, useTransition } from "react";
import {
  BarChart,
  ChartCard,
  PDFExportButton,
  PieChart,
  StatCard,
} from "@/components/reports";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AgingSummary, AssignmentAgingData } from "@/lib/actions/reports";
import { getAssignmentAgingData } from "@/lib/actions/reports";

interface AssignmentAgingClientProps {
  initialData: {
    assignments: AssignmentAgingData[];
    summary: AgingSummary;
  };
}

export function AssignmentAgingClient({
  initialData,
}: AssignmentAgingClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData.assignments);
  const [summary, setSummary] = useState(initialData.summary);

  const handleRefresh = () => {
    startTransition(async () => {
      const result = await getAssignmentAgingData();
      setData(result.assignments);
      setSummary(result.summary);
    });
  };

  // Prepare chart data
  const bucketDistribution = summary.byBucket.map((b) => ({
    name: b.bucket,
    value: b.count,
  }));

  const bucketBarData = summary.byBucket.map((b) => ({
    name: b.bucket,
    Cantidad: b.count,
    Porcentaje: b.percentage,
  }));

  const getBucketColor = (bucket: string) => {
    const colors: Record<string, string> = {
      "0-7 dias":
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      "8-14 dias":
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      "15-30 dias":
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
      "31-60 dias":
        "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      "60+ dias":
        "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-300",
    };
    return colors[bucket] || "bg-gray-100 text-gray-800";
  };

  const getAgeColor = (days: number) => {
    if (days <= 7) return "text-green-600";
    if (days <= 14) return "text-yellow-600";
    if (days <= 30) return "text-orange-600";
    return "text-red-600";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-MX", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Mexico_City",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Antiguedad de Ordenes
          </h1>
          <p className="text-muted-foreground mt-1">
            Asignaciones abiertas clasificadas por tiempo sin resolver.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isPending}
          >
            <Clock className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          <PDFExportButton
            reportTitle="Antiguedad de Ordenes"
            reportId="work-order-aging"
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
          title="Ordenes Abiertas"
          value={summary.total}
          description="Pendientes de resolver"
          icon={FileWarning}
        />
        <StatCard
          title="Promedio de Antiguedad"
          value={`${summary.avgAge.toFixed(1)} dias`}
          description="Tiempo promedio abierta"
          icon={Calendar}
        />
        <StatCard
          title="Orden Mas Antigua"
          value={`${summary.oldestAssignment} dias`}
          description="Tiempo maximo sin resolver"
          icon={AlertCircle}
        />
        <StatCard
          title="Criticas (60+ dias)"
          value={
            summary.byBucket.find((b) => b.bucket === "60+ dias")?.count || 0
          }
          description="Requieren atencion urgente"
          icon={Clock}
        />
      </div>

      {/* Warning Banner for old asignacións */}
      {summary.byBucket.find((b) => b.bucket === "60+ dias" && b.count > 0) && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">
                Ordenes Criticas Detectadas
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Hay{" "}
                {summary.byBucket.find((b) => b.bucket === "60+ dias")?.count}{" "}
                asignaciones con mas de 60 dias sin resolver. Estas requieren
                atencion urgente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Distribucion por Antiguedad"
          description="Ordenes agrupadas por rango de dias"
        >
          {bucketDistribution.length > 0 ? (
            <PieChart
              data={bucketDistribution}
              nameKey="name"
              valueKey="value"
              height={300}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay asignaciones abiertas
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Ordenes por Rango de Dias"
          description="Cantidad de asignaciones en cada rango de antiguedad"
        >
          {bucketBarData.length > 0 ? (
            <BarChart
              data={bucketBarData}
              xAxisKey="name"
              bars={[
                { dataKey: "Cantidad", name: "Cantidad", color: "#3B82F6" },
              ]}
              height={300}
              showLegend={false}
            />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No hay asignaciones abiertas
            </div>
          )}
        </ChartCard>
      </div>

      {/* Bucket Summary */}
      <ChartCard
        title="Resumen por Rango"
        description="Desglose de asignaciones por tiempo de antiguedad"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {summary.byBucket.map((bucket) => (
            <div
              key={bucket.bucket}
              className="text-center p-4 rounded-lg border bg-card"
            >
              <Badge className={getBucketColor(bucket.bucket)}>
                {bucket.bucket}
              </Badge>
              <div className="mt-2 text-3xl font-bold">{bucket.count}</div>
              <div className="text-sm text-muted-foreground">
                {bucket.percentage.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </ChartCard>

      {/* Detailed Data Table */}
      <ChartCard
        title="Detalle de Ordenes Abiertas"
        description="Todas las asignaciones pendientes ordenadas por antiguedad"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Folio</TableHead>
                <TableHead>Incidente</TableHead>
                <TableHead>Asignado a</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Creada</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead>Rango</TableHead>
                <TableHead>Ultima Actividad</TableHead>
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
                  <TableCell>{wo.assignedTo}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{wo.status}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(wo.createdAt)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${getAgeColor(wo.ageInDays)}`}
                  >
                    {wo.ageInDays}
                  </TableCell>
                  <TableCell>
                    <Badge className={getBucketColor(wo.ageBucket)}>
                      {wo.ageBucket}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {wo.lastActivity
                      ? formatDate(wo.lastActivity)
                      : "Sin actividad"}
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No hay asignaciones abiertas
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
