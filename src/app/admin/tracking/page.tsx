"use client";

import { ClipboardList, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TrackingFilters } from "@/components/tracking/tracking-filters";
import { TrackingTable } from "@/components/tracking/tracking-table";
import { Button } from "@/components/ui/button";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { toast } from "@/hooks/use-toast";
import {
  getIncidentsForTracking,
  getTrackingBootstrap,
  getTrackingSignature,
  type TrackingFilters as TrackingQueryFilters,
} from "@/lib/actions/tracking";

interface Cliente {
  id: string;
  name: string;
  code: string;
}

interface IncidentType {
  id: number;
  name: string;
}

interface IncidentStatus {
  id: number;
  name: string;
  color: string;
}

interface FSR {
  id: string;
  name: string;
  email: string;
  /** Clientes this FSR usually covers — a hint for the picker, not a filter. */
  clienteIds?: string[];
}

interface TrackingAssignment {
  id: string;
  status?: { id: number; name: string } | null;
  statusId?: number | null;
  assignees?: Array<{
    user: { id: string; name: string; email?: string };
  }>;
  folio?: number | null;
  notes?: string | null;
  lineId?: number | null;
  equipmentId?: number | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  seenAt?: Date | string | null;
  assignedAt?: Date | string | null;
  createdAt?: Date | string;
}

interface TrackingIncident {
  id: number;
  title: string;
  description?: string | null;
  reportedAt: Date | string;
  resolvedAt?: Date | string | null;
  statusId?: number | null;
  status?: { id: number; name: string; color: string } | null;
  type?: { id: number; name: string; priority: number } | null;
  cliente?: { id: string; name: string; code: string } | null;
  reportedBy?: { id: string; name: string } | null;
  assignments: TrackingAssignment[];
  lineId?: number | null;
  equipmentId?: number | null;
  line?: { id: number; name: string } | null;
  equipment?: { id: number; name: string } | null;
}

/**
 * What `<TrackingFilters>` emits, which is also exactly what the server action
 * accepts. It used to declare `fsrId` and `search`, names the filter component
 * never sends and the query never reads — the object was passed straight
 * through, so nothing failed and nothing filtered either.
 */
type TrackingFiltersState = TrackingQueryFilters;

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<TrackingIncident[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [incidentStatuses, setIncidentStatuses] = useState<IncidentStatus[]>(
    [],
  );
  const [allFsrs, setAllFsrs] = useState<FSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TrackingFiltersState>({});

  const loadIncidents = useCallback(
    async (filterParams: TrackingFiltersState) => {
      try {
        const result = await getIncidentsForTracking(filterParams);
        setIncidents(result.data as TrackingIncident[]);
        setTotalCount(result.totalCount);
      } catch (error) {
        // Surfaced, not swallowed. A thrown query used to leave the table at
        // "Total de incidentes: 0", which reads as "no hay datos" and sent us
        // hunting through the database for a problem that was in the code.
        console.error("Error loading incidents:", error);
        toast.error("No se pudieron cargar los incidentes. Intenta de nuevo.");
      }
    },
    [],
  );

  const loadInitialData = useCallback(async () => {
    try {
      // One call, not four. Server Actions are POSTs that Next does not run in
      // parallel, so four separate round trips cost four times the latency
      // before the filters can even render.
      const bootstrap = await getTrackingBootstrap();

      setClientes(bootstrap.clientes);
      setIncidentTypes(bootstrap.types);
      setIncidentStatuses(bootstrap.statuses);
      setAllFsrs(bootstrap.fsrs);
    } catch (error) {
      console.error("Error loading initial data:", error);
      toast.error(
        "No se pudieron cargar los filtros ni la lista de FSR. Intenta de nuevo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleFilterChange = useCallback(
    (newFilters: TrackingFiltersState) => {
      setFilters(newFilters);
      loadIncidents(newFilters);
    },
    [loadIncidents],
  );

  // The board is watched all day while other people assign, start and close
  // work elsewhere. Poll the signature, not the table.
  useLiveRefresh({
    enabled: !loading,
    signature: useCallback(() => getTrackingSignature(filters), [filters]),
    onChanged: useCallback(
      () => loadIncidents(filters),
      [loadIncidents, filters],
    ),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <ClipboardList className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Seguimiento de Atención</h1>
          <p className="text-muted-foreground">
            Monitorea y gestiona el seguimiento de incidentes
          </p>
        </div>
      </div>

      <div>
        <TrackingFilters
          clientes={clientes}
          incidentTypes={incidentTypes}
          incidentStatuses={incidentStatuses}
          fsrs={allFsrs}
          onFilterChange={handleFilterChange}
          createButton={
            <Button asChild>
              <Link href="/admin/incidents/new">
                <Plus className="h-4 w-4 mr-2" />
                Crear Incidente
              </Link>
            </Button>
          }
        />
      </div>

      <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Total de incidentes:{" "}
          <span className="font-semibold text-foreground">{totalCount}</span>
        </div>
        {incidents.length < totalCount && (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            Mostrando {incidents.length} de {totalCount} — aplique filtros para
            acotar
          </span>
        )}
      </div>

      <div>
        <TrackingTable
          incidents={incidents}
          fsrs={allFsrs}
          incidentStatuses={incidentStatuses}
          onDataChange={() => loadIncidents(filters)}
        />
      </div>
    </div>
  );
}
