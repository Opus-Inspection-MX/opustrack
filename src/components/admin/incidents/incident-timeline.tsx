import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getIncidentEvents } from "@/lib/actions/incidents";
import { formatMX } from "@/lib/utils/datetime";

const EVENT_LABELS: Record<string, string> = {
  CREATED: "Incidencia creada",
  STATUS_CHANGED: "Cambio de estado",
  ASSIGNEE_ADDED: "FSR habilitado",
  ASSIGNEE_REMOVED: "FSR retirado",
  ASSIGNEE_AUTO_CREATED: "FSR habilitado automáticamente",
  ASSIGN_DENIED: "Habilitación denegada",
  CANCELLED: "Incidencia cancelada",
  REOPENED: "Incidencia reabierta",
  BULK_IMPORTED: "Carga masiva",
  RECALC_SKIPPED: "Recálculo omitido",
  ADMIN_OVERRIDE: "Excepción de administrador",
};

function payloadText(
  record: Record<string, unknown> | null,
  userNames: Record<string, string>,
): string | null {
  if (!record) return null;
  const str = (key: string): string | null =>
    typeof record[key] === "string" ? (record[key] as string) : null;
  const nameOf = (id: string | null): string | null =>
    id ? (userNames[id] ?? id) : null;

  const reason = str("reason");
  if (reason) return reason;
  const prior = str("priorResolvedAt");
  if (prior) return `Cierre original: ${formatMX(new Date(prior))}`;
  const resolved = str("resolvedAt");
  if (resolved) return `Cierre: ${formatMX(new Date(resolved))}`;
  const rowNumber = record.rowNumber;
  if (typeof rowNumber === "number") {
    const initial = str("initialStatus");
    return `Fila ${rowNumber}${initial ? ` · estado inicial ${initial}` : ""}`;
  }
  const userId = str("userId") ?? str("deniedUserId");
  if (userId) return nameOf(userId);
  const attempted = str("attemptedTarget");
  if (attempted) return `Destino intentado: ${attempted}`;
  return null;
}

function eventPayload(
  event: Awaited<ReturnType<typeof getIncidentEvents>>["events"][number],
): Record<string, unknown> | null {
  const payload = event.payload;
  return typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>)
    : null;
}

/**
 * Read-only audit timeline (RF-219). Server Component, 50 events per page,
 * no mutations. Admin-only surface: FSR/CLIENT views stay out of scope.
 */
export async function IncidentTimeline({
  incidentId,
  page = 1,
}: {
  incidentId: number;
  page?: number;
}) {
  const { events, userNames, pagination } = await getIncidentEvents(
    incidentId,
    page,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Historial
          {pagination.total > 0 && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {pagination.total} {pagination.total === 1 ? "evento" : "eventos"}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aún no hay eventos registrados para esta incidencia. La bitácora
            comenzó con el despliegue actual y no incluye historial anterior.
          </p>
        ) : (
          <ol className="space-y-4">
            {events.map((event) => {
              const payload = eventPayload(event);
              const detail = payloadText(payload, userNames);
              const transition =
                event.fromStatus && event.toStatus
                  ? `${event.fromStatus} → ${event.toStatus}`
                  : (event.toStatus ?? event.fromStatus ?? null);
              return (
                <li key={event.id} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-muted-foreground"
                  />
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {EVENT_LABELS[event.eventType] ?? event.eventType}
                      </Badge>
                      {transition && (
                        <span className="text-sm font-medium">
                          {transition}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {event.actorName ?? "Sistema"} ·{" "}
                      {formatMX(event.createdAt)}
                    </p>
                    {detail && <p className="text-sm">{detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Página {pagination.page} de {pagination.totalPages}
            </span>
            <div className="flex gap-2">
              {pagination.page > 1 && (
                <Link
                  className="underline"
                  href={`?historial=${pagination.page - 1}`}
                >
                  Anterior
                </Link>
              )}
              {pagination.page < pagination.totalPages && (
                <Link
                  className="underline"
                  href={`?historial=${pagination.page + 1}`}
                >
                  Siguiente
                </Link>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
