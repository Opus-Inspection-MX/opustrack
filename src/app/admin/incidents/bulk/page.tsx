import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { BulkIncidentsClient } from "@/components/admin/incidents/bulk-incidents-client";
import { Button } from "@/components/ui/button";
import { getBulkIncidentCatalogs } from "@/lib/actions/incidents";
import { requireRouteAccess } from "@/lib/auth/auth";

export default async function BulkIncidentsPage() {
  await requireRouteAccess("/admin/incidents");
  const catalogs = await getBulkIncidentCatalogs();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/incidents">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Carga masiva de incidentes</h1>
          <p className="text-muted-foreground">
            Descarga la plantilla, llénala y súbela para crear muchos incidentes
            a la vez (programación mensual)
          </p>
        </div>
      </div>

      <BulkIncidentsClient catalogs={catalogs} />
    </div>
  );
}
