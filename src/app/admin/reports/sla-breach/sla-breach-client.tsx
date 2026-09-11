"use client";

import { AlertTriangle, CheckCircle2, Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/common/empty-state";
import { FilterBar } from "@/components/common/filter-bar";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SlaBadge } from "@/components/common/sla-badge";
import { PriorityBadge } from "@/components/incident-types/priority-badge";
import {
  BarChart,
  ChartCard,
  DateRangeFilter,
  PDFExportButton,
  PieChart,
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
import type { SlaBreachRow } from "@/lib/actions/reports";
import { getSlaBreachData } from "@/lib/actions/reports";
import { mxDaysAgoString } from "@/lib/utils/datetime";

interface SlaBreachClientProps {
  initialData: SlaBreachRow[];
}

export function SlaBreachClient({ initialData }: SlaBreachClientProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState(initialData);

  // Date range state — CDMX today / N days ago (avoids UTC date drift)
  const [startDate, setStartDate] = useState(() => mxDaysAgoString(30));
  const [endDate, setEndDate] = useState(() => mxDaysAgoString(0));

  const handleDateChange = (newStartDate: string, newEndDate: string) => {
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    startTransition(async () => {
      const result = await getSlaBreachData({
        startDate: newStartDate,
        endDate: newEndDate,
      });
      setData(result);
    });
  };

  const totals = data.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      breached: acc.breached + row.breached,
      atRisk: acc.atRisk + row.atRisk,
      onTrack: acc.onTrack + row.onTrack,
    }),
    { total: 0, breached: 0, atRisk: 0, onTrack: 0 },
  );

  const stateDistribution = [
    { name: "Vencidos", value: totals.breached },
    { name: "En riesgo", value: totals.atRisk },
    { name: "En tiempo", value: totals.onTrack },
  ].filter((d) => d.value > 0);

  const typeChartData = data.map((row) => ({
    name: row.type,
    Vencidos: row.breached,
    "En riesgo": row.atRisk,
    "En tiempo": row.onTrack,
  }));

  return (
    <PageContainer>
      <PageHeader
        title="Incumplimiento SLA"
        description="Incidentes vencidos, en riesgo y en tiempo por tipo, según los objetivos SLA de su prioridad."
        actions={
          <PDFExportButton
            reportTitle="Incumplimiento SLA"
            reportId="sla-breach"
          />
        }
      />

      <FilterBar>
        <DateRangeFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={handleDateChange}
        />
      </FilterBar>

      {isPending && (
        <div className="text-center py-4 text-muted-foreground">
          Cargando datos...
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Incidentes"
          value={totals.total}
          description="No cancelados en el rango"
          icon={ShieldAlert}
        />
        <StatCard
          title="SLA vencidos"
          value={totals.breached}
          description="Requieren atención inmediata"
          icon={AlertTriangle}
        />
        <StatCard
          title="En riesgo"
          value={totals.atRisk}
          description="≥80% del objetivo consumido"
          icon={Clock}
        />
        <StatCard
          title="En tiempo"
          value={totals.onTrack}
          description="Dentro del objetivo"
          icon={CheckCircle2}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Estado SLA"
          description="Distribución de incidentes por estado de cumplimiento"
        >
          {stateDistribution.length > 0 ? (
            <PieChart
              data={stateDistribution}
              nameKey="name"
              valueKey="value"
              height={300}
            />
          ) : (
            <EmptyState
              title="Sin datos"
              description="No hay datos disponibles"
            />
          )}
        </ChartCard>

        <ChartCard
          title="Vencidos por tipo"
          description="Incidentes con SLA vencido por tipo"
        >
          {typeChartData.length > 0 ? (
            <BarChart
              data={typeChartData}
              xAxisKey="name"
              bars={[
                {
                  dataKey: "Vencidos",
                  name: "Vencidos",
                  color: "var(--sla-breach)",
                },
                {
                  dataKey: "En riesgo",
                  name: "En riesgo",
                  color: "var(--sla-risk)",
                },
                {
                  dataKey: "En tiempo",
                  name: "En tiempo",
                  color: "var(--sla-ok)",
                },
              ]}
              height={300}
            />
          ) : (
            <EmptyState
              title="Sin datos"
              description="No hay datos disponibles"
            />
          )}
        </ChartCard>
      </div>

      {/* Detail table */}
      <ChartCard
        title="Detalle por tipo"
        description="Concilian con las insignias de seguimiento para el mismo rango"
      >
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Prioridad</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Vencidos</TableHead>
                <TableHead className="text-right">En riesgo</TableHead>
                <TableHead className="text-right">En tiempo</TableHead>
                <TableHead className="text-right">% vencidos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.type}>
                  <TableCell className="font-medium">{row.type}</TableCell>
                  <TableCell>
                    <PriorityBadge priority={row.priority} />
                  </TableCell>
                  <TableCell className="text-right">{row.total}</TableCell>
                  <TableCell className="text-right">
                    {row.breached > 0 ? (
                      <SlaBadge tone="breach">{row.breached}</SlaBadge>
                    ) : (
                      row.breached
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.atRisk > 0 ? (
                      <SlaBadge tone="risk">{row.atRisk}</SlaBadge>
                    ) : (
                      row.atRisk
                    )}
                  </TableCell>
                  <TableCell className="text-right">{row.onTrack}</TableCell>
                  <TableCell className="text-right">
                    {row.breachedPct}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Sin incidentes"
            description="No hay incidentes en el rango seleccionado"
          />
        )}
      </ChartCard>

      {/* Drill-down inputs: RF-509 aging + RF-510 seen-time stay untouched */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="text-muted-foreground">Ver detalle en:</span>
        <Link
          href="/admin/reports/assignment-aging"
          className="text-primary hover:underline"
        >
          Antigüedad de asignaciones (RF-509)
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link
          href="/admin/reports/seen-time"
          className="text-primary hover:underline"
        >
          Tiempo hasta Visto (RF-510)
        </Link>
      </div>
    </PageContainer>
  );
}
