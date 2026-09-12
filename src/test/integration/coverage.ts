/**
 * The integration coverage registry: the single source of truth for WHAT the
 * `*.int.test.ts` matrices prove.
 *
 * - `MATRIX_*`: `"file :: action"` entries exercised by a suite. The suite
 *   files import their list and assert it stays in sync (adding a case to a
 *   matrix without registering it — or vice versa — fails).
 * - `MATRIX_ROUTES`: route handlers covered with real data (`"path :: METHOD"`).
 * - `ALLOWLIST`: tenant/id actions NOT in a matrix, each with its reason —
 *   global catalogs, own-user rows, or a TODO(0x/5a) marking a known gap to
 *   promote once its fix lands. No dead entries (the meta test resolves
 *   every key against the real exports).
 * - `EXPECTED_FAIL`: matrix entries whose test is `it.fails` until the noted
 *   fix lands. Fixing the behavior without removing the marker fails the
 *   suite on purpose — the marker must move with the fix.
 */

export const MATRIX_SCOPE = new Set([
  "incidents.ts :: getIncidents",
  "incidents.ts :: getIncidentById",
  "incidents.ts :: getReporterIncidents",
  "assignments.ts :: getAssignments",
  "assignments.ts :: getAssignmentById",
  "assignment-activities.ts :: getAllAssignmentActivities",
  "assignment-activities.ts :: getAssignmentActivities",
  "assignment-activities.ts :: getAssignmentActivityById",
  "assignment-items.ts :: getAssignmentItems",
  "clients.ts :: getClientsForSelect",
  "clients.ts :: getClients",
  "clients.ts :: getClientById",
  "lines.ts :: getLines",
  "lines.ts :: getLineById",
  "lines.ts :: getLinesByClientId",
  "equipments.ts :: getEquipments",
  "equipments.ts :: getEquipmentById",
  "equipments.ts :: getEquipmentsByLineId",
  "users.ts :: getUsers",
  "users.ts :: getUserById",
  "schedules.ts :: getSchedules",
  "schedules.ts :: getScheduleById",
  "incident-program.ts :: getScheduleOptions",
  "incident-program.ts :: getIncidentProgramReport",
  "tracking.ts :: getIncidentsForTracking",
  "vehicle-trips.ts :: getAllVehicleTrips",
  "vehicle-trips.ts :: getVehicleTripById",
]);

export const MATRIX_IDOR = new Set([
  "assignments.ts :: updateAssignment",
  "assignments.ts :: updateAssignmentOdtFolio",
  "assignment-items.ts :: createAssignmentItem",
  "assignment-items.ts :: deleteAssignmentItem",
  "assignment-activities.ts :: createAssignmentActivity",
  "assignment-activities.ts :: updateAssignmentActivity",
  "incidents.ts :: createIncident",
  "incidents.ts :: updateIncident",
  "lines.ts :: createLine",
  "lines.ts :: updateLine",
  "lines.ts :: deleteLine",
  "equipments.ts :: createEquipment",
  "equipments.ts :: updateEquipment",
]);

export const MATRIX_COMPOSE = new Set([
  "incident-program.ts :: getScheduleOptions",
  "incident-program.ts :: getIncidentProgramReport",
]);

export const MATRIX_ROUTES = new Set(["app/api/schedules/route.ts :: GET"]);

export const MATRIX_CONCURRENCY = new Set([
  "mail/outbox.ts :: retryDueEmails",
  "vehicle-trips.ts :: startVehicleTrip",
]);

export const MATRIX_ALL = new Set([
  ...MATRIX_SCOPE,
  ...MATRIX_IDOR,
  ...MATRIX_COMPOSE,
  ...MATRIX_CONCURRENCY,
]);

/**
 * Tenant/id actions with no matrix case yet. Categories mirror the Fase 0c
 * access contract: global catalogs and own-user rows are legitimately out;
 * anything else carries a TODO to promote it once its guards land.
 */
