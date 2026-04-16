import {
  getIncidentsByTypeData,
  getIncidentTrendData,
  getReportSummary,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { IncidentsReportClient } from "./incidents-report-client";

export default async function IncidentsReportPage() {
  await requireRouteAccess("/admin");

  const [initialTrendData, initialTypeData, initialSummary] = await Promise.all(
    [getIncidentTrendData(), getIncidentsByTypeData(), getReportSummary()],
  );

  return (
    <IncidentsReportClient
      initialTrendData={initialTrendData}
      initialTypeData={initialTypeData}
      initialSummary={initialSummary}
    />
  );
}
