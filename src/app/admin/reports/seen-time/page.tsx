"use server";

import { getSeenTimeData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { SeenTimeClient } from "./seen-time-client";

export default async function SeenTimePage() {
  await requireRouteAccess("/admin/reports");

  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const initialData = await getSeenTimeData({
    startDate: thirtyDaysAgo.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  });

  return <SeenTimeClient initialData={initialData} />;
}
