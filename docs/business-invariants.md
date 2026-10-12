# Business invariants: policy, evidence, and deployment

Business mutations must preserve balances, tenant boundaries, physical evidence,
and derived state even when requests race or are replayed. Domain requirements
remain authoritative in [`spec/`](../spec/00-overview.md); this guide maps them
to implementation and tests and provides a read-only deployment review.

## Product policy and rationale

| Policy | Contract and rationale |
| --- | --- |
| Earned calendar grants | Calendar periods cover January–December in `America/Mexico_City`; entitlement activates on the hire anniversary, not January 1. The hire year grants nothing; February 29 anniversaries fall back to February 28 in non-leap years. Future grants cannot fund requests, even when imported. This prevents spending unearned entitlement. |
| Preserve legacy accounts | `cycleYear IS NULL` identifies anniversary-mode periods. Legacy-only accounts remain legacy; calendar-only/new accounts use calendar mode. Mixed accounts fail closed pending explicit reconciliation. Period identity, entitlement and grace snapshots are not silently converted or refreshed. |
| Reserve before approval | Active `PENDIENTE` and `APROBADA` requests reserve their snapshotted cost. Approval does not spend twice; rejection releases the reservation. A grant override cannot fall below consumption, including reviewed historical consumption. |
| Stable charge evidence | New requests store immutable `chargedDates` and initial `businessDaysUsed`. Later holiday edits cannot rewrite historical cost. After an authorized shortening, cost is the count of original charged dates through the new end date; the original array remains unchanged. |
| Correct rather than erase | An approved, started vacation cannot be cancelled to refund consumed days. `correctStartedVacation` requires `vacations:manage`, a reason, and a strictly shorter end date that retains today and every earlier day. Start, funding period, approval, original request reason, and charge snapshot survive. Only future days are released. After commit, `vacation_corrected` tells the requester that approval remains and the absence was shortened, excluding the actor; it never emits a cancellation notice. Channels are matrix-configurable, defaulting to in-app only without a production seed or migration. |
| Explicit historical review | A legacy vacation without dated charge evidence requires an explicit reviewed consumed-day count for shortening; a missing aggregate cost blocks correction. Today's holiday catalog cannot reconstruct yesterday's evidence. Historical aggregate consumption is not a dated absence and does not create vacations or suppress daily-trip obligations. |
| Auditable corrections | `BusinessCorrection` is append-only: entity, actor, separate correction reason, and JSON `before`/`after` snapshots commit atomically with the correction. Do not embed the correction reason into request notes or rewrite prior audit snapshots. |
| Operational state versus occupancy | Vehicle operational state (`AVAILABLE`, `MAINTENANCE`, `INACTIVE`) survives occupancy (`IN_USE`). An active vehicle and a driver may each have at most one active `EN_CURSO` trip, including administrators. Winning end/cancel releases occupancy to the current operational state. |
| Physical odometer epochs | `correctVehicleOdometer` requires `vehicles:update` and `vehicle-trips:manage-all`, a reason, and no open trip. A new baseline/time permits replacement-meter readings, including zero, without rewriting old readings/photos. Captures before the new epoch cannot establish a new trip in it; subsequent observations constrain the next start. |
| Preserve cancelled evidence | Cancellation is a terminal trip outcome with reason/time, not invented completion. Photos, readings, GPS, captures and notes survive; no final reading or distance is fabricated. |
| Fair compliance denominator | Eligible days are Monday–Saturday in CDMX, excluding future days, holidays and approved dated vacations. Zero eligible days means `N/A` (null rate), not 0% or 100%; these rows are excluded from eligible-row averages. |
| Authorization survives retry | A receipt binds actor, action and requested target. Current permissions, ownership/scope and live target access still apply. Matching receipts return the live target without reapplying a transition or notifications; receipts are evidence of a prior commit, never authority. |

## Requirement → routes/mutations → tests

Paths below identify entry points, not permission grants. Unit paths are relative
to `src/lib/`; integration paths are relative to `src/test/integration/`.

