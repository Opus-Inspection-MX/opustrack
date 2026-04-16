import {
  getReportSummary,
  getWorkOrderStatusData,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { WorkOrdersReportClient } from "./work-orders-report-client";

export default async function WorkOrdersReportPage() {
  await requireRouteAccess("/admin");

  const [initialData, initialSummary] = await Promise.all([
    getWorkOrderStatusData(),
    getReportSummary(),
  ]);

  return (
    <WorkOrdersReportClient
      initialData={initialData}
      initialSummary={initialSummary}
    />
  );
}
