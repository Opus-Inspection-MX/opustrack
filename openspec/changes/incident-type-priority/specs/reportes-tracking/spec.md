# Delta for Reportes, Tracking y Dashboard (Domain 09)

> Change: `incident-type-priority` | RF range: RF-500–RF-549 | Spec file: spec/09-reportes-tracking.md

---

## MODIFIED Requirements

### Requirement: RF-500 · Dashboard administrativo

The system MUST provide an administrative dashboard with real-time operational metrics.

The dashboard MUST execute 6 parallel queries (`Promise.all`) for: `totalUsers`, `activeIncidents`, `openAssignments`, `scheduledTasks`, `recentIncidents`, and `pendingAssignments` (all unchanged).

Additionally, the dashboard MUST compute `criticalIncidents` as a **separate, distinct query** that counts active incidents whose `IncidentType.priority >= CRITICAL_PRIORITY_THRESHOLD` and whose status is not `CERRADO`. The `criticalIncidents` count MUST NOT duplicate or reuse the `activeIncidents` query.

(Previously: `criticalIncidents` was computed using the same query as `activeIncidents`, producing an always-equal and therefore meaningless value. Documented as a known bug in spec/00-overview.md deuda técnica.)

**Rules:**

- Requires permission `dashboard:view` (unchanged).
- `criticalIncidents` MUST use the constant `CRITICAL_PRIORITY_THRESHOLD` (not a hardcoded literal) in the filter.
- `criticalIncidents` filters: `active: true`, `status.name != "CERRADO"`, `type.priority >= CRITICAL_PRIORITY_THRESHOLD`.
- The result of `criticalIncidents` MAY equal `activeIncidents` only if all currently active incidents happen to have `type.priority >= 8`; that is a valid coincidence, not a bug.
- `recentIncidents` SHOULD include `type.priority` in the include clause so the badge can be rendered in the dashboard's recent incidents list.

**Implementation:** `getDashboardStats()` in `src/lib/actions/dashboard.ts`

#### Scenario: criticalIncidents is distinct from activeIncidents

- GIVEN 10 active non-CERRADO incidents: 3 with `type.priority >= 8`, 7 with `type.priority < 8`
- WHEN the dashboard stats are loaded
- THEN `activeIncidents = 10`
- AND `criticalIncidents = 3`

#### Scenario: criticalIncidents respects the CERRADO exclusion

- GIVEN 5 incidents with `type.priority = 9`: 3 with status `EN_PROGRESO`, 2 with status `CERRADO`
- WHEN the dashboard stats are loaded
- THEN `criticalIncidents = 3` (the 2 CERRADO incidents are excluded)

#### Scenario: criticalIncidents is zero when no high-priority incidents are active

- GIVEN all active incidents have `type.priority <= 7`
- WHEN the dashboard stats are loaded
- THEN `criticalIncidents = 0`
- AND `activeIncidents > 0` (confirming the two values are independent)

---

### Requirement: RF-513 · Módulo de tracking — vista de seguimiento de incidentes

The system MUST provide a centralized real-time tracking view for the administrator to monitor and manage incidents and their assignments.

Each incident row in the tracking view MUST display a numeric priority badge sourced from `type.priority`.

(Previously: `type.priority` was not included in the tracking data or UI; no priority badge was shown.)

**Rules:**

- Requires permissions `tracking:read` and `tracking:update` (unchanged).
- The `getIncidentsForTracking()` query MUST include `type { priority }` in the Prisma include clause so that `priority` is available to the UI.
- All existing filter behaviors (clienteId, typeId, statusId, date range, assignedFsrId, folio search) are unchanged.
- The query uses `TRACKING_MAX_RESULTS` (200) as its `take` limit. If the total matching count exceeds that value, the UI shows a truncation indicator. (The previous `take: 500` was replaced by the `tracking-pagination` change.)
- Incident rows MUST render the numeric priority badge alongside the existing type and status indicators.

#### Scenario: Tracking query returns priority data

- GIVEN one or more active incidents loaded in the tracking view
- WHEN the tracking data is fetched
- THEN each incident object includes `type.priority`
- AND the UI renders a numeric badge with that value on each row

#### Scenario: Folio search scenario (unchanged — reproduced for completeness)

- GIVEN the admin enters "42" in the folio field
- WHEN the search executes
- THEN the system uses `OR [{ id: 42 }, { assignments: { some: { folio: 42 } } }]`
- AND matching incidents are returned with their `type.priority` included

---

### Requirement: RF-503 · Reporte de tendencia de incidentes

The system MUST provide a daily time-series report of incidents created and resolved in the selected period.

Report rows MUST expose `type.priority` so the UI can display the priority badge for incidents included in the trend data.

(Previously: `type.priority` was not included in the trend report data; no priority information was surfaced.)

**Rules:**

- The aggregation logic (group by `reportedAt` date, count created and resolved) is unchanged.
- The `typeIds[]` filter is unchanged.
- When incident-level detail rows are returned (not just aggregates), each row MUST include `type.priority`.
- The badge MUST display the numeric value only; no label is added.

#### Scenario: Trend report includes priority for detail rows

- GIVEN incidents of types with various priorities exist in the selected date range
- WHEN the trend report is rendered
- THEN each incident detail entry shows its numeric priority badge

---

### Requirement: RF-504 · Reporte de distribución de incidentes por tipo

The system MUST provide a percentage breakdown of active incidents in the period by type.

Report output for each type MUST include its `priority` value so the priority badge can be rendered alongside the type name.

(Previously: `type.priority` was not included in distribution report data.)

**Rules:**

- Grouping, percentage calculation, and anti-division-by-zero logic are unchanged.
- The `typeIds[]` filter is unchanged.
- Each type entry in the result MUST include `priority` from `IncidentType`.

#### Scenario: Distribution report includes priority per type

- GIVEN multiple `IncidentType` records with different priorities
- WHEN the distribution report is rendered
- THEN each type entry displays its numeric priority badge alongside the type name and percentage