| Requirement / invariant | Routes and mutations | Evidence |
| --- | --- | --- |
| Spec 10: earned grants, legacy separation, February 29, funding selection | `/vacations`, `/admin/vacations`; `ensurePeriodsUpToNow`, `resolveVacationPeriod`, `createVacation` | `services/vacation-periods.test.ts`, `utils/vacation-cycle-window.test.ts`, `actions/vacations-create.test.ts` |
| Spec 10: reservation and decision atomicity | Vacation forms and approval actions; `createVacation`, `approveVacation`, `rejectVacation`, `updatePeriodOverride` | `business-invariants.int.test.ts`: last-day competing reservations, approve/reject race, reservation/override race; `actions/vacations-decisions.test.ts`, `actions/vacations-override.test.ts` |
| Spec 10: started-vacation correction and immutable evidence | `/admin/vacations`; `deleteVacation`, `correctStartedVacation` | `business-invariants.int.test.ts`: concurrent shortening preserves approval/reason/charge array and creates one correction; `actions/vacations-correction.test.ts`, `actions/vacations-cancel.test.ts` |
| RF-260 / RF-261: bound replay and frozen capture | `/fsr/assignments/[id]`, `/fsr/vehicle-trips/start`, `/fsr/vehicle-trips/[id]/end`; `startAssignmentWork`, `closeAssignment`, `startVehicleTrip`, `endVehicleTrip` | `offline/idempotency.test.ts`, `actions/assignments-idempotency.test.ts`, `actions/assignments-offline.test.ts`, `actions/vehicle-trips-offline.test.ts`; integration same-key convergence and actor/action/vehicle mismatch |
| Spec 06 / RF-366 / RF-367: occupancy, cancellation, epochs | `/admin/vehicles/[id]`, trip routes; `startVehicleTrip`, `endVehicleTrip`, `cancelVehicleTrip`, `deleteVehicle`, `correctVehicleOdometer` | `business-invariants.int.test.ts`: vehicle/driver occupancy, close/close, close/cancel, start/delete, start/correction races and replacement epoch; `actions/vehicles.test.ts`, `actions/vehicle-trips-concurrency.test.ts` |
| Specs 03–05: canonical composition and derived incident state | `/api/incidents`, `/admin/tracking`, assignment actions; `createIncident`, `createAssignment`, `updateAssignmentAssignees`, assignment transitions, activity mutations | `actions/assignments-build.test.ts`, `actions/incidents-scope.test.ts`, `actions/assignment-activities.test.ts`, `src/app/api/incidents/route.test.ts`; integration final sibling closures produce one incident close event |
| Spec 07 / tenant scope: active references and scoped schedule children | `/admin/programacion`, schedule APIs; schedule create/update/detail and incident composition | `actions/schedules.test.ts`, `actions/tracking.test.ts`; `scope-matrix.int.test.ts` shared-schedule detail independently scopes children; `scope-compose.int.test.ts` composed filters |
| Spec 09: eligible-day compliance | `/admin/reports/daily-trip-compliance`; `getDailyTripComplianceReport` | `actions/reports-trips.test.ts`, `actions/reports.test.ts`, `src/app/admin/reports/daily-trip-compliance/daily-trip-compliance-report-client.test.tsx` |
| Cross-domain: bounded retries and committed notifications | `serializableTransaction`, `transactionWithNotifications` | `database/serializable-transaction.test.ts`, `notifications/after-commit.test.ts`; real overlapping transactions in `business-invariants.int.test.ts` |
| RF-708: unambiguous accrual intervals | `/admin/settings/vacation-accrual`; `createAccrualRule`, `updateAccrualRule`, `deleteAccrualRule` | `actions/vacation-accrual-rules.test.ts`; concurrent distinct-start overlapping rules in `business-invariants.int.test.ts` |
| Complete UI lifecycle and correction notices | Vacation, fleet and trip screens; request/approve/shorten, start/cancel/end, replacement odometer | `e2e/business-invariants.spec.ts`; `e2e/vacations.spec.ts`; `notifications/notify-vacation-corrected.test.ts` |
| Executable reconciliation and append-only corrections | Documented SQL batch; database correction trigger | `business-reconciliation.int.test.ts` executes every anomaly read in a read-only snapshot and verifies UPDATE/DELETE rejection |

