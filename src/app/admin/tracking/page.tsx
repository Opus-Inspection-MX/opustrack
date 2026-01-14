"use client";

import { ClipboardList, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TrackingFilters } from "@/components/tracking/tracking-filters";
import { TrackingTable } from "@/components/tracking/tracking-table";
import { Button } from "@/components/ui/button";
import { getIncidentStatuses, getIncidentTypes } from "@/lib/actions/lookups";
import {
  getFSRsByVicId,
  getIncidentsForTracking,
} from "@/lib/actions/tracking";
import { getVICs } from "@/lib/actions/vics";

interface VIC {
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
}

interface FSR {
  id: string;
  name: string;
  email: string;
}

interface TrackingIncident {
  id: number;
  title: string;
  description?: string | null;
  vicId: string;
  typeId?: number | null;
  statusId?: number | null;
  reportedAt: Date | string;
  assignedFsrId?: string | null;
  priority?: number;
  type?: IncidentType | null;
  status?: IncidentStatus | null;
  vic?: VIC | null;
  assignedFsr?: FSR | null;
}

interface TrackingFiltersState {
  startDate?: string;
  endDate?: string;
  vicId?: string;
  typeId?: number;
  statusId?: number;
  fsrId?: string;
  search?: string;
}

export default function TrackingPage() {
  const [incidents, setIncidents] = useState<TrackingIncident[]>([]);
  const [vics, setVics] = useState<VIC[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [incidentStatuses, setIncidentStatuses] = useState<IncidentStatus[]>(
    [],
  );
  const [allFsrs, setAllFsrs] = useState<FSR[]>([]);
  const [fsrsByVic, setFsrsByVic] = useState<Record<string, FSR[]>>({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TrackingFiltersState>({});

  const loadIncidents = useCallback(
    async (filterParams: TrackingFiltersState) => {
      try {
        const data = await getIncidentsForTracking(filterParams);
        setIncidents(data as TrackingIncident[]);
      } catch (error) {
        console.error("Error loading incidents:", error);
      }
    },
    [],
  );

  const loadInitialData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [vicsData, typesResult, statusesResult] = await Promise.all([
        getVICs(),
        getIncidentTypes(),
        getIncidentStatuses(),
      ]);

      setVics(vicsData);
      setIncidentTypes(typesResult.data);
      setIncidentStatuses(statusesResult.data);

      // Load FSRs for all VICs in parallel (performance optimization)
      const fsrsMap: Record<string, FSR[]> = {};
      const allFsrsArray: FSR[] = [];

      const fsrPromises = vicsData.map(async (vic) => {
        try {
          const vicFsrs = await getFSRsByVicId(vic.id);
          return { vicId: vic.id, fsrs: vicFsrs };
        } catch (error) {
          console.error(`Error loading FSRs for VIC ${vic.id}:`, error);
          return { vicId: vic.id, fsrs: [] };
        }
      });

      const fsrResults = await Promise.all(fsrPromises);

      for (const result of fsrResults) {
        fsrsMap[result.vicId] = result.fsrs;
        allFsrsArray.push(...result.fsrs);
      }

      setFsrsByVic(fsrsMap);
      // Remove duplicates from allFsrs
      const uniqueFsrs = allFsrsArray.filter(
        (fsr, index, self) => index === self.findIndex((f) => f.id === fsr.id),
      );
      setAllFsrs(uniqueFsrs);

      // Load initial incidents for today only
      await loadIncidents({ startDate: today, endDate: today });
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      setLoading(false);
    }
  }, [loadIncidents]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadIncidents(filters);
  }, [filters, loadIncidents]);

  const handleFilterChange = (newFilters: TrackingFiltersState) => {
    setFilters(newFilters);
  };

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
          vics={vics}
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

      <div className="bg-muted/30 rounded-lg p-4">
        <div className="text-sm text-muted-foreground">
          Total de incidentes:{" "}
          <span className="font-semibold text-foreground">
            {incidents.length}
          </span>
        </div>
      </div>

      <div>
        <TrackingTable
          incidents={incidents}
          fsrsByVic={fsrsByVic}
          incidentStatuses={incidentStatuses}
          onDataChange={() => loadIncidents(filters)}
        />
      </div>
    </div>
  );
}
