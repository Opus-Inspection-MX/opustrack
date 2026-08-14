import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VacationForm } from "@/components/vacations/vacation-form";
import { getEmployeesForVacations } from "@/lib/actions/vacations";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function AdminNewVacationPage() {
  await requireRouteAccess("/admin/vacations");
  const fsrs = await getEmployeesForVacations();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/vacations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nueva Solicitud de Vacaciones</h1>
          <p className="text-muted-foreground">
            Cree una solicitud de vacaciones en nombre de un FSR
          </p>
        </div>
      </div>

      <VacationForm
        showFsrSelect={true}
        fsrs={fsrs}
        redirectPath="/admin/vacations"
      />
    </div>
  );
}
