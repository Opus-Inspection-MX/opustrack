import { getPartsUsageData, getReportSummary } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { PartsUsageReportClient } from "./parts-usage-report-client";

export default async function PartsUsageReportPage() {
  await requireRouteAccess("/admin");

  const [initialData, initialSummary] = await Promise.all([
    getPartsUsageData(),
    getReportSummary(),
  ]);

  return (
    <PartsUsageReportClient
      initialData={initialData}
      initialSummary={initialSummary}
    />
  );
}