The integration suite uses real PostgreSQL queries/commits and barriers on first
attempt reads; retries bypass the barriers. Its registry includes only exercised
actions (`MATRIX_BUSINESS_INVARIANTS` in `coverage.ts`). Scope coverage separately
checks tenant A/B, no membership, operations-wide and ROOT readers, ownership,
and password-free projections. Neither a route name nor a registry entry alone
proves an invariant.

### Verification status for this change

Verified on 2026-10-12 against the disposable PostgreSQL 17 stack:

| Check | Result |
| --- | --- |
| `npm run check` | Passed: Biome, TypeScript and unused-file checks |
| `npm run test:unit` | 1,594 tests passed in 152 files |
| `npm run test:int` | 119 tests passed in 11 files; 17 cases in the business-invariant suite, including its registration case |
| Production build | Passed through the production-mode E2E runner |
| Selected desktop flows | 38 passed, one pre-existing XOR-holiday test omitted; includes all three new business-invariant UI journeys |
| Offline mobile capture | All eight domain scenarios passed, including replay, stale/conflicting drafts and trip photos |
| Vacation browser scenarios | All ten exercised successfully across the suite run and corrected targeted RBAC rerun; all previous vacation fixmes removed |
| Reconciliation SQL | Executed successfully in a read-only PostgreSQL snapshot |

Browser setup cases are included in runner totals; do not add totals from
separate runs as distinct scenario counts. These are selected Chromium desktop
and mobile flows, not a claim that every browser/project was executed.
Production was not accessed during implementation verification. The subsequent
authorized production migration is recorded below.

## Transaction and replay contract

- Invariant reads and writes use the same transaction client: active parents,
  tenant membership/composition, availability, balances and terminal transitions
  cannot be accepted from stale preflight reads.
- `serializableTransaction` retries only `P2034`, for at most **four total
  attempts**, with 25/50/100 ms delays. Each attempt has a 15 s transaction
  timeout and 5 s acquisition wait; 15 s is not an overall request deadline.
- Retry callbacks contain database work only. Uploads/external effects must not
  multiply with attempts. `transactionWithNotifications` creates an isolated
  collector per attempt and flushes only the winning committed collector.
  Rollbacks and matching replays do not re-fire notifications.
- Online-first trip forms create their key/capture identity before the first
  send and retain it for retries. A replay key identifies an operation, not a
  payload merge: changed evidence does not overwrite the committed outcome.
  Assignment start/close capture also fixes this identity before sending.
  Trip forms block a second operation while their draft is queued; explicitly
  discarding the draft unlocks a new capture with a new identity.
- `startCapturedAt` and `endCapturedAt` retain separate field observation times;
  `startedAt`/`endedAt` are server lifecycle times. Capture freshness is 24 hours
  with up to five minutes of future clock tolerance. Sending never recaptures
  evidence to make it appear fresh.
- A key reused by another actor, action or requested target conflicts. Legacy
  receipts missing actor/target binding intentionally fail closed and require
  manual review. Do not delete them or silently mint replacement keys to force
  the original operation through.

## Deployment: expand → migrate → app → read-only reconciliation

### Production migration record — 2026-10-12

- Applied `20261012000000_business_invariants` through `db:prod:migrate`.
- Confirmed that the production migration history is up to date.
- Executed all eleven documented reconciliation reads in a read-only snapshot;
  none returned anomalies.
- Confirmed that the production permission catalog and role grants agree with
  the shared source catalog.
- Existing operational row counts were unchanged. No reset, private seed or
  data-repair operation was executed.

This records the database rollout. Publishing the application is the next step;
database migration status alone does not establish application deployment status.

1. Apply the additive migration through the existing production migration
   workflow **before publishing the application that reads the new fields**.
   This change-specific ordering supersedes a generic app-before-migration
   sequence. Deploy the matching generated client/application after expansion.
2. Run the read-only queries below against the intended deployed database and
   retain the results with the deployment record. They identify review work;
   they do not perform repair or prove that all data is valid.
3. Reconcile reported rows explicitly through reviewed product corrections or
   a separately reviewed data-reconciliation operation. Re-run the reads after
   reconciliation. Do not automatically reset, seed, convert period modes,
   refund consumption, rewrite trip evidence or resynchronize incidents.

