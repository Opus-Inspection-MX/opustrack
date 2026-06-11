"use server";

import { getSeenTimeData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { mxDaysAgoString, mxTodayString } from "@/lib/utils/datetime";
import { SeenTimeClient } from "./seen-time-client";

export default async function SeenTimePage() {
  await requireRouteAccess("/admin/reports");

  // Default: last 30 days in Mexico City time
  const initialData = await getSeenTimeData({
    startDate: mxDaysAgoString(30),
    endDate: mxTodayString(),
  });

  return <SeenTimeClient initialData={initialData} />;
}
