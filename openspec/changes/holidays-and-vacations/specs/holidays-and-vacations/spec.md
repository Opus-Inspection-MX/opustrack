# Holidays and Vacations Specification

> Domain: **Festivos y vacaciones** (RF-700–RF-749)
> Change: `holidays-and-vacations` | New domain — full spec, not a delta.

## Purpose

Define official non-working days (holidays) and FSR absence periods (vacations/sick leave) as
first-class domain entities. Provide a central availability helper so that assignment creation,
assignment updates, and activity registration cannot target an FSR on an unavailable date.

---

## Data models

| Entity | Key fields |
|--------|-----------|
| `Holiday` | `name`, `month`, `day?`, `nthMonday?`, `isRecurring` (default true), `year?`, `active` |
| `VacationStatus` | `name` (PENDIENTE\|APROBADA\|RECHAZADA), `color`, `active` — catalog, follows ScheduleStatus pattern |
| `Vacation` | `userId`, `startDate`, `endDate` (inclusive, day-granularity), `reason?`, `statusId`, `approvedById?`, `approvedAt?`, `active` |
| `Assignment` | **gains** `scheduledDate DateTime?` — nullable, existing rows default to null |

---

## Requirements

### RF-700 · Holiday catalog (admin CRUD)

The system MUST maintain a catalog of official Mexican non-working days (LFT Art. 74). An
ADMIN MUST be able to create, update, and soft-delete holiday entries.

Holiday rules:
- Fixed date: `month` + `day` (repeats every year when `isRecurring: true`).
- N-th Monday: `month` + `nthMonday` (1=first, 3=third) — resolved at query-time for the
  year of the date being evaluated.
- One-time sexennial: `isRecurring: false` + `year` (e.g., Transmisión del Poder Ejecutivo).
- Soft delete: `active: false`.

The seed MUST create the 8 LFT Art. 74 holidays:

| Name | Rule |
|------|------|
| Año Nuevo | fixed 1-Jan |
| Día de la Constitución | 1st Monday of Feb |
| Natalicio de Benito Juárez | 3rd Monday of Mar |
| Día del Trabajo | fixed 1-May |
| Día de la Independencia | fixed 16-Sep |
| Día de la Revolución | 3rd Monday of Nov |
| Navidad | fixed 25-Dec |
| Transmisión del Poder Ejecutivo | one-time 1-Oct (sexennial year, `isRecurring: false`) |

#### Scenario: Create fixed-date holiday

- GIVEN an authenticated ADMIN with permission `holidays:create`
- WHEN they submit a new holiday with `month: 1`, `day: 1`, `isRecurring: true`
- THEN the holiday is persisted with `active: true` and appears in the catalog

#### Scenario: Create n-th Monday holiday

- GIVEN an authenticated ADMIN with permission `holidays:create`
- WHEN they submit `month: 2`, `nthMonday: 1`, `isRecurring: true`
- THEN the holiday is persisted; `isFsrUnavailable` resolves it as the first Monday of February for any queried year

#### Scenario: Soft-delete holiday

- GIVEN an active holiday in the catalog
- WHEN the ADMIN deletes it
- THEN `active` is set to `false` and the holiday is excluded from unavailability checks

#### Scenario: Non-admin cannot manage holidays

- GIVEN an authenticated FSR
- WHEN they attempt to create, update, or delete a holiday
- THEN the action is rejected with HTTP 403 / permission error

---

### RF-701 · Vacation request (FSR creates own; ADMIN creates for any FSR)

The system MUST allow FSRs to submit vacation/absence requests for themselves. An ADMIN MUST be
able to create vacation records on behalf of any FSR (for sick leave or approved permits).

A vacation MUST be defined as an inclusive date range (`startDate`–`endDate`) with day
granularity (no hour component enforced).

On creation, the system MUST reject a new vacation if the same FSR already has a PENDING or
APPROVED vacation whose date range overlaps the new range (`startDate <= existing.endDate AND
endDate >= existing.startDate`).

#### Scenario: FSR creates own vacation

- GIVEN an authenticated FSR with permission `vacations:create`
- WHEN they submit `startDate: 2026-07-01`, `endDate: 2026-07-05`, `reason: "Summer"`
- THEN a Vacation record is created with `statusId` = PENDIENTE and `userId` = caller's userId

#### Scenario: ADMIN creates vacation for another FSR

- GIVEN an authenticated ADMIN with permission `vacations:create`
- WHEN they submit a vacation for `userId` = any FSR
- THEN the record is created with `statusId` = PENDIENTE and the specified `userId`

#### Scenario: FSR cannot create vacation for another user

- GIVEN an authenticated FSR
- WHEN they attempt to submit a vacation with `userId` different from their own
- THEN the action is rejected

#### Scenario: Overlap rejection — new vacation conflicts with PENDING

- GIVEN FSR "Alice" has a PENDING vacation from 2026-07-01 to 2026-07-10
- WHEN Alice (or an ADMIN) creates a new vacation from 2026-07-08 to 2026-07-15
- THEN the system rejects with a clear Spanish error; no record is persisted

