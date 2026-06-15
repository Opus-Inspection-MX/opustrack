import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { VacationForm } from "@/components/vacations/vacation-form";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function FsrNewVacationPage() {
  await requireRouteAccess("/fsr/vacations");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/fsr/vacations">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Solicitar Vacaciones</h1>
          <p className="text-muted-foreground">
            Envíe una nueva solicitud de vacaciones
          </p>
        </div>
      </div>

      <VacationForm showFsrSelect={false} redirectPath="/fsr/vacations" />
    </div>
  );
}