The migration preserves operational `MAINTENANCE`/`INACTIVE` status and adds
nullable trip capture/epoch fields, an empty default charge-date array, nullable
receipt bindings, and the corrections table. Historical rows lack field capture
or day snapshots: null/empty means **unknown**, not evidence of zero use. Do not
fabricate timestamps, charged dates, receipt actors or correction history from
current catalogs during migration.

The `business_corrections_append_only` database trigger rejects UPDATE and DELETE
of correction receipts, including direct ORM writes. Subsequent corrections
append a new row. Both the private `initial_load/seed.ts` and tracked full-seed
loader already consume `PERMISSION_LIST` / `resolveSeedGrants` and
`defaultChannelPolicies`; this change adds no role grants and requires no
private-data seed rewrite. `vacation_corrected` uses the shared policy registry
and has catalog defaults even when its policy row has not yet been seeded.

### Rollback compatibility

The schema expansion is additive, so a prior app can structurally read its old
columns; this is not semantic compatibility with every old mutation. An old app
does not enforce epochs, bound receipts or corrected consumption. Before rolling
back, prevent affected writes or use a compatibility release that preserves
these invariants. Retain the new columns, `business_corrections` snapshots and
new receipts; do not reverse the migration by dropping evidence. Review old
replay conflicts manually rather than making legacy bindings permissive.

## Read-only reconciliation SQL

Use the exact physical names from `prisma/schema.prisma`: fleet/incident tables
are quoted PascalCase; vacation and replay tables are mapped snake_case, while
their field names remain quoted camelCase. Run this batch in a read-only
transaction. CDMX date conversion uses UTC explicitly because Prisma stores
these instants in timestamp-without-time-zone columns.

