"use server";

import { getAssignmentAgingData } from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { AssignmentAgingClient } from "./assignment-aging-client";

export default async function AssignmentAgingPage() {
  await requireRouteAccess("/admin/reports");

  const initialData = await getAssignmentAgingData();

  return <AssignmentAgingClient initialData={initialData} />;
}
