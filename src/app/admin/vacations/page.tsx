import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { VacationApprovalButtons } from "@/components/vacations/vacation-approval-buttons";
import { VacationPlanner } from "@/components/vacations/vacation-planner";
import type { CalendarVacation } from "@/components/vacations/vacation-year-calendar";
import { isFailure } from "@/lib/actions/result";
import {
  getFsrsForVacations,
  getVacationBalanceData,
  getVacations,
} from "@/lib/actions/vacations";
import { canPerform, requireRouteAccess } from "@/lib/auth/auth";
import { formatMX } from "@/lib/utils/datetime";

const STATUS_BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  APROBADA: "bg-green-100 text-green-800 border-green-300",
  RECHAZADA: "bg-red-100 text-red-800 border-red-300",
};

export default async function AdminVacationsPage() {
  await requireRouteAccess("/admin/vacations");
  const [vacations, fsrs, canManage] = await Promise.all([
    getVacations(),
    getFsrsForVacations(),
    canPerform("vacations:manage"),
  ]);

  // Default the balance panel to the first FSR; the picker switches from there.
  const balance =
    fsrs.length > 0 ? await getVacationBalanceData(fsrs[0].id) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Solicitudes de Vacaciones</h1>
          <p className="text-muted-foreground">
            Gestione días disponibles y apruebe las solicitudes de los FSR
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/vacations/new">
            <Plus className="mr-2 h-4 w-4" />
            Nueva Solicitud
          </Link>
        </Button>
      </div>

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
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Todas las Solicitudes ({vacations.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vacations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay solicitudes de vacaciones registradas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>FSR</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aprobado por</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacations.map((vacation) => (
                  <TableRow key={vacation.id}>
                    <TableCell className="font-medium">
                      {vacation.user.name}
                    </TableCell>
                    <TableCell>
                      {formatMX(vacation.startDate, { dateStyle: "short" })}
                    </TableCell>
                    <TableCell>
                      {formatMX(vacation.endDate, { dateStyle: "short" })}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {vacation.reason ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE[vacation.status.name] ?? ""}
                      >
                        {vacation.status.name === "PENDIENTE"
                          ? "Pendiente"
                          : vacation.status.name === "APROBADA"
                            ? "Aprobada"
                            : "Rechazada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {vacation.approvedBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <VacationApprovalButtons
                        vacationId={vacation.id}
                        statusName={vacation.status.name}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
