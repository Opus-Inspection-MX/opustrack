import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { getIncidents } from "@/lib/actions/incidents";
import { IncidentsTable } from "@/components/admin/incidents/incidents-table";

export default async function IncidentsPage() {
  const incidents = await getIncidents();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Incidentes</h1>
          <p className="text-muted-foreground">
            Administre los incidentes reportados en el sistema
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/incidents/new">
            <Plus className="mr-2 h-4 w-4" />
            Agregar Incidente
          </Link>
        </Button>
      </div>

      <IncidentsTable incidents={incidents} />
    </div>
  );
}
