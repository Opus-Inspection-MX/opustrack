import { BackButton } from "@/components/common/back-button";
import { VacationForm } from "@/components/vacations/vacation-form";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function FsrNewVacationPage() {
  await requireRouteAccess("/vacations");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/vacations" />
        <div>
          <h1 className="text-3xl font-bold">Solicitar Vacaciones</h1>
          <p className="text-muted-foreground">
            Envíe una nueva solicitud de vacaciones
          </p>
        </div>
      </div>

      <VacationForm showFsrSelect={false} redirectPath="/vacations" />
    </div>
  );
}
