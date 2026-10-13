import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { SectionCard } from "@/components/common/section-card";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { VacationPlanner } from "@/components/vacations/vacation-planner";
import { VacationRequestActions } from "@/components/vacations/vacation-request-actions";
import type { CalendarVacation } from "@/components/vacations/vacation-year-calendar";
import { isFailure } from "@/lib/actions/result";
import {
  getMyVacations,
  getVacationBalanceData,
} from "@/lib/actions/vacations";
import { canPerform, requireRouteAccess } from "@/lib/auth/auth";
import {
  codeOf,
  isVacationApproved,
  isVacationPending,
  VACATION_STATUS,
} from "@/lib/constants/status-codes";
import { formatMX, mxDateString } from "@/lib/utils/datetime";

const STATUS_TONE: Record<string, StatusTone> = {
  PENDIENTE: "warning",
  APROBADA: "success",
  RECHAZADA: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
};

export default async function MyVacationsPage() {
  await requireRouteAccess("/vacations");
  const [vacations, balance, canUpdate, canDelete, canManage] =
    await Promise.all([
      getMyVacations(),
      getVacationBalanceData(),
      canPerform("vacations:update"),
      canPerform("vacations:delete"),
      canPerform("vacations:manage"),
    ]);
  const today = mxDateString(new Date());
  const requestActions = (vacation: (typeof vacations)[number]) => (
    <VacationRequestActions
      vacationId={vacation.id}
      active={vacation.active}
      statusCode={codeOf(vacation.status) ?? ""}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canManage={canManage}
      startedApproved={
        isVacationApproved(vacation.status) &&
        mxDateString(vacation.startDate) <= today
      }
    />
  );

  const pending = vacations.filter((v) => isVacationPending(v.status)).length;
  const approved = vacations.filter((v) => isVacationApproved(v.status)).length;
  const rejected = vacations.filter(
    (v) => codeOf(v.status) === VACATION_STATUS.RECHAZADA,
  ).length;

  return (
    <PageContainer>
      <PageHeader
        title="Mis Vacaciones"
        description="Consulte sus días disponibles y aparte su período vacacional"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/vacations/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Solicitar Vacaciones
            </Link>
          </Button>
        }
      />

      {/* Balance + year calendar */}
      {!isFailure(balance) && (
        <VacationPlanner
          initialData={{
            user: { id: balance.user.id, name: balance.user.name },
            hasHireDate: balance.hasHireDate,
            periods: balance.periods,
            vacations: balance.vacations as CalendarVacation[],
            holidayDates: balance.holidayDates,
            year: balance.year,
          }}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Pendientes" value={pending} tone="warning" />
        <StatCard title="Aprobadas" value={approved} tone="success" />
        <StatCard title="Rechazadas" value={rejected} tone="danger" />
      </div>

      {/* Table */}
      <SectionCard title={`Historial de Solicitudes (${vacations.length})`}>
        {vacations.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Sin solicitudes"
            description="No tiene solicitudes de vacaciones registradas."
            action={{
              label: "Crear primera solicitud",
              href: "/vacations/new",
            }}
          />
        ) : (
          <ResponsiveTable
            data={vacations}
            rowKey={(vacation) => vacation.id}
            columns={[
              { header: "Acciones", cell: requestActions },
              {
                header: "Inicio",
                cell: (vacation) =>
                  formatMX(vacation.startDate, { dateStyle: "short" }),
              },
              {
                header: "Fin",
                cell: (vacation) =>
                  formatMX(vacation.endDate, { dateStyle: "short" }),
              },
              {
                header: "Motivo",
                cell: (vacation) => (
                  <span className="max-w-xs truncate text-sm text-muted-foreground block">
                    {vacation.reason ?? "—"}
                  </span>
                ),
              },
              {
                header: "Estado",
                cell: (vacation) => (
                  <StatusBadge
                    tone={
                      STATUS_TONE[codeOf(vacation.status) ?? ""] ?? "neutral"
                    }
                  >
                    {STATUS_LABEL[codeOf(vacation.status) ?? ""] ??
                      vacation.status.name}
                  </StatusBadge>
                ),
              },
              {
                header: "Aprobado por",
                cell: (vacation) => (
                  <span className="text-sm text-muted-foreground">
                    {vacation.approvedBy?.name ?? "—"}
                  </span>
                ),
              },
            ]}
            mobileCard={(vacation) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    tone={
                      STATUS_TONE[codeOf(vacation.status) ?? ""] ?? "neutral"
                    }
                  >
                    {STATUS_LABEL[codeOf(vacation.status) ?? ""] ??
                      vacation.status.name}
                  </StatusBadge>
                </div>
                <p className="text-sm">
                  {formatMX(vacation.startDate, { dateStyle: "short" })} →{" "}
                  {formatMX(vacation.endDate, { dateStyle: "short" })}
                </p>
                {vacation.reason && (
                  <p className="text-xs text-muted-foreground">
                    {vacation.reason}
                  </p>
                )}
                {requestActions(vacation)}
              </div>
            )}
            emptyTitle="Sin solicitudes"
            emptyMessage="No tiene solicitudes de vacaciones registradas."
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
