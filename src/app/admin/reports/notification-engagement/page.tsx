import { getNotificationEngagementReport } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { NotificationEngagementReportClient } from "./notification-engagement-report-client";

export default async function NotificationEngagementReportPage() {
  await requireRouteAccess("/admin/reports/notification-engagement");
  const initial = await getNotificationEngagementReport();
  return (
    <NotificationEngagementReportClient
      initialRows={initial.rows}
      initialSummary={initial.summary}
    />
  );
}
