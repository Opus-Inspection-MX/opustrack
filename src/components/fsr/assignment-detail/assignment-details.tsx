import { MapPin } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { StatusBadge } from "@/components/common/status-badge";
import { formatMX } from "@/lib/utils/datetime";
import { assignmentStatusTone } from "./assignment-header";

interface AssignmentDetailsProps {
  folio: number;
  statusName: string;
  createdAt?: Date | string | null;
  seenAt?: Date | string | null;
  seenByName?: string | null;
  startedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startAddress?: string | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  endAddress?: string | null;
  notes?: string | null;
  incidentTitle?: string | null;
  incidentTypeName?: string | null;
  incidentStatusName?: string | null;
  incidentClientName?: string | null;
}

/** Read-only facts of one assignment: status, folio, dates, GPS, notes. */
export function AssignmentDetails({
  folio,
  statusName,
  createdAt,
  seenAt,
  seenByName,
  startedAt,
  finishedAt,
  startLatitude,
  startLongitude,
  startAddress,
  endLatitude,
  endLongitude,
  endAddress,
  notes,
  incidentTitle,
  incidentTypeName,
  incidentStatusName,
  incidentClientName,
}: AssignmentDetailsProps) {
  return (
    <SectionCard title="Detalles de la Asignación">
      <div className="space-y-4">
        {incidentTitle && (
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Incidente Relacionado
            </p>
            <p className="font-medium">{incidentTitle}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {incidentTypeName && <span>Tipo: {incidentTypeName}</span>}
              {incidentStatusName && <span>Estado: {incidentStatusName}</span>}
              {incidentClientName && <span>Cliente: {incidentClientName}</span>}
            </div>
          </div>
        )}
        <div>
          <span className="font-medium">Estado:</span>{" "}
          <StatusBadge tone={assignmentStatusTone(statusName)}>
            {statusName || "N/A"}
          </StatusBadge>
        </div>
        <div>
          <span className="font-medium">Folio:</span> AS-{folio}
        </div>

        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {createdAt && (
            <div>
              <span className="font-medium">Creada:</span> {formatMX(createdAt)}
            </div>
          )}
          {seenAt && (
            <div>
              <span className="font-medium">Vista:</span> {formatMX(seenAt)}
              {seenByName && ` por ${seenByName}`}
            </div>
          )}
          {startedAt && (
            <div>
              <span className="font-medium">Iniciada:</span>{" "}
              {formatMX(startedAt)}
            </div>
          )}
          {finishedAt && (
            <div>
              <span className="font-medium">Cerrada:</span>{" "}
              {formatMX(finishedAt)}
            </div>
          )}
        </div>
        {(startLatitude != null || endLatitude != null) && (
          <div className="grid grid-cols-1 gap-3 border-t pt-2 text-sm sm:grid-cols-2">
            {startLatitude != null && startLongitude != null && (
              <a
                href={`https://www.google.com/maps?q=${startLatitude},${startLongitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 text-info hover:underline"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">Inicio:</span>{" "}
                  {startLatitude.toFixed(5)}, {startLongitude.toFixed(5)}
                  {startAddress && (
                    <>
                      <br />
                      <span className="text-muted-foreground">
                        {startAddress}
                      </span>
                    </>
                  )}
                </span>
              </a>
            )}
            {endLatitude != null && endLongitude != null && (
              <a
                href={`https://www.google.com/maps?q=${endLatitude},${endLongitude}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-2 text-info hover:underline"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  <span className="font-medium">Cierre:</span>{" "}
                  {endLatitude.toFixed(5)}, {endLongitude.toFixed(5)}
                  {endAddress && (
                    <>
                      <br />
                      <span className="text-muted-foreground">
                        {endAddress}
                      </span>
                    </>
                  )}
                </span>
              </a>
            )}
          </div>
        )}
        {notes && (
          <div>
            <p className="mb-1 text-sm font-medium">Notas:</p>
            <p className="text-sm text-muted-foreground">{notes}</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
