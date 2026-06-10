import { getIncidentTypes } from "@/lib/actions/lookups";
import {
  getIncidentsByTypeData,
  getIncidentTrendData,
  getReportSummary,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { IncidentsReportClient } from "./incidents-report-client";

export default async function IncidentsReportPage() {
  await requireRouteAccess("/admin");

  const [initialTrendData, initialTypeData, initialSummary, typesResult] =
    await Promise.all([
      getIncidentTrendData(),
      getIncidentsByTypeData(),
      getReportSummary(),
      getIncidentTypes({ limit: 500 }),
    ]);

  const incidentTypes = typesResult.data
    .filter((t) => t.active)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <IncidentsReportClient
      initialTrendData={initialTrendData}
      initialTypeData={initialTypeData}
      initialSummary={initialSummary}
      incidentTypes={incidentTypes}
    />
  );
}
