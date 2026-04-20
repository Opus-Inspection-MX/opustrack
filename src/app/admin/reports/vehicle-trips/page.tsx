import moment from "moment-timezone";
import {
  getReportSummary,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { VehicleTripsReportClient } from "./vehicle-trips-report-client";

const TZ = "America/Mexico_City";

export default async function VehicleTripsReportPage() {
  await requireRouteAccess("/admin");

  const startDate = moment().tz(TZ).startOf("isoWeek").format("YYYY-MM-DD");
  const endDate = moment().tz(TZ).endOf("isoWeek").format("YYYY-MM-DD");

  const [initialTrendData, initialFsrData, initialSummary] = await Promise.all([
    getVehicleTripTrendData({ startDate, endDate }),
    getVehicleTripsByFSRData({ startDate, endDate }),
    getReportSummary({ startDate, endDate }),
  ]);

  return (
    <VehicleTripsReportClient
      initialTrendData={initialTrendData}
      initialFsrData={initialFsrData}
      initialSummary={initialSummary}
      initialStartDate={startDate}
      initialEndDate={endDate}
    />
  );
}