#### Scenario: Overlap rejection — new vacation conflicts with APPROVED

- GIVEN FSR "Alice" has an APPROVED vacation from 2026-07-01 to 2026-07-10
- WHEN Alice creates a new vacation from 2026-07-03 to 2026-07-03 (single day inside)
- THEN the system rejects with a clear Spanish error; no record is persisted

#### Scenario: No overlap — adjacent ranges are allowed

- GIVEN FSR "Alice" has a vacation from 2026-07-01 to 2026-07-05
- WHEN she creates another vacation from 2026-07-06 to 2026-07-10
- THEN both vacations are persisted (ranges do not overlap)

---

### RF-702 · Vacation approval (ADMIN approves or rejects)

An ADMIN MUST be able to transition a vacation from PENDIENTE to APROBADA or RECHAZADA.
The system MUST record `approvedById` and `approvedAt`.

Approving a vacation that overlaps existing assignments for that FSR MUST succeed without
modifying or reassigning those assignments (no auto-reassignment).

#### Scenario: ADMIN approves a pending vacation

- GIVEN a vacation in status PENDIENTE
- WHEN the ADMIN calls approve
- THEN `statusId` = APROBADA, `approvedById` = admin's userId, `approvedAt` = now

#### Scenario: ADMIN rejects a pending vacation

- GIVEN a vacation in status PENDIENTE
- WHEN the ADMIN calls reject
- THEN `statusId` = RECHAZADA, `approvedById` and `approvedAt` are recorded

#### Scenario: Approve vacation overlapping existing assignments — no reassignment

- GIVEN FSR "Bob" has assignments with `scheduledDate` 2026-08-10 (within an overlapping range)
- WHEN ADMIN approves Bob's vacation from 2026-08-08 to 2026-08-15
- THEN the vacation status changes to APROBADA AND Bob's assignments remain unchanged (no modification, no error)

#### Scenario: Non-admin cannot approve or reject

- GIVEN an authenticated FSR
- WHEN they attempt to approve or reject any vacation
- THEN the action is rejected with permission error

---

### RF-703 · FSR availability helper (isFsrUnavailable)

The system MUST expose a server-side function `isFsrUnavailable(userId, date): Promise<boolean>`
that returns `true` when the given date (evaluated as a CDMX calendar day) matches either:

1. An active `Holiday` record (fixed-date or n-th-Monday rule, or one-time sexennial matching
   `year`).
2. An active `Vacation` with `statusId` = APROBADA where
   `startDate <= date <= endDate` for that `userId`.

All date comparisons MUST be performed in the **America/Mexico_City** time zone using the
project's existing `mxDayRange` / `mxDateString` utilities from `src/lib/utils/datetime.ts`.
A UTC instant MUST be converted to the CDMX calendar day before comparing against any date
fields stored in the database.

#### Scenario: Helper returns true for fixed-date holiday

- GIVEN 1 January is seeded as a fixed holiday
- WHEN `isFsrUnavailable(anyUserId, new Date("2027-01-01T10:00:00Z"))` is called
- THEN returns `true`

#### Scenario: Helper returns true for n-th Monday holiday

- GIVEN "Día de la Constitución" is seeded as 1st Monday of February
- WHEN `isFsrUnavailable(anyUserId, date)` is called where `date` is the 1st Monday of February 2027 in CDMX
- THEN returns `true`

#### Scenario: Helper returns true for approved vacation

- GIVEN FSR "Carlos" has an APPROVED vacation from 2026-09-01 to 2026-09-05
- WHEN `isFsrUnavailable("carlos-id", new Date("2026-09-03T15:00:00Z"))` is called
- THEN returns `true`

#### Scenario: Helper returns false for PENDING vacation

- GIVEN FSR "Carlos" has a PENDING (not approved) vacation from 2026-09-01 to 2026-09-05
- WHEN `isFsrUnavailable("carlos-id", new Date("2026-09-03T15:00:00Z"))` is called
- THEN returns `false` (only APPROVED vacations block)

#### Scenario: Off-by-one timezone guard

- GIVEN no holiday or approved vacation exists on 2026-12-25 CDMX (Christmas IS a holiday — use a non-holiday date, e.g. 2026-12-26)
- AND an instant `2026-12-26T01:00:00Z` = `2026-12-25T19:00:00 CDMX`
- WHEN `isFsrUnavailable(anyUserId, new Date("2026-12-26T01:00:00Z"))` is called
- THEN the system evaluates the CDMX day (25-Dec) which IS a holiday, so returns `true`
  (i.e., the UTC date 26-Dec is treated as CDMX day 25-Dec — no off-by-one)

---

### RF-704 · Hard block on assignment creation/update (scheduledDate)

When `createAssignment` or `updateAssignment` adds one or more FSRs (`toAdd` list) and the
assignment has a non-null `scheduledDate`, the system MUST call `isFsrUnavailable` for each
FSR in `toAdd`. If any FSR is unavailable on that date, the entire operation MUST be rejected
with a clear error message in neutral Spanish; no changes are persisted.