```sql
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;

-- Mixed funding identities: these accounts require explicit reconciliation.
SELECT "userId", count(*) FILTER (WHERE "cycleYear" IS NULL) AS legacy,
       count(*) FILTER (WHERE "cycleYear" IS NOT NULL) AS calendar
FROM vacation_periods GROUP BY "userId"
HAVING bool_or("cycleYear" IS NULL) AND bool_or("cycleYear" IS NOT NULL);

-- Negative balances, including approved, verified historical consumption.
WITH dated AS (
  SELECT v."periodId", sum(v."businessDaysUsed") AS used
  FROM vacations v JOIN vacation_statuses s ON s.id = v."statusId"
  WHERE v.active AND s.code IN ('PENDIENTE', 'APROBADA')
  GROUP BY v."periodId"
), historical AS (
  SELECT "fundingPeriodId", sum("sourceTakenDays") AS used
  FROM historical_vacation_consumption
  WHERE "reviewStatus" = 'APPROVED' AND "identityVerified"
  GROUP BY "fundingPeriodId"
)
SELECT p.id, p."userId", p."cycleYear",
       coalesce(p."overrideDays", p."ruleDays") AS granted,
       coalesce(d.used, 0) AS dated_used, coalesce(h.used, 0) AS historical_used,
       coalesce(p."overrideDays", p."ruleDays")
         - coalesce(d.used, 0) - coalesce(h.used, 0) AS remaining
FROM vacation_periods p LEFT JOIN dated d ON d."periodId" = p.id
LEFT JOIN historical h ON h."fundingPeriodId" = p.id
WHERE coalesce(p."overrideDays", p."ruleDays")
      < coalesce(d.used, 0) + coalesce(h.used, 0);

-- Missing costs/links are unknown, not zero; inspect separately from totals.
SELECT v.id, v."userId", v."periodId", v."businessDaysUsed",
       cardinality(v."chargedDates") AS snapshot_dates
FROM vacations v JOIN vacation_statuses s ON s.id = v."statusId"
WHERE v.active AND s.code IN ('PENDIENTE', 'APROBADA')
  AND (v."periodId" IS NULL OR v."businessDaysUsed" IS NULL
       OR v."businessDaysUsed" < 0 OR cardinality(v."chargedDates") = 0);

-- Snapshot cost through the CURRENT end; original arrays survive shortening.
SELECT v.id, v."businessDaysUsed", counted.retained AS snapshot_cost
FROM vacations v CROSS JOIN LATERAL (
  SELECT count(*) AS retained FROM unnest(v."chargedDates") AS charged(day)
  WHERE charged.day <= to_char(
    v."endDate" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD')
) counted
WHERE v.active AND cardinality(v."chargedDates") > 0
  AND (v."businessDaysUsed" IS DISTINCT FROM counted.retained
       OR cardinality(v."chargedDates") <> (
         SELECT count(DISTINCT day) FROM unnest(v."chargedDates") AS charged(day)));

-- Reviewed historical inputs must be internally consistent and correctly funded.
SELECT h.id, h."userId", h."cycleYear", h."fundingPeriodId"
FROM historical_vacation_consumption h
LEFT JOIN vacation_periods p ON p.id = h."fundingPeriodId"
WHERE h."sourceTakenDays" < 0 OR h."sourceEntitledDays" < 0
   OR h."sourceRemainingDays" < 0 OR h."allocatedToDatedDays" <> 0
   OR (h."reviewStatus" = 'APPROVED' AND (
       NOT h."identityVerified" OR p.id IS NULL
       OR p."userId" IS DISTINCT FROM h."userId"
       OR p."cycleYear" IS DISTINCT FROM h."cycleYear"
       OR h."sourceEntitledDays" - h."sourceTakenDays"
          <> h."sourceRemainingDays"));

-- Calendar requests funded before activation, or grants lacking activation.
SELECT p.id AS period_id, v.id AS vacation_id, p."availableFrom", v."startDate"
FROM vacation_periods p LEFT JOIN vacations v
  ON v."periodId" = p.id AND v.active
WHERE p."cycleYear" IS NOT NULL AND (p."availableFrom" IS NULL
  OR v."startDate" < p."availableFrom");

-- One open trip per vehicle AND per driver, including administrators.
WITH open_trips AS (
  SELECT t.* FROM "VehicleTrip" t
  JOIN "VehicleTripStatus" s ON s.id = t."statusId"
  WHERE t.active AND s.code = 'EN_CURSO'
)
SELECT 'vehicle' AS dimension, "vehicleId" AS entity_id, count(*) AS open_count
FROM open_trips GROUP BY "vehicleId" HAVING count(*) > 1
UNION ALL
SELECT 'driver', "fsrId", count(*) FROM open_trips
GROUP BY "fsrId" HAVING count(*) > 1;

-- Occupancy/display drift or unknown operational status.
SELECT v.id, v."operationalStatusCode", s.code AS displayed, count(t.id) AS open_count
FROM "Vehicle" v LEFT JOIN "VehicleStatus" s ON s.id = v."statusId"
LEFT JOIN "VehicleTrip" t ON t."vehicleId" = v.id AND t.active
  AND EXISTS (SELECT 1 FROM "VehicleTripStatus" ts
              WHERE ts.id = t."statusId" AND ts.code = 'EN_CURSO')
WHERE v.active GROUP BY v.id, s.code
HAVING v."operationalStatusCode" NOT IN ('AVAILABLE', 'MAINTENANCE', 'INACTIVE')
   OR s.code IS DISTINCT FROM CASE WHEN count(t.id) > 0 THEN 'IN_USE'
                                  ELSE v."operationalStatusCode" END;

-- Active operational children under inactive parents/references.
SELECT 'open-trip/vehicle' AS anomaly, t.id::text AS child_id
FROM "VehicleTrip" t JOIN "Vehicle" v ON v.id = t."vehicleId"
JOIN "VehicleTripStatus" s ON s.id = t."statusId"
WHERE t.active AND s.code = 'EN_CURSO' AND NOT v.active
UNION ALL
SELECT 'open-trip/driver', t.id FROM "VehicleTrip" t
JOIN "User" u ON u.id = t."fsrId"
JOIN "VehicleTripStatus" s ON s.id = t."statusId"
WHERE t.active AND s.code = 'EN_CURSO' AND NOT u.active
UNION ALL
SELECT 'assignment/incident', a.id FROM "Assignment" a
JOIN "Incident" i ON i.id = a."incidentId" WHERE a.active AND NOT i.active
UNION ALL
SELECT 'activity/assignment', act.id FROM "AssignmentActivity" act
JOIN "Assignment" a ON a.id = act."assignmentId" WHERE act.active AND NOT a.active
UNION ALL
SELECT 'item/assignment', item.id FROM "AssignmentItem" item
JOIN "Assignment" a ON a.id = item."assignmentId" WHERE item.active AND NOT a.active
UNION ALL
SELECT 'incident/client', i.id::text FROM "Incident" i
JOIN "Client" c ON c.id = i."clientId" WHERE i.active AND NOT c.active
UNION ALL
SELECT 'line/client', l.id::text FROM "Line" l
JOIN "Client" c ON c.id = l."clientId" WHERE l.active AND NOT c.active
UNION ALL
SELECT 'equipment/line', e.id::text FROM "Equipment" e
JOIN "Line" l ON l.id = e."lineId" WHERE e.active AND NOT l.active
UNION ALL
SELECT 'schedule-client/parent', sc."scheduleId" || '/' || sc."clientId"
FROM "ScheduleClient" sc JOIN "Schedule" s ON s.id = sc."scheduleId"
JOIN "Client" c ON c.id = sc."clientId"
WHERE sc.active AND (NOT s.active OR NOT c.active);

-- Derived incident mismatches: mirror the pure formula in state-machine/sync.ts.
-- Unknown assignment states are review anomalies, never coerced into a repair.
WITH contributions AS (
  SELECT i.id, coalesce(s.code, s.name) AS current_state, count(a.id) AS children,
    count(a.id) FILTER (WHERE coalesce(ast.code, ast.name) = 'CERRADO') AS closed,
    count(a.id) FILTER (WHERE coalesce(ast.code, ast.name) IS NULL
      OR coalesce(ast.code, ast.name) NOT IN
        ('PENDIENTE_DE_ASIGNACION','ASIGNADO','VISTO','INICIADO','EN_PROGRESO','CERRADO')) AS unknown,
    max(CASE coalesce(ast.code, ast.name)
      WHEN 'PENDIENTE_DE_ASIGNACION' THEN 0 WHEN 'ASIGNADO' THEN 1
      WHEN 'VISTO' THEN 2 WHEN 'INICIADO' THEN 3 WHEN 'EN_PROGRESO' THEN 4 END) AS rank
  FROM "Incident" i LEFT JOIN "IncidentStatus" s ON s.id = i."statusId"
  LEFT JOIN "Assignment" a ON a."incidentId" = i.id AND a.active
  LEFT JOIN "AssignmentStatus" ast ON ast.id = a."statusId"
  WHERE i.active GROUP BY i.id, s.code, s.name
), expected AS (
  SELECT *, CASE WHEN children = 0 THEN 'ABIERTO'
    WHEN closed = children THEN 'CERRADO'
    ELSE (ARRAY['ABIERTO','ASIGNADO','VISTO','INICIADO','EN_PROGRESO'])[rank + 1]
    END AS expected_state FROM contributions
)
SELECT e.*, EXISTS (SELECT 1 FROM "IncidentEvent" ev
  WHERE ev."incidentId" = e.id AND ev."eventType" = 'BULK_IMPORTED') AS bulk_imported
FROM expected e WHERE e.current_state IS DISTINCT FROM 'CANCELADA'
  AND (e.unknown > 0 OR e.current_state IS DISTINCT FROM e.expected_state)
  AND NOT (e.current_state IS NOT DISTINCT FROM 'CERRADO' AND e.children = 0
    AND EXISTS (SELECT 1 FROM "IncidentEvent" ev
      WHERE ev."incidentId" = e.id AND ev."eventType" = 'BULK_IMPORTED'));

-- Legacy receipt bindings intentionally need manual review, not backfill.
SELECT key, action, "targetId", "actorId", "requestTargetId"
FROM action_idempotency WHERE "actorId" IS NULL OR "requestTargetId" IS NULL;

ROLLBACK;
```

These are broad anomaly reads. Historical closed incidents imported without
assignments retain the explicit-reopen exception; cancellation is never derived
away. For an exact application-side diagnostic, load active assignment states
and reuse the pure `computeIncidentStateFromAssignmentStates` function, applying
those exceptions; do **not** call the mutating `syncIncidentState` during review.
