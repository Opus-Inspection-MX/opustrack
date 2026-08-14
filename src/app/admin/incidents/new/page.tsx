import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { BackButton } from "@/components/common/back-button";
import { getIncidentFormOptions } from "@/lib/actions/incidents";

export default async function NewIncidentPage() {
  const { types, statuses, clientes, users, schedules } =
    await getIncidentFormOptions();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton fallback="/admin/incidents" />
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
        clientes={clientes}
        users={users}
        schedules={schedules}
      />
    </div>
  );
}
