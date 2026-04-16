"use server";

import { getWorkOrderAgingData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { WorkOrderAgingClient } from "./work-order-aging-client";

export default async function WorkOrderAgingPage() {
  await requireRouteAccess("/admin/reports");

  const initialData = await getWorkOrderAgingData();

  return <WorkOrderAgingClient initialData={initialData} />;
}
