import { Calendar, Pencil, Plus, Trash2 } from "lucide-react";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Días Festivos</h1>
          <p className="text-muted-foreground">
            Administre el catálogo de días festivos oficiales (LFT Art. 74)
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/holidays/new">
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Festivo
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Festivos Activos ({holidays.length})
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No hay festivos registrados.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Regla</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holidays.map((holiday) => (
                  <TableRow key={holiday.id}>
                    <TableCell className="font-medium">
                      {holiday.name}
                    </TableCell>
                    <TableCell>{formatHolidayRule(holiday)}</TableCell>
                    <TableCell>
                      {holiday.isRecurring ? (
                        <Badge variant="outline">Recurrente</Badge>
                      ) : (
                        <Badge variant="secondary">
                          Único {holiday.year ? `(${holiday.year})` : ""}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/admin/holidays/${holiday.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                            <span className="sr-only">Editar</span>
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
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Eliminar</span>
                          </Button>
                        </form>
                      </div>
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
