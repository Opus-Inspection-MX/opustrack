"use server";

import { getSLAComplianceData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { SLAComplianceClient } from "./sla-compliance-client";

export default async function SLACompliancePage() {
  await requireRouteAccess("/admin/reports");

  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const initialData = await getSLAComplianceData({
    startDate: thirtyDaysAgo.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  });

  return <SLAComplianceClient initialData={initialData} />;
}
