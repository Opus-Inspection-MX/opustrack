import { getFSRPerformanceData, getReportSummary } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { FSRPerformanceClient } from "./fsr-performance-client";

export default async function FSRPerformanceReportPage() {
  await requireRouteAccess("/admin");

  // Get initial data (last 30 days)
  const [initialData, initialSummary] = await Promise.all([
    getFSRPerformanceData(),
    getReportSummary(),
  ]);

  return (
    <FSRPerformanceClient
      initialData={initialData}
      initialSummary={initialSummary}
    />
  );
}
