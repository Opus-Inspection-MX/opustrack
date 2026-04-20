"use client";

import { AlertTriangle, Car, CheckCircle2, Users } from "lucide-react";
import moment from "moment-timezone";
import { useState, useTransition } from "react";
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

moment.locale("es");

const TZ = "America/Mexico_City";

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
    moment().tz(TZ).subtract(6, "days").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(moment().tz(TZ).format("YYYY-MM-DD"));

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

  const today = moment().tz(TZ).format("YYYY-MM-DD");
  const missedToday = rows.filter((r) => !r.reportedToday);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Cumplimiento Diario de Viajes
          </h1>
          <p className="text-muted-foreground mt-1">
            Qué FSRs han reportado su viaje diario y cuáles no.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Cumplimiento Diario de Viajes"
            reportId="daily-trip-compliance"
          />
        </div>
      </div>

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
        <div className="border rounded-lg p-4 bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
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
                    {moment.tz(d, TZ).format("ddd")}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {moment.tz(d, TZ).format("DD/MM")}
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
                            className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            title={`${cell.tripCount} viaje${
                              cell.tripCount === 1 ? "" : "s"
                            } · ${cell.kmDriven} km`}
                          >
                            {cell.tripCount}
                          </Badge>
                        ) : (
                          <span className="text-red-500">—</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell
                    className={`text-right font-semibold ${
                      r.complianceRatePct === 100
                        ? "text-emerald-600"
                        : r.complianceRatePct < 50
                          ? "text-red-600"
                          : "text-amber-600"
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
    </div>
  );
}
