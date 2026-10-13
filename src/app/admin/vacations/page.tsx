import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { VacationApprovalButtons } from "@/components/vacations/vacation-approval-buttons";
import { VacationPlanner } from "@/components/vacations/vacation-planner";
import { VacationRequestActions } from "@/components/vacations/vacation-request-actions";
import type { CalendarVacation } from "@/components/vacations/vacation-year-calendar";
import { isFailure } from "@/lib/actions/result";
import {
  getEmployeesForVacations,
  getVacationBalanceData,
  getVacations,
} from "@/lib/actions/vacations";
import { canPerform, requireRouteAccess } from "@/lib/auth/auth";
import {
  codeOf,
  isVacationApproved,
  isVacationPending,
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

export default async function AdminVacationsPage() {
  await requireRouteAccess("/admin/vacations");
  const [
    vacationPage,
    employees,
    canManage,
    canCaptureHireDate,
    canUpdate,
    canDelete,
    canApprove,
  ] = await Promise.all([
    getVacations(),
    getEmployeesForVacations(),
    canPerform("vacations:manage"),
    canPerform("users:manage-employment"),
    canPerform("vacations:update"),
    canPerform("vacations:delete"),
    canPerform("vacations:approve"),
  ]);
  const vacations = vacationPage.data;
  const fsrs = employees;
  const today = mxDateString(new Date());
  const requestActions = (vacation: (typeof vacations)[number]) => {
    const started =
      isVacationApproved(vacation.status) &&
      mxDateString(vacation.startDate) <= today;
    return (
      <div className="flex flex-wrap gap-2">
        <VacationRequestActions
          vacationId={vacation.id}
          active={vacation.active}
          statusCode={codeOf(vacation.status) ?? ""}
          canUpdate={canUpdate}
          canDelete={canDelete}
          canManage={canManage}
          startedApproved={started}
        />
        {((isVacationPending(vacation.status) && canApprove) ||
          (started && canManage)) && (
          <VacationApprovalButtons
            vacationId={vacation.id}
            statusName={codeOf(vacation.status) ?? ""}
          />
        )}
      </div>
    );
  };

  // Default the balance panel to the first employee; the picker switches from there.
  const balance =
    fsrs.length > 0 ? await getVacationBalanceData(fsrs[0].id) : null;

  return (
    <PageContainer>
      <PageHeader
        title="Solicitudes de Vacaciones"
        description="Gestione días disponibles y apruebe las solicitudes de los FSR"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/vacations/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nueva Solicitud
            </Link>
          </Button>
        }
      />

      {balance && !isFailure(balance) && (
        <VacationPlanner
          initialData={{
            user: { id: balance.user.id, name: balance.user.name },
            hasHireDate: balance.hasHireDate,
            periods: balance.periods,
            vacations: balance.vacations as CalendarVacation[],
            holidayDates: balance.holidayDates,
            year: balance.year,
          }}
          fsrs={fsrs}
          canManage={canManage}
          canCaptureHireDate={canCaptureHireDate}
        />
      )}

      <SectionCard title={`Todas las Solicitudes (${vacations.length})`}>
        {vacations.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Sin solicitudes"
            description="No hay solicitudes de vacaciones registradas."
          />
        ) : (
          <ResponsiveTable
            data={vacations}
            rowKey={(vacation) => vacation.id}
            columns={[
              {
                header: "FSR",
                cell: (vacation) => (
                  <span className="font-medium">{vacation.user.name}</span>
                ),
              },
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
              {
                header: "Acciones",
                headerClassName: "text-right",
                className: "text-right",
                cell: requestActions,
              },
            ]}
            mobileCard={(vacation) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{vacation.user.name}</p>
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
                {requestActions(vacation)}
              </div>
            )}
            emptyTitle="Sin solicitudes"
            emptyMessage="No hay solicitudes de vacaciones registradas."
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
