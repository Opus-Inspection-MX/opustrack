"use server";

import { getSlaBreachData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { mxDaysAgoString, mxTodayString } from "@/lib/utils/datetime";
import { SlaBreachClient } from "./sla-breach-client";

export default async function SlaBreachPage() {
  await requireRouteAccess("/admin/reports");

  // Default: last 30 days in Mexico City time
  const initialData = await getSlaBreachData({
    startDate: mxDaysAgoString(30),
    endDate: mxTodayString(),
  });

  return <SlaBreachClient initialData={initialData} />;
}
