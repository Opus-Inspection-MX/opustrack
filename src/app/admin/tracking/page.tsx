"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FilterBar } from "@/components/common/filter-bar";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { TableSkeleton } from "@/components/common/skeletons";
import { TrackingFilters } from "@/components/tracking/tracking-filters";
import { TrackingTable } from "@/components/tracking/tracking-table";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { toast } from "@/hooks/use-toast";
import {
  getIncidentsForTracking,
  getTrackingBootstrap,
  getTrackingSignature,
  type TrackingFilters as TrackingQueryFilters,
} from "@/lib/actions/tracking";
import type { SlaState } from "@/lib/constants/sla-policy";
import { logger } from "@/lib/observability/logger";
import {
  TRACKING_DEFAULT_PAGE_SIZE,
  type TrackingPageSize,
} from "@/lib/tracking/pagination";

interface Client {
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
  /** Clients this FSR usually covers — a hint for the picker, not a filter. */
  clientIds?: string[];
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
  /** RF-218 breach flag, attached server-side by `getIncidentsForTracking`. */
  sla?: SlaState | null;
  client?: { id: string; name: string; code: string } | null;
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
  const [clients, setClientes] = useState<Client[]>([]);
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [incidentStatuses, setIncidentStatuses] = useState<IncidentStatus[]>(
    [],
  );
  const [allFsrs, setAllFsrs] = useState<FSR[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<TrackingFiltersState>({});
  // Fase 6b: server-side pagination instead of the 200-row cut.
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TrackingPageSize>(
    TRACKING_DEFAULT_PAGE_SIZE,
  );
  const [totalPages, setTotalPages] = useState(1);

  const loadIncidents = useCallback(
    async (
      filterParams: TrackingFiltersState,
      pageNum: number,
      size: TrackingPageSize,
    ) => {
      try {
        const result = await getIncidentsForTracking(filterParams, {
          page: pageNum,
          pageSize: size,
        });
        setIncidents(result.data as TrackingIncident[]);
        setTotalCount(result.totalCount);
        setTotalPages(result.totalPages);
        setPage(result.page);
      } catch (error) {
        // Surfaced, not swallowed. A thrown query used to leave the table at
        // "Total de incidentes: 0", which reads as "no hay datos" and sent us
        // hunting through the database for a problem that was in the code.
        logger.error("Error loading incidents:", error);
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

      setClientes(bootstrap.clients);
      setIncidentTypes(bootstrap.types);
      setIncidentStatuses(bootstrap.statuses);
      setAllFsrs(bootstrap.fsrs);
    } catch (error) {
      logger.error("Error loading initial data:", error);
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
      // A new filter set is a new result set: back to page 1.
      setPage(1);
      loadIncidents(newFilters, 1, pageSize);
    },
    [loadIncidents, pageSize],
  );

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setPage(nextPage);
      loadIncidents(filters, nextPage, pageSize);
    },
    [loadIncidents, filters, pageSize],
  );

  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      const size = (
        [50, 100, 200].includes(nextSize) ? nextSize : 50
      ) as TrackingPageSize;
      setPageSize(size);
      setPage(1);
      loadIncidents(filters, 1, size);
    },
    [loadIncidents, filters],
  );

  // The board is watched all day while other people assign, start and close
  // work elsewhere. Poll the signature, not the table. The signature ignores
  // paging, so staying on page 3 never triggers a reload by itself.
  useLiveRefresh({
    enabled: !loading,
    signature: useCallback(() => getTrackingSignature(filters), [filters]),
    onChanged: useCallback(
      () => loadIncidents(filters, page, pageSize),
      [loadIncidents, filters, page, pageSize],
    ),
  });

  if (loading) {
    return (
      <PageContainer>
        <PageHeader
          title="Seguimiento de Atención"
          description="Monitorea y gestiona el seguimiento de incidentes"
        />
        <TableSkeleton rows={6} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Seguimiento de Atención"
        description="Monitorea y gestiona el seguimiento de incidentes"
        actions={
          <Button asChild className="min-h-[44px] w-full sm:w-auto">
            <Link href="/admin/incidents/new">
              <Plus className="h-4 w-4 mr-2" aria-hidden />
              Crear Incidente
            </Link>
          </Button>
        }
      />

      <FilterBar activeCount={Object.keys(filters).length}>
        <TrackingFilters
          clients={clients}
          incidentTypes={incidentTypes}
          incidentStatuses={incidentStatuses}
          fsrs={allFsrs}
          onFilterChange={handleFilterChange}
        />
      </FilterBar>

      <div className="bg-muted/30 rounded-lg p-4 flex items-center gap-3 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Total de incidentes:{" "}
          <span className="font-semibold text-foreground">{totalCount}</span>
        </div>
      </div>

      <div>
        <TrackingTable
          incidents={incidents}
          fsrs={allFsrs}
          incidentStatuses={incidentStatuses}
          onDataChange={() => loadIncidents(filters, page, pageSize)}
        />
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalCount}
        itemsPerPage={pageSize}
        onPageChange={handlePageChange}
        onItemsPerPageChange={handlePageSizeChange}
        pageSizeOptions={[50, 100, 200]}
      />
    </PageContainer>
  );
}
