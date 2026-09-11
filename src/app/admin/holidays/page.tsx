import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ResponsiveTable } from "@/components/common/responsive-table";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { deleteHoliday, getHolidays } from "@/lib/actions/holidays";
import { requireRouteAccess } from "@/lib/auth/auth";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const NTH_LABELS: Record<number, string> = {
  1: "1er",
  2: "2do",
  3: "3er",
  4: "4to",
  5: "5to",
};

function formatHolidayRule(holiday: {
  day: number | null;
  nthMonday: number | null;
  month: number;
  isRecurring: boolean;
  year: number | null;
}): string {
  const monthName = MONTH_NAMES[holiday.month - 1] ?? "";

  if (holiday.day !== null) {
    return `${holiday.day} de ${monthName}`;
  }

  if (holiday.nthMonday !== null) {
    const nth = NTH_LABELS[holiday.nthMonday] ?? `${holiday.nthMonday}°`;
    return `${nth} lunes de ${monthName}`;
  }

  return monthName;
}

export default async function AdminHolidaysPage() {
  await requireRouteAccess("/admin/holidays");
  const holidays = await getHolidays();

  return (
    <PageContainer>
      <PageHeader
        title="Días Festivos"
        description="Administre el catálogo de días festivos oficiales (LFT Art. 74)"
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/admin/holidays/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nuevo Festivo
            </Link>
          </Button>
        }
      />

      <SectionCard title={`Festivos Activos (${holidays.length})`}>
        {holidays.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Sin festivos"
            description="No hay festivos registrados."
            action={{ label: "Nuevo Festivo", href: "/admin/holidays/new" }}
          />
        ) : (
          <ResponsiveTable
            data={holidays}
            rowKey={(holiday) => holiday.id}
            columns={[
              {
                header: "Nombre",
                cell: (holiday) => (
                  <span className="font-medium">{holiday.name}</span>
                ),
              },
              {
                header: "Regla",
                cell: (holiday) => <span>{formatHolidayRule(holiday)}</span>,
              },
              {
                header: "Tipo",
                cell: (holiday) =>
                  holiday.isRecurring ? (
                    <StatusBadge tone="info">Recurrente</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">
                      Único {holiday.year ? `(${holiday.year})` : ""}
                    </StatusBadge>
                  ),
              },
              {
                header: "Acciones",
                headerClassName: "text-right",
                className: "text-right",
                cell: (holiday) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      aria-label="Editar"
                    >
                      <Link href={`/admin/holidays/${holiday.id}/edit`}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                    <form
                      action={async () => {
                        "use server";
                        await deleteHoliday(holiday.id);
                      }}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        type="submit"
                        aria-label="Eliminar"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </form>
                  </div>
                ),
              },
            ]}
            mobileCard={(holiday) => (
              <div className="space-y-2 rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{holiday.name}</p>
                  <StatusBadge tone={holiday.isRecurring ? "info" : "neutral"}>
                    {holiday.isRecurring
                      ? "Recurrente"
                      : `Único ${holiday.year ? `(${holiday.year})` : ""}`}
                  </StatusBadge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatHolidayRule(holiday)}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="flex-1"
                  >
                    <Link href={`/admin/holidays/${holiday.id}/edit`}>
                      Editar
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            emptyTitle="Sin festivos"
            emptyMessage="No hay festivos registrados."
          />
        )}
      </SectionCard>
    </PageContainer>
  );
}
