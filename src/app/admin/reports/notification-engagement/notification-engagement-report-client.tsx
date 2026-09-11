"use client";

import { AlertTriangle, Bell, CheckCircle2, Mail } from "lucide-react";
import moment from "moment-timezone";
import { useState, useTransition } from "react";
import { EmptyState } from "@/components/common/empty-state";
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
  NotificationEngagementRow,
  NotificationEngagementSummary,
} from "@/lib/actions/reports";
import { getNotificationEngagementReport } from "@/lib/actions/reports";
import { APP_TZ } from "@/lib/utils/datetime";

moment.locale("es");

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
    moment().tz(APP_TZ).subtract(30, "days").format("YYYY-MM-DD"),
  );
  const [endDate, setEndDate] = useState(
    moment().tz(APP_TZ).format("YYYY-MM-DD"),
  );

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
    <PageContainer>
      <PageHeader
        title="Engagement de Notificaciones"
        description="Qué FSRs han abierto sus notificaciones de trabajo y cuáles tienen pendientes."
        actions={
          <PDFExportButton
            reportTitle="Engagement de Notificaciones"
            reportId="notification-engagement"
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

      <div className="border rounded-lg overflow-x-auto">
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
                    r.criticalUnreadCount > 0 ? "bg-warning-muted/60" : ""
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
                      r.unreadCount > 10 ? "text-danger-muted-foreground" : ""
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
                      <span
                        title={moment(r.lastReadAt).tz(APP_TZ).format("LLL")}
                      >
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
                        className={
                          r.oldestUnreadDays > 7
                            ? "text-danger-muted-foreground"
                            : ""
                        }
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
    </PageContainer>
  );
}
