import {
  getAssignmentStatusData,
  getReportSummary,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { AssignmentsReportClient } from "./assignments-report-client";

export default async function AssignmentsReportPage() {
  await requireRouteAccess("/admin");

  const [initialData, initialSummary] = await Promise.all([
    getAssignmentStatusData(),
    getReportSummary(),
  ]);

  return (
    <AssignmentsReportClient
      initialData={initialData}
      initialSummary={initialSummary}
    />
  );
}
