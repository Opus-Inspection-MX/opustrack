import { getIncidentFormOptions } from "@/lib/actions/incidents";
import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function NewIncidentPage() {
  const { types, statuses, vics, users, schedules } = await getIncidentFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Nuevo Incidente</h1>
          <p className="text-muted-foreground">
            Crear un nuevo incidente en el sistema
          </p>
        </div>
      </div>

      <IncidentForm
        types={types}
        statuses={statuses}
        vics={vics}
        users={users}
        schedules={schedules}
      />
    </div>
  );
}
