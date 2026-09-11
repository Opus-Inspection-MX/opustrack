"use client";

import { AlertTriangle, Car, CheckCircle2, Users } from "lucide-react";
import moment from "moment-timezone";
import { useState, useTransition } from "react";
import { FilterBar } from "@/components/common/filter-bar";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import {
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
import type {
  DailyTripComplianceRow,
  DailyTripComplianceSummary,
} from "@/lib/actions/reports";
import { getDailyTripComplianceReport } from "@/lib/actions/reports";
import { APP_TZ } from "@/lib/utils/datetime";

moment.locale("es");

interface Props {
  initialDays: string[];
  initialRows: DailyTripComplianceRow[];
  initialSummary: DailyTripComplianceSummary;
}

export function DailyTripComplianceReportClient({
  initialDays,
  initialRows,
  initialSummary,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [days, setDays] = useState(initialDays);
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);

  const [startDate, setStartDate] = useState(
    moment().tz(APP_TZ).subtract(6, "days").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(
    moment().tz(APP_TZ).format("YYYY-MM-DD"),
  );

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    startTransition(async () => {
      const next = await getDailyTripComplianceReport({
        startDate: s,
        endDate: e,
      });
      setDays(next.days);
      setRows(next.rows);
      setSummary(next.summary);
    });
  };

  const today = moment().tz(APP_TZ).format("YYYY-MM-DD");
  const missedToday = rows.filter((r) => !r.reportedToday);

  return (
    <PageContainer>
      <PageHeader
        title="Cumplimiento Diario de Viajes"
        description="Qué FSRs han reportado su viaje diario y cuáles no."
        actions={
          <PDFExportButton
            reportTitle="Cumplimiento Diario de Viajes"
            reportId="daily-trip-compliance"
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total FSRs"
          value={summary.totalFsrs}
          description="Activos"
          icon={Users}
        />
        <StatCard
          title="Cumplimiento 100%"
          value={summary.fullyCompliant}
          description="FSRs con todos los días"
          icon={CheckCircle2}
        />
        <StatCard
          title="Sin reporte hoy"
          value={summary.missedToday}
          description="No han registrado viaje hoy"
          icon={AlertTriangle}
        />
        <StatCard
          title="Promedio cumplimiento"
          value={`${summary.averageComplianceRate}%`}
          description="Porcentaje general"
          icon={Car}
        />
      </div>

      {days.includes(today) && (
        <div className="border border-warning/40 rounded-lg p-4 bg-warning-muted/60">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle
              className="h-5 w-5 text-warning-muted-foreground"
              aria-hidden
            />
            <h2 className="font-semibold">FSRs sin reporte hoy ({today})</h2>
          </div>
          {missedToday.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todos los FSRs reportaron su viaje hoy.
            </p>
          ) : (
            <ul className="text-sm space-y-1">
              {missedToday.map((r) => (
                <li key={r.userId} className="flex justify-between">
                  <span>{r.userName}</span>
                  <span className="text-muted-foreground">
                    {r.lastTripAt
                      ? `Último viaje ${moment(r.lastTripAt).fromNow()}`
                      : "Sin viajes registrados"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-background z-10">
                FSR
              </TableHead>
              {days.map((d) => (
                <TableHead key={d} className="text-center whitespace-nowrap">
                  <div className="text-xs">
                    {moment.tz(d, APP_TZ).format("ddd")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {moment.tz(d, APP_TZ).format("DD/MM")}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">Cumplimiento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={days.length + 2}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay FSRs activos
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.userId}>
                  <TableCell className="font-medium sticky left-0 bg-background z-10">
                    <div>{r.userName}</div>
                    {r.lastTripAt && (
                      <div className="text-xs text-muted-foreground">
                        Último: {moment(r.lastTripAt).fromNow()}
                      </div>
                    )}
                  </TableCell>
                  {days.map((d) => {
                    const cell = r.byDay[d];
                    return (
                      <TableCell key={d} className="text-center">
                        {cell?.reported ? (
                          <Badge
                            variant="outline"
                            className="bg-success-muted text-success-muted-foreground border-success/40"
                            title={`${cell.tripCount} viaje${
                              cell.tripCount === 1 ? "" : "s"
                            } · ${cell.kmDriven} km`}
                          >
                            {cell.tripCount}
                          </Badge>
                        ) : (
                          <span className="text-danger-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={`text-right font-semibold ${
                      r.complianceRatePct === 100
                        ? "text-success-muted-foreground"
                        : r.complianceRatePct < 50
                          ? "text-danger-muted-foreground"
                          : "text-warning-muted-foreground"
                    }`}
                  >
                    {r.complianceRatePct}%
                    <div className="text-xs text-muted-foreground font-normal">
                      {r.daysReported}/{r.totalDays}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
