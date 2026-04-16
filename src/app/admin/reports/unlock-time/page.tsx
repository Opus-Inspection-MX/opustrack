"use server";

import { getUnlockTimeData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { UnlockTimeClient } from "./unlock-time-client";

export default async function UnlockTimePage() {
  await requireRouteAccess("/admin/reports");

  // Default: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const initialData = await getUnlockTimeData({
    startDate: thirtyDaysAgo.toISOString().split("T")[0],
    endDate: today.toISOString().split("T")[0],
  });

  return <UnlockTimeClient initialData={initialData} />;
}