export const ALLOWLIST: Record<string, string> = {
  // Global catalogs: no Client dimension anywhere in their schema.
  "holidays.ts :: getHolidays": "global catalog: system-wide dates",
  "holidays.ts :: getHolidayById": "global catalog: system-wide dates",
  "holidays.ts :: createHoliday": "global catalog: system-wide dates",
  "holidays.ts :: updateHoliday": "global catalog: system-wide dates",
  "holidays.ts :: deleteHoliday": "global catalog: system-wide dates",
  "lookups.ts :: getStateById": "global catalog: shared lookup tables",
  "lookups.ts :: updateState": "global catalog: shared lookup tables",
  "lookups.ts :: deleteState": "global catalog: shared lookup tables",
  "lookups.ts :: getUserStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateUserStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteUserStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getIncidentTypeById": "global catalog: shared lookup tables",
  "lookups.ts :: updateIncidentType": "global catalog: shared lookup tables",
  "lookups.ts :: deleteIncidentType": "global catalog: shared lookup tables",
  "lookups.ts :: getIncidentStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateIncidentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteIncidentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getAssignmentStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateAssignmentStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deleteAssignmentStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: getEquipmentStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateEquipmentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteEquipmentStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getVehicleStatusById": "global catalog: shared lookup tables",
  "lookups.ts :: updateVehicleStatus": "global catalog: shared lookup tables",
  "lookups.ts :: deleteVehicleStatus": "global catalog: shared lookup tables",
  "lookups.ts :: getVehicleTripStatusById":
    "global catalog: shared lookup tables",
  "lookups.ts :: updateVehicleTripStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deleteVehicleTripStatus":
    "global catalog: shared lookup tables",
  "lookups.ts :: deletePermission":
    "permission catalog admin: global, ROOT-administered",
  "vacation-accrual-rules.ts :: getAccrualRuleById":
    "global config: accrual rules apply to everyone",
  "vacation-accrual-rules.ts :: updateAccrualRule":
    "global config: accrual rules apply to everyone",
  "vacation-accrual-rules.ts :: deleteAccrualRule":
    "global config: accrual rules apply to everyone",
  "vehicles.ts :: getVehicleById":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: updateVehicle":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: deleteVehicle":
    "global catalog: the fleet has no Client dimension",
  "vehicles.ts :: updateVehicleStatus":
    "global catalog: the fleet has no Client dimension",
  "broadcasts.ts :: updateBroadcast":
    "global: broadcasts target roles, no Client dimension",
  "broadcasts.ts :: listBroadcasts":
    "global: broadcast listing resolves audience from roles, no Client dimension",
  "broadcasts.ts :: cancelBroadcast":
    "global: broadcasts target roles, no Client dimension",
  "broadcasts.ts :: getRoleBroadcastTargets":
    "role broadcast config: targets are roles, no Client dimension",
  "broadcasts.ts :: setRoleBroadcastTargets":
    "role broadcast config: targets are roles, no Client dimension",
  "broadcasts.ts :: searchBroadcastRecipients":
    "scoped: recipient search returns only in-reach users (reachable role + shared Client), covered in broadcasts-users.int.test.ts",
  "notification-settings.ts :: retryFailedEmail":
    "global ops: email outbox retry, no Client dimension",
  "vacations.ts :: updatePeriodOverride":
    "global payroll config: accrual periods, no Client dimension",
  // Own data: ownership enforced with the caller's id.
  "notifications.ts :: markNotificationAsRead":
    "own data: ownership enforced with user.id in the notification service",
  "notifications.ts :: deleteMyNotification":
    "own data: ownership enforced with user.id in the notification service",
  "home-personal.ts :: getMyWorkSummary": "own data: assignee rows of user.id",
  "home-personal.ts :: getMyActiveTrip": "own data: fsrId is user.id",
  "home-personal.ts :: getMyReportsSummary":
    "own data: reportedById is user.id",
  "home-personal.ts :: getMyVacationSummary":
    "own data: vacation rows of user.id",
  "users.ts :: getMyProfile": "own data: filtered by user.id",
  "users.ts :: updateMyProfile": "own data: filtered by user.id",
  "users.ts :: updateMyPassword": "own data: filtered by user.id",
  "incidents.ts :: getMyIncidents": "own data: assignee rows of user.id",
  "assignments.ts :: getMyAssignments": "own data: assignee rows of user.id",
  "vehicle-trips.ts :: getMyVehicleTrips": "own data: fsrId is user.id",
  "vehicle-trips.ts :: getMyAssignmentsForTrips":
    "own data: assignee rows of user.id",
  // Vacation administration: per-user rows, no Client dimension.
  "vacations.ts :: getVacations":
    "vacation flows; vacations have no Client dimension",
  "vacations.ts :: getVacationById":
    "vacation flows; vacations have no Client dimension",
  "vacations.ts :: deleteVacation":
    "vacation flows; vacations have no Client dimension",
  "vacations.ts :: getVacationBalanceData":
    "vacation flows; vacations have no Client dimension",
  "vacations.ts :: createVacation":
    "vacation flows; vacations have no Client dimension",
  "vacations.ts :: approveVacation":
    "vacation admin flow (vacations:approve); vacations have no Client dimension",
  "vacations.ts :: rejectVacation":
    "vacation admin flow (vacations:approve); vacations have no Client dimension",
  "vacations.ts :: getVacationApprovalConflicts":
    "vacation approval helper (vacations:approve); conflict check over assignee userIds",
  // User and role administration: global rows (users:read scoping is
  // product decision #1, pending).
  "users.ts :: createUser": "user administration: global rows",
  "users.ts :: updateUser": "user administration: global rows",
  "users.ts :: updateUserEmployment": "user administration: global rows",
  "users.ts :: deleteUser": "user administration: global rows",
  "roles.ts :: getRoleById": "role administration: global rows",
  "roles.ts :: updateRole": "role administration: global rows",
  "roles.ts :: deleteRole": "role administration: global rows",
  "roles.ts :: assignPermissionsToRole": "role administration: global rows",
  // User pickers for admin forms (users:read scoping is decision #1, pending).
  "incidents.ts :: getFsrsForAssignment":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  "clients.ts :: getFSRUsers":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  "clients.ts :: getReporterUsers":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  "tracking.ts :: getTrackingFsrs":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  "vehicles.ts :: getFsrUsersForAssignment":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  "vacations.ts :: getEmployeesForVacations":
    "user picker for admin forms; TODO(0c): scope with users:read decision",
  // Aggregate readers: tenant-scoped through report-scope helpers, but with
  // no matrix case of their own yet.
  "dashboard.ts :: getDashboardStats":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getFSRPerformanceData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getAssignmentStatusData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getIncidentTrendData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getIncidentsByTypeData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getSlaBreachData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getVehicleTripTrendData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getVehicleTripsByFSRData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getReportSummary":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getAssignmentAgingData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getSeenTimeData":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getNotificationEngagementReport":
    "aggregate reader; TODO: promote to scope matrix",
  "reports.ts :: getDailyTripComplianceReport":
    "aggregate reader; TODO: promote to scope matrix",
  "home-operations.ts :: getTrackingQueue":
    "aggregate reader; TODO: promote to scope matrix",
  "home-operations.ts :: getOperationalKpis":
    "aggregate reader; TODO: promote to scope matrix",
  "home-operations.ts :: getIncidentsByStatus":
    "aggregate reader; TODO: promote to scope matrix",
  "home-operations.ts :: getUpcomingSchedules":
    "aggregate reader; TODO: promote to scope matrix",
  "home-personal.ts :: getPendingVacationApprovals":
    "vacation approval queue (vacations:approve); TODO: promote to scope matrix",
  "home-personal.ts :: getUpcomingAbsences":
    "absence reader; TODO: promote to scope matrix",
  // Writes with an id that the IDOR matrix does not cover yet: each needs
  // its Fase 0c guard first, then a matrix case.
  "assignments.ts :: createAssignment":
    "TODO(0c): guard incident scope, then IDOR case",
  "assignments.ts :: deleteAssignment": "TODO(0c): guard scope, then IDOR case",
  "assignments.ts :: markAssignmentSeen":
    "TODO(0c): worker guard, then IDOR case",
  "assignments.ts :: startAssignmentWork":
    "TODO(0c): worker guard, then IDOR case",
  "assignments.ts :: pauseAssignment": "TODO(0c): worker guard, then IDOR case",
  "assignments.ts :: resumeAssignment":
    "TODO(0c): worker guard, then IDOR case",
  "assignments.ts :: closeAssignment": "TODO(0c): worker guard, then IDOR case",
  "assignments.ts :: reopenAssignment": "TODO(0c): guard scope, then IDOR case",
  "assignments.ts :: uploadAssignmentAttachment":
    "TODO(0c): guard scope, then IDOR case",
  "assignments.ts :: deleteAssignmentAttachment":
    "TODO(0c): guard scope, then IDOR case",
  "assignments.ts :: updateAssignmentStatus":
    "TODO(0c): manager guard, then IDOR case",
  "assignment-activities.ts :: deleteAssignmentActivity":
    "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: getIncidentEvents":
    "TODO(0c): guard incident scope, then matrix case",
  "incidents.ts :: createIncidentAsReporter":
    "TODO(0c): cross-reference guards, then IDOR case",
  "incidents.ts :: updateIncidentFsrs": "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: updateIncidentScheduledDate":
    "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: updateIncidentType": "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: deleteIncident": "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: cancelIncident": "TODO(0c): guard scope, then IDOR case",
  "incidents.ts :: getIncidentFormOptions":
    "TODO(0c): form options; scope with client options",
  "assignments.ts :: getAssignmentFormOptions":
    "TODO(0c): form options; scope with client options",
  "users.ts :: getUserFormOptions":
    "TODO(0c): form options; scope with users:read decision",
  "schedules.ts :: createSchedule":
    "TODO(0c): guard client links, then IDOR case",
  "schedules.ts :: updateSchedule":
    "TODO(0c): guard client links, then IDOR case",
  "schedules.ts :: quickUpdateSchedule":
    "TODO(0c): guard scope, then IDOR case",
  "schedules.ts :: deleteSchedule": "TODO(0c): guard scope, then IDOR case",
  "schedules.ts :: getClientsForSchedules": "TODO(0c): scope client options",
  "tracking.ts :: getTrackingSignature":
    "same where-builder as getIncidentsForTracking, covered through it",
  "tracking.ts :: assignFSRToIncident": "TODO(0c): guard scope, then IDOR case",
  "tracking.ts :: updateAssignmentAssignees":
    "TODO(0c): guard scope, then IDOR case",
  "tracking.ts :: updateIncidentDetails":
    "TODO(0c): guard scope, then IDOR case",
  "tracking.ts :: overrideIncidentStatus":
    "TODO(0c): guard scope, then IDOR case",
  "tracking.ts :: updateAssignmentDetails":
    "TODO(0c): guard scope, then IDOR case",
  "tracking.ts :: getTrackingBootstrap":
    "TODO(0c): bootstrap reader; scope then matrix case",
  "lines.ts :: toggleLineStatus": "TODO(0c): guard scope, then IDOR case",
  "equipments.ts :: deleteEquipment": "TODO(0c): guard scope, then IDOR case",
  "equipments.ts :: toggleEquipmentStatus":
    "TODO(0c): guard scope, then IDOR case",
  "clients.ts :: createClient": "TODO(0c): global create, then matrix case",
  "clients.ts :: updateClient": "TODO(0c): guard scope, then IDOR case",
  "clients.ts :: deleteClient": "TODO(0c): guard scope, then IDOR case",
  "vehicle-trips.ts :: endVehicleTrip": "TODO(0c): guard scope, then IDOR case",
  "vehicle-trips.ts :: updateVehicleTrip":
    "TODO(0c): guard scope, then IDOR case",
  "vehicle-trips.ts :: deleteVehicleTrip":
    "TODO(0c): guard scope, then IDOR case",
  "vehicle-trips.ts :: getAvailableVehicles":
    "TODO(0c): vehicle picker; scope then matrix case",
  "incident-attachments.ts :: uploadIncidentAttachment":
    "TODO(0c): guard scope, then IDOR case",
  "incident-attachments.ts :: deleteIncidentAttachment":
    "TODO(0c): guard scope, then IDOR case",
  "incidents-bulk.ts :: getBulkIncidentCatalogs":
    "TODO(0c): bulk flow; scope catalogs",
  "incidents-bulk.ts :: resolveBulkIncidentRows":
    "TODO(0c): bulk flow; scope rows",
  "incidents-bulk.ts :: createIncidentsFromPreview":
    "TODO(0c): bulk flow; scope creation",
  "incidents-bulk.ts :: bulkAssignIncidents":
    "TODO(0c): bulk flow; scope assignment",
};

/** Matrix entries whose test is `it.fails` until the noted fix lands.
 *
 * Three markers for genuinely unmerged work (everything else flipped to a
 * plain `it` when 0a/0b/0c/5a merged). Keep the export (and the
 * dangling-key test) so the next known gap registers here instead of
 * silently shipping without a case.
 */
export const EXPECTED_FAIL: Record<string, string> = {
  // Reads with no Client scope yet (0c remainder).
  "schedules.ts :: getScheduleById": "TODO(0c): no scope check",
  // users:read scoping is pending product decision #1.
  "users.ts :: getUsers": "TODO(users-scope): no scope filter",
  "users.ts :: getUserById": "TODO(users-scope): no scope check",
};
