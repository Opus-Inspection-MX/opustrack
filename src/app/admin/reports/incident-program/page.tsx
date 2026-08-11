import moment from "moment-timezone";
import { getClientesForSelect } from "@/lib/actions/clientes";
import {
  getIncidentProgramReport,
  getScheduleOptions,
} from "@/lib/actions/incident-program";
import { getStatesForSelect } from "@/lib/actions/lookups";
import { requireRouteAccess } from "@/lib/auth/auth";
import { APP_TZ } from "@/lib/utils/datetime";
import { IncidentProgramClient } from "./incident-program-client";

export default async function IncidentProgramReportPage() {
  await requireRouteAccess("/admin/reports/incident-program");

  // Default range: the current month, which is how the operation issues these.
  const now = moment().tz(APP_TZ);
  const startDate = now.clone().startOf("month").format("YYYY-MM-DD");
  const endDate = now.clone().endOf("month").format("YYYY-MM-DD");

  const [report, schedules, clientes, states] = await Promise.all([
    getIncidentProgramReport({ startDate, endDate }),
    getScheduleOptions({ startDate, endDate }),
    getClientesForSelect(),
    getStatesForSelect(),
  ]);

  return (
    <IncidentProgramClient
      initialReport={report}
      initialSchedules={schedules}
      initialStartDate={startDate}
      initialEndDate={endDate}
      clientes={clientes}
      states={states}
    />
  );
}
