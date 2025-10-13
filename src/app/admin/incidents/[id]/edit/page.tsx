import { getIncidentById, getIncidentFormOptions } from "@/lib/actions/incidents";
import { IncidentForm } from "@/components/admin/incidents/incident-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

export default async function EditIncidentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [incident, { types, statuses, vics, users, schedules }] = await Promise.all([
    getIncidentById(parseInt(id)),
    getIncidentFormOptions(),
  ]);

  if (!incident) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Editar Incidente</h1>
          <p className="text-muted-foreground">
            Actualizar informacion del incidente: {incident.title}
          </p>
        </div>
      </div>

      <IncidentForm
        incident={incident}
        types={types}
        statuses={statuses}
        vics={vics}
        users={users}
        schedules={schedules}
      />
    </div>
  );
}
