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
import { VacationPlanner } from "@/components/vacations/vacation-planner";
import type { CalendarVacation } from "@/components/vacations/vacation-year-calendar";
import { isFailure } from "@/lib/actions/result";
import {
  getMyVacations,
  getVacationBalanceData,
} from "@/lib/actions/vacations";
import { requireRouteAccess } from "@/lib/auth/auth";

const STATUS_BADGE: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-800 border-amber-300",
  APROBADA: "bg-green-100 text-green-800 border-green-300",
  RECHAZADA: "bg-red-100 text-red-800 border-red-300",
};

export default async function FsrVacationsPage() {
  await requireRouteAccess("/fsr/vacations");
  const [vacations, balance] = await Promise.all([
    getMyVacations(),
    getVacationBalanceData(),
  ]);

  const pending = vacations.filter((v) => v.status.name === "PENDIENTE").length;
  const approved = vacations.filter((v) => v.status.name === "APROBADA").length;
  const rejected = vacations.filter(
    (v) => v.status.name === "RECHAZADA",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mis Vacaciones</h1>
          <p className="text-muted-foreground">
            Consulte sus días disponibles y aparte su período vacacional
          </p>
        </div>
        <Button asChild>
          <Link href="/fsr/vacations/new">
            <Plus className="mr-2 h-4 w-4" />
            Solicitar Vacaciones
          </Link>
        </Button>
      </div>

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
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aprobadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rechazadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Historial de Solicitudes ({vacations.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {vacations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No tiene solicitudes de vacaciones registradas.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/fsr/vacations/new">Crear primera solicitud</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Fin</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Aprobado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacations.map((vacation) => (
                  <TableRow key={vacation.id}>
                    <TableCell>
                      {vacation.startDate.toLocaleDateString("es-MX")}
                    </TableCell>
                    <TableCell>
                      {vacation.endDate.toLocaleDateString("es-MX")}
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
