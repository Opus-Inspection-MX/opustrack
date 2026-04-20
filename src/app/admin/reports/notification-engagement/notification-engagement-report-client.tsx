"use client";

import { AlertTriangle, Bell, CheckCircle2, Mail } from "lucide-react";
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
  NotificationEngagementRow,
  NotificationEngagementSummary,
} from "@/lib/actions/reports";
import { getNotificationEngagementReport } from "@/lib/actions/reports";

moment.locale("es");

const TZ = "America/Mexico_City";

interface Props {
  initialRows: NotificationEngagementRow[];
  initialSummary: NotificationEngagementSummary;
}

export function NotificationEngagementReportClient({
  initialRows,
  initialSummary,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [summary, setSummary] = useState(initialSummary);

  const [startDate, setStartDate] = useState(
    moment().tz(TZ).subtract(30, "days").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(moment().tz(TZ).format("YYYY-MM-DD"));

  const handleDateChange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    startTransition(async () => {
      const next = await getNotificationEngagementReport({
        startDate: s,
        endDate: e,
      });
      setRows(next.rows);
      setSummary(next.summary);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Engagement de Notificaciones
          </h1>
          <p className="text-muted-foreground mt-1">
            Qué FSRs han abierto sus notificaciones de trabajo y cuáles tienen
            pendientes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
          <PDFExportButton
            reportTitle="Engagement de Notificaciones"
            reportId="notification-engagement"
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
          title="Notificaciones enviadas"
          value={summary.totalNotifications}
          description="En el periodo"
          icon={Mail}
        />
        <StatCard
          title="Tasa de lectura"
          value={`${summary.overallReadRatePct}%`}
          description={`${summary.totalRead} leídas de ${summary.totalNotifications}`}
          icon={CheckCircle2}
        />
        <StatCard
          title="FSRs con pendientes"
          value={summary.fsrsWithUnread}
          description="No han abierto todas sus notificaciones"
          icon={Bell}
        />
        <StatCard
          title="FSRs con críticas"
          value={summary.fsrsWithCriticalUnread}
          description="Prioridad alta sin leer"
          icon={AlertTriangle}
        />
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>FSR</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Leídas</TableHead>
              <TableHead className="text-right">Sin leer</TableHead>
              <TableHead className="text-right">% Leídas</TableHead>
              <TableHead className="text-right">Críticas sin leer</TableHead>
              <TableHead>Última lectura</TableHead>
              <TableHead className="text-right">Días más antigua</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-8 text-muted-foreground"
                >
                  No hay datos para el periodo seleccionado
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.userId}
                  className={
                    r.criticalUnreadCount > 0
                      ? "bg-amber-50/60 dark:bg-amber-950/20"
                      : ""
                  }
                >
                  <TableCell className="font-medium">
                    <div>{r.userName}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.userEmail}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.totalNotifications}
                  </TableCell>
                  <TableCell className="text-right">{r.readCount}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      r.unreadCount > 10 ? "text-red-600" : ""
                    }`}
                  >
                    {r.unreadCount}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.readRatePct === null ? "—" : `${r.readRatePct}%`}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.criticalUnreadCount > 0 ? (
                      <Badge variant="destructive">
                        {r.criticalUnreadCount}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.lastReadAt ? (
                      <span title={moment(r.lastReadAt).tz(TZ).format("LLL")}>
                        {moment(r.lastReadAt).fromNow()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Nunca</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.oldestUnreadDays === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={r.oldestUnreadDays > 7 ? "text-red-600" : ""}
                      >
                        {r.oldestUnreadDays} d
                      </span>
                    )}
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
