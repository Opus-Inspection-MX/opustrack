import { getDailyTripComplianceReport } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { DailyTripComplianceReportClient } from "./daily-trip-compliance-report-client";

export default async function DailyTripComplianceReportPage() {
  await requireRouteAccess("/admin/reports/daily-trip-compliance");
  const initial = await getDailyTripComplianceReport();
  return (
    <DailyTripComplianceReportClient
      initialDays={initial.days}
      initialRows={initial.rows}
      initialSummary={initial.summary}
    />
  );
}