If `scheduledDate` is `null` or absent, the system MUST NOT perform the unavailability check
at assignment creation/update time (enforcement is deferred to activity registration).

#### Scenario: Block — FSR unavailable on scheduledDate

- GIVEN assignment has `scheduledDate: 2026-12-25` (Christmas, a holiday)
- AND `toAdd` contains FSR "Diana"
- WHEN `createAssignment` or `updateAssignment` is called
- THEN the system throws a Spanish error ("El FSR Diana no está disponible el 25 de diciembre...") and no assignment or assignee record is persisted

#### Scenario: Allow — scheduledDate is null

- GIVEN an assignment with `scheduledDate: null`
- AND `toAdd` contains FSR "Diana" (who has a vacation on some date)
- WHEN `createAssignment` or `updateAssignment` is called
- THEN the operation proceeds without checking availability; Diana is added normally

#### Scenario: Allow — FSR available on scheduledDate

- GIVEN assignment has `scheduledDate: 2026-12-26` (non-holiday, no approved vacation for the FSR)
- AND `toAdd` contains FSR "Diana"
- WHEN the operation is called
- THEN the FSR is added and the assignment is persisted normally

---

### RF-705 · Hard block on activity registration (performedAt)

When `createAssignmentActivity` is called, the system MUST call `isFsrUnavailable` for the
FSR author/assignee on the `performedAt` date. If the FSR is unavailable, the operation MUST
be rejected with a clear error message in neutral Spanish; the activity is not persisted.

#### Scenario: Block — FSR unavailable on performedAt

- GIVEN FSR "Elena" has an APPROVED vacation covering 2026-09-15
- WHEN `createAssignmentActivity` is called with `performedAt: 2026-09-15T10:00:00Z` (CDMX day: 2026-09-15)
- THEN the system throws a Spanish error and the activity is not created

#### Scenario: Allow — FSR available on performedAt

- GIVEN FSR "Elena" has no approved vacation or holiday on 2026-09-16
- WHEN `createAssignmentActivity` is called with `performedAt: 2026-09-16T10:00:00Z`
- THEN the activity is created normally

---

### RF-706 · RBAC — permissions and routes for holidays and vacations

The system MUST seed the following permissions and assign them to roles:

| Permission | ADMINISTRADOR | FSR | CLIENT | GUEST |
|------------|:---:|:---:|:---:|:---:|
| `holidays:read` | ✓ | — | — | — |
| `holidays:create` | ✓ | — | — | — |
| `holidays:update` | ✓ | — | — | — |
| `holidays:delete` | ✓ | — | — | — |
| `vacations:read` | ✓ | ✓ | — | — |
| `vacations:create` | ✓ | ✓ | — | — |
| `vacations:approve` | ✓ | — | — | — |
| `vacations:delete` | ✓ | ✓ | — | — |

The middleware static route map MUST be updated to include:

| Route prefix | Allowed roles |
|---|---|
| `/admin/holidays` | ADMINISTRADOR |
| `/admin/vacations` | ADMINISTRADOR |
| `/fsr/vacations` | FSR |

FSRs MUST only see and manage their own vacation records. ADMIN sees all vacations.

#### Scenario: FSR accesses own vacation list

- GIVEN an authenticated FSR
- WHEN they navigate to `/fsr/vacations`
- THEN they see only vacation records where `userId` = their own id

#### Scenario: FSR cannot access admin vacation list

- GIVEN an authenticated FSR
- WHEN they attempt to access `/admin/vacations`
- THEN the middleware or route access check redirects to `/unauthorized`

#### Scenario: Admin sees all vacations

- GIVEN an authenticated ADMIN
- WHEN they navigate to `/admin/vacations`
- THEN they see vacation records for all FSRs

---

### RF-707 · VacationStatus catalog

The system MUST seed a `VacationStatus` catalog with the following entries (following the
`ScheduleStatus` pattern, with `color` and `active`):

| name | color |
|------|-------|
| PENDIENTE | Amber (`#F59E0B`) |
| APROBADA | Green (`#10B981`) |
| RECHAZADA | Red (`#EF4444`) |

Soft delete: `active: false`. The catalog is managed by ADMIN only.

---

## Non-goals (confirmed, not to be specced)

- Sub-day (half-day) vacation granularity.
- Auto-reassignment of existing assignments when a vacation is approved.
- Vacation approval notifications (depends on notifications gap — RF-450+).
- Electoral day auto-seeding (ADMIN creates manually as a one-time holiday).
- Non-contiguous vacation days (range model only).
- Blocking `IncidentAssignee` enablement (no work date on that entity; enforcement lives in
  assignment `scheduledDate` and activity `performedAt`).

---

## RF range registered

RF-700 – RF-749: Festivos y vacaciones (this domain)

This range MUST be added to the RF range table in `spec/00-overview.md`.
