import {
  getReportSummary,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { VehicleTripsReportClient } from "./vehicle-trips-report-client";

export default async function VehicleTripsReportPage() {
  await requireRouteAccess("/admin");

  const [initialTrendData, initialFsrData, initialSummary] = await Promise.all([
    getVehicleTripTrendData(),
    getVehicleTripsByFSRData(),
    getReportSummary(),
  ]);

  return (
    <VehicleTripsReportClient
      initialTrendData={initialTrendData}
      initialFsrData={initialFsrData}
      initialSummary={initialSummary}
    />
  );
}
