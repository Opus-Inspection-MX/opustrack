import moment from "moment-timezone";
import {
  getReportSummary,
  getVehicleTripsByFSRData,
  getVehicleTripTrendData,
} from "@/lib/actions/reports";
import { requireRouteAccess } from "@/lib/auth/auth";
import { APP_TZ } from "@/lib/utils/datetime";
import { VehicleTripsReportClient } from "./vehicle-trips-report-client";

export default async function VehicleTripsReportPage() {
  await requireRouteAccess("/admin");

  const startDate = moment().tz(APP_TZ).startOf("isoWeek").format("YYYY-MM-DD");
  const endDate = moment().tz(APP_TZ).endOf("isoWeek").format("YYYY-MM-DD");

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
