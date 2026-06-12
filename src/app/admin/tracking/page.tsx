"use client";

import { ClipboardList, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TrackingFilters } from "@/components/tracking/tracking-filters";
import { TrackingTable } from "@/components/tracking/tracking-table";
import { Button } from "@/components/ui/button";
import { getClientes } from "@/lib/actions/clientes";
import { getIncidentStatuses, getIncidentTypes } from "@/lib/actions/lookups";
import {
  getFSRsByClienteId,
  getIncidentsForTracking,
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

interface TrackingFiltersState {
  startDate?: string;
  endDate?: string;
  clienteId?: string;
  typeId?: number;
  statusId?: number;
  fsrId?: string;
  search?: string;
}

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<TrackingIncident[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [incidentStatuses, setIncidentStatuses] = useState<IncidentStatus[]>(
    [],
  );
  const [allFsrs, setAllFsrs] = useState<FSR[]>([]);
  const [fsrsByCliente, setFsrsByCliente] = useState<Record<string, FSR[]>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TrackingFiltersState>({});

  const loadIncidents = useCallback(
    async (filterParams: TrackingFiltersState) => {
      try {
        const result = await getIncidentsForTracking(filterParams);
        setIncidents(result.data as TrackingIncident[]);
        setTotalCount(result.totalCount);
      } catch (error) {
        console.error("Error loading incidents:", error);
      }
    },
    [],
  );

  const loadInitialData = useCallback(async () => {
    try {
      const [clientesData, typesResult, statusesResult] = await Promise.all([
        getClientes(),
        getIncidentTypes(),
        getIncidentStatuses(),
      ]);

      setClientes(clientesData);
      setIncidentTypes(typesResult.data);
      setIncidentStatuses(statusesResult.data);

      // Load FSRs for all Clientes in parallel (performance optimization)
      const fsrsMap: Record<string, FSR[]> = {};
      const allFsrsArray: FSR[] = [];

      const fsrPromises = clientesData.map(async (cliente) => {
        try {
          const clienteFsrs = await getFSRsByClienteId(cliente.id);
          return { clienteId: cliente.id, fsrs: clienteFsrs };
        } catch (error) {
          console.error(`Error loading FSRs for Cliente ${cliente.id}:`, error);
          return { clienteId: cliente.id, fsrs: [] };
        }
      });

      const fsrResults = await Promise.all(fsrPromises);

      for (const result of fsrResults) {
        fsrsMap[result.clienteId] = result.fsrs;
        allFsrsArray.push(...result.fsrs);
      }

      setFsrsByCliente(fsrsMap);
      // Remove duplicates from allFsrs
      const uniqueFsrs = allFsrsArray.filter(
        (fsr, index, self) => index === self.findIndex((f) => f.id === fsr.id),
      );
      setAllFsrs(uniqueFsrs);
    } catch (error) {
      console.error("Error loading initial data:", error);
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
          fsrsByCliente={fsrsByCliente}
          incidentStatuses={incidentStatuses}
          onDataChange={() => loadIncidents(filters)}
        />
      </div>
    </div>
  );
}
