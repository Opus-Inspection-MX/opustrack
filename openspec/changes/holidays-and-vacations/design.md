# Design: holidays-and-vacations

## Executive summary
Add `Holiday` (rule-based: fixed date OR n-th Monday, with sexenal one-time via `year`), `VacationStatus` catalog, and `Vacation` (date-range, status-driven, approvable) models, plus a nullable `Assignment.scheduledDate`. A single timezone-aware helper `isFsrUnavailable(userId, date)` resolves CDMX-day availability by evaluating active `Holiday` rules at query-time and checking APPROVED `Vacation` ranges. Hard blocks wire into `createAssignment`/`updateAssignment` (only when `scheduledDate` present) and `createAssignmentActivity` (on `performedAt`). Incident-assignee is explicitly NOT blocked (no date). Ships as 3 stacked-to-main PRs, each < 400 lines.

## Architecture approach
- **Pattern**: extend the existing screaming/feature-oriented layering already in the repo: Prisma models → catalog seed → pure helper in `src/lib/utils/` → server actions in `src/lib/actions/` → server-component pages + client form components. No new architectural layer.
- **Reuse over invent**: the availability helper REUSES `mxDateString`/`mxDayRange` from `src/lib/utils/datetime.ts` so all day comparison happens in `America/Mexico_City`, mirroring how reports already avoid UTC drift. `VacationStatus` mirrors the `ScheduleStatus` catalog pattern (name + color + description, upserted in seed). CRUD actions mirror `schedules.ts` (requirePermission gate → prisma → revalidatePath).
- **Boundary**: the availability rule lives in ONE place (`src/lib/utils/availability.ts`); actions only call it. No duplicated festivo logic across actions.

---

## 1. Schema design (exact Prisma)

Append to `prisma/schema.prisma`. Add back-relations to `User`.

```prisma
model Holiday {
  id          Int      @id @default(autoincrement())
  name        String   // e.g. "Año Nuevo", "Natalicio de Benito Juárez"
  // Rule type: a holiday is EITHER a fixed date (month+day) OR an n-th Monday
  // of a month (month + nthMonday). Exactly one shape is populated.
  month       Int      // 1-12 (always set)
  day         Int?     // 1-31 for fixed-date holidays; null for n-th-Monday
  nthMonday   Int?     // 1-4 for "n-th Monday of month"; null for fixed-date
  // Recurrence: recurring holidays repeat every year (year is null).
  // One-time holidays (sexenal transmisión del Poder Ejecutivo) set
  // isRecurring=false and year=<specific year>.
  isRecurring Boolean  @default(true)
  year        Int?     // only meaningful when isRecurring=false
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([active])
  @@index([month])
}

model VacationStatus {
  id          Int        @id @default(autoincrement())
  name        String     @unique // PENDIENTE | APROBADA | RECHAZADA
  description String?
  color       String     @default("#6B7280")
  vacations   Vacation[]
  active      Boolean    @default(true)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

model Vacation {
  id           String          @id @default(cuid())
  userId       String          // the FSR taking the absence
  user         User            @relation("VacationUser", fields: [userId], references: [id])
  startDate    DateTime        // inclusive, stored as CDMX start-of-day UTC instant
  endDate      DateTime        // inclusive, stored as CDMX end-of-day UTC instant
  reason       String?
  statusId     Int
  status       VacationStatus  @relation(fields: [statusId], references: [id])
  approvedById String?
  approvedBy   User?           @relation("VacationApprover", fields: [approvedById], references: [id])
  approvedAt   DateTime?
  active       Boolean         @default(true)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([userId])
  @@index([statusId])
  // Drives isFsrUnavailable: APPROVED rows for a user overlapping a day.
  @@index([userId, startDate, endDate])
  @@index([active, userId])
}
```

Add to `model User`:
```prisma
  vacations         Vacation[] @relation("VacationUser")
  approvedVacations Vacation[] @relation("VacationApprover")
```

Add to `model Assignment`:
```prisma
  scheduledDate DateTime? // Planned work date (CDMX wall-clock day). Drives availability block; null = no block.
  @@index([scheduledDate])
```

### Migration
- Command: `npm run db:migrate -- --name add_holidays_and_vacations`
- `scheduledDate` is **nullable with no default** → safe on existing rows (all become `null`, meaning "no block"), no backfill, no table rewrite lock concern.
- New tables are additive; no FK touches existing data except the two new `User` back-relations (relation-only, no column on User).
- `VacationStatus` rows must be seeded BEFORE any `Vacation` insert (statusId is required, FK). Seed handles this ordering.

### Date storage convention (decision)
`Vacation.startDate`/`endDate` store the CDMX wall-clock day as a UTC instant via `localWallTimeToUTC(dateStr, "00:00")` for start and `mxDayRange(endDateStr).lte` for end (CDMX 23:59:59.999). This keeps inclusive-range overlap queries correct without per-row timezone math, consistent with `mxDayRange`.

---

## 2. Holiday resolver

**Decision: evaluate rules at query-time over active `Holiday` rows. Do NOT precompute per-year date tables.**
Rationale: the rule set is tiny (~8 rows), fully cacheable, and precomputation would need a yearly backfill job + storage with no benefit. Evaluating a handful of integer comparisons per check is cheaper than maintaining materialized dates.

File: `src/lib/utils/availability.ts`

```ts
import moment from "moment-timezone";
import { APP_TZ } from "@/lib/utils/datetime";

type HolidayRule = {
  month: number;
  day: number | null;
  nthMonday: number | null;
  isRecurring: boolean;
  year: number | null;
};

/**
 * Does a given CDMX calendar day (parsed in APP_TZ) match this holiday rule?
 * Fixed-date rule: month+day match. N-th-Monday rule: the date is the n-th
 * Monday of `month`. One-time rules additionally require year to match.
 */
export function holidayRuleMatchesDate(rule: HolidayRule, dateStr: string): boolean {
  const m = moment.tz(dateStr, "YYYY-MM-DD", APP_TZ);
  if (!m.isValid()) return false;

  if (!rule.isRecurring && rule.year !== null && m.year() !== rule.year) {
    return false;
  }
  if (m.month() + 1 !== rule.month) return false; // moment month is 0-based

  // Fixed-date rule
  if (rule.day !== null) {
    return m.date() === rule.day;
  }

  // N-th-Monday rule: compute the n-th Monday of (year, month)
  if (rule.nthMonday !== null) {
    if (m.isoWeekday() !== 1) return false; // not a Monday at all
    // Ordinal of this Monday within the month: 1 + completed weeks before it.
    const ordinal = Math.floor((m.date() - 1) / 7) + 1;
    return ordinal === rule.nthMonday;
  }
  return false;
}
```

Algorithm for n-th Monday: a date that is a Monday is the k-th Monday of its month where `k = floor((dayOfMonth - 1) / 7) + 1`. E.g. the 3rd Monday of March always falls on day 15–21; `floor((18-1)/7)+1 = 3`. This avoids manually iterating week-by-week.

Festivo lookup:
```ts
import { prisma } from "@/lib/database/prisma.singleton";

export async function isHoliday(dateStr: string): Promise<boolean> {
  const month = Number(dateStr.slice(5, 7));
  const holidays = await prisma.holiday.findMany({
    where: { active: true, month },
    select: { month: true, day: true, nthMonday: true, isRecurring: true, year: true },
  });
  return holidays.some((h) => holidayRuleMatchesDate(h, dateStr));
}
```
The `month`-narrowed query keeps the candidate set to ~1–2 rows.

---

## 3. Availability helper (exact)

Same file `src/lib/utils/availability.ts`:

```ts
import { mxDateString, mxDayRange } from "@/lib/utils/datetime";

/**
 * True when an FSR cannot work on the given instant's CDMX calendar day:
 * the day is an active official holiday, OR the FSR has an APPROVED vacation
 * whose inclusive [startDate, endDate] range contains that day.
 */
export async function isFsrUnavailable(userId: string, date: Date): Promise<boolean> {
  const dateStr = mxDateString(date); // CDMX YYYY-MM-DD

  if (await isHoliday(dateStr)) return true;

  const { gte, lte } = mxDayRange(dateStr); // CDMX day window as UTC instants
  const vacation = await prisma.vacation.findFirst({
    where: {
      userId,
      active: true,
      status: { name: "APROBADA" },
      // Inclusive overlap: vacation starts on/before end-of-day and ends on/after start-of-day.
      startDate: { lte: lte },
      endDate: { gte: gte },
    },
    select: { id: true },
  });
  return vacation !== null;
}
```

### Optional batch variant (for future bulk import; not wired in S1–S3)
```ts
/** Map of unavailable userIds for a single date — one holiday check + one vacation query. */
export async function unavailableFsrsForDate(userIds: string[], date: Date): Promise<Set<string>> {
  const dateStr = mxDateString(date);
  if (await isHoliday(dateStr)) return new Set(userIds); // holiday blocks everyone
  const { gte, lte } = mxDayRange(dateStr);
  const rows = await prisma.vacation.findMany({
    where: {
      userId: { in: userIds },
      active: true,
      status: { name: "APROBADA" },
      startDate: { lte }, endDate: { gte },
    },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}
```

---

## 4. Block mapping

Error messages: neutral Spanish (no voseo).

### `createAssignment` (`src/lib/actions/assignments.ts`)
- `AssignmentFormData` gains `scheduledDate?: Date | null`.
- After `assertAssigneesAreFsrs(uniqueAssignees)` and BEFORE the `$transaction`, add:
```ts
if (data.scheduledDate && uniqueAssignees.length > 0) {
  for (const userId of uniqueAssignees) {
    if (await isFsrUnavailable(userId, data.scheduledDate)) {
      throw new Error(
        "No se puede asignar al FSR en la fecha programada: es día festivo o el FSR tiene vacaciones aprobadas.",
      );
    }
  }
}
```
- Persist `scheduledDate: data.scheduledDate ?? null` in `tx.assignment.create`.
- If `scheduledDate` is null → no block (proposal rule).

### `updateAssignment` (`src/lib/actions/assignments.ts`)
- `scheduledDate` flows in via `AssignmentFormData`.
- Block check runs on **`toAdd`** only (existing assignees aren't re-validated), using the effective scheduled date: `data.scheduledDate ?? existing.scheduledDate`. Compute it by selecting `scheduledDate` alongside `incidentId` in the existing `findUnique`. Run the check BEFORE the transaction, same throw message.
- Persist `scheduledDate` in the `tx.assignment.update` data (only when provided, mirror the `odtFolio` `undefined`-means-unchanged pattern).

### `createAssignmentActivity` (`src/lib/actions/assignment-activities.ts`)
- After `assertAssignmentEditable`, resolve the active assignees of the assignment and the effective date (`data.performedAt ?? new Date()`), then:
```ts
const performedAt = data.performedAt ?? new Date();
const assignees = await prisma.assignmentAssignee.findMany({
  where: { assignmentId: data.assignmentId, active: true },
  select: { userId: true },
});
for (const { userId } of assignees) {
  if (await isFsrUnavailable(userId, performedAt)) {
    throw new Error(
      "No se puede registrar actividad en esta fecha: es día festivo o el FSR tiene vacaciones aprobadas.",
    );
  }
}
```
- Activity is always dated (performedAt defaults to now) → block always applies. This covers the case where `scheduledDate` was null but the FSR still tries to log work on a non-working day.

### Confirmed non-goal
**Incident-assignee (`syncIncidentAssignees` in `incidents.ts`) is NOT blocked.** It only enables an FSR to work on an incident; it carries no date, so there is nothing to evaluate against the availability rule. Confirmed by reading the assignment flow: the date-bearing entity is `Assignment.scheduledDate` / `AssignmentActivity.performedAt`, not the incident-assignee link.

---

## 5. CRUD & approval API

### `src/lib/actions/holidays.ts` (admin only)
```ts
export type HolidayFormData = {
  name: string; month: number; day?: number | null;
  nthMonday?: number | null; isRecurring: boolean; year?: number | null;
};
getHolidays()                              // requirePermission("holidays:read")
getHolidayById(id: number)                 // holidays:read
createHoliday(data: HolidayFormData)        // holidays:create — validate XOR(day, nthMonday)
updateHoliday(id, data: HolidayFormData)    // holidays:update
deleteHoliday(id: number)                   // holidays:delete — soft delete (active=false)
```
Validation: exactly one of `day` / `nthMonday` set; if `!isRecurring` then `year` required. revalidate `/admin/holidays`.

### `src/lib/actions/vacations.ts`
```ts
export type VacationFormData = {
  userId?: string;        // optional: omitted → caller's own id (FSR self-service)
  startDate: Date; endDate: Date; reason?: string;
};
getVacations(filters?)            // vacations:read — admin sees all
getMyVacations()                  // vacations:read — caller's own (FSR view)
getVacationById(id)               // vacations:read
createVacation(data)              // vacations:create
approveVacation(id)               // vacations:approve (ADMIN)
rejectVacation(id)                // vacations:approve (ADMIN)
deleteVacation(id)                // vacations:delete — soft delete
getFsrsForVacations()             // vacations:create — FSR list for admin's user picker
```

`createVacation` rules:
- Resolve target user: `data.userId ?? caller.id`. If `data.userId` is set AND differs from caller, require the caller is admin (only admin creates absences for other FSRs / incapacidades). Validate the target is an active FSR (reuse the FSR check pattern).
- `endDate >= startDate` else throw neutral Spanish.
- **Overlap rejection**: reject if the new range overlaps any PENDIENTE or APROBADA vacation of the same user:
```ts
const clash = await prisma.vacation.findFirst({
  where: {
    userId, active: true,
    status: { name: { in: ["PENDIENTE", "APROBADA"] } },
    startDate: { lte: endDate }, endDate: { gte: startDate },
  },
});
if (clash) throw new Error("El periodo se traslapa con otra solicitud de vacaciones del FSR.");
```
- New rows start `statusId = PENDIENTE`.

`approveVacation` / `rejectVacation`: set status to APROBADA / RECHAZADA, set `approvedById = caller.id`, `approvedAt = new Date()`. Approval does NOT auto-reassign or retroactively block existing assignments (non-goal); admin resolves manually.

### Permissions (exact)
| Function | Permission |
|---|---|
| getHolidays/getHolidayById | holidays:read |
| createHoliday | holidays:create |
| updateHoliday | holidays:update |
| deleteHoliday | holidays:delete |
| getVacations/getMyVacations/getVacationById | vacations:read |
| createVacation | vacations:create |
| approveVacation/rejectVacation | vacations:approve |
| deleteVacation | vacations:delete |

---

## 6. UI plan

Server-component pages (CLAUDE.md "start with Server Components") + client form components mirroring the schedules `new/page.tsx` pattern (`datetime-local`/`date` inputs, `FormError`, submit spinner).

### Admin — Holidays CRUD
- `src/app/admin/holidays/page.tsx` — list (table: name, rule description, recurring/one-time, active).
- `src/app/admin/holidays/new/page.tsx` — form: name, month select, rule-type toggle (Fixed date ⇄ N-th Monday), day OR nthMonday input, recurring switch + conditional year.
- `src/app/admin/holidays/[id]/edit/page.tsx` — same form prefilled.
- `src/components/holidays/holiday-form.tsx` — shared client form.

### Admin — Vacations
- `src/app/admin/vacations/page.tsx` — list of all vacations with status badge (color from VacationStatus), Aprobar / Rechazar buttons on PENDIENTE rows.
- `src/app/admin/vacations/new/page.tsx` — alta for any FSR: **FSR select (admin only)** + date range + reason.
- `src/components/vacations/vacation-form.tsx` — shared form; `showFsrSelect` prop (true for admin, false for FSR self-service).
- `src/components/vacations/vacation-approval-buttons.tsx` — client component calling `approveVacation`/`rejectVacation`.

### FSR — Vacations
- `src/app/fsr/vacations/page.tsx` — own vacations list (status badges) + "Nueva solicitud" → uses `vacation-form` without FSR select.

### Copy (neutral Spanish, no voseo)
- "Días festivos", "Vacaciones", "Nueva solicitud", "Aprobar", "Rechazar", "Periodo", "Fecha de inicio", "Fecha de fin", "Motivo (opcional)", "Estado".
- Badges: "Pendiente", "Aprobada", "Rechazada".

### Scheduled date on assignment form
- `src/components/assignments/assignment-edit-form.tsx` (and the create form): add a `date` input "Fecha programada (opcional)" bound to `scheduledDate`; passed through `AssignmentFormData`. (S3.)

### Middleware route map (`src/middleware.ts`)
Add to the static `roleRoutes` map: FSR gets `/fsr/vacations` (already covered by `/fsr` prefix — verify; the `/fsr` entry already matches `pathname.startsWith("/fsr")`). Admin routes `/admin/holidays`, `/admin/vacations` are covered by the `ADMINISTRADOR: ["/*"]` wildcard. **No middleware change is strictly required** because `/fsr` prefix and admin wildcard already cover the new routes — confirm during apply and only add explicit entries if a non-FSR/non-admin role must be excluded (default deny already excludes them). The route still needs the page-level `requireRouteAccess` guard.

---

## 7. Seed plan

In `prisma/seed.ts`, inside the seed transaction (after ScheduleStatuses block, before commit):

### VacationStatus catalog (upsert by name, ScheduleStatus pattern)
```ts
const vacationStatuses = [
  { name: "PENDIENTE", description: "Solicitud pendiente de aprobación", color: "#F59E0B" },
  { name: "APROBADA",  description: "Vacaciones aprobadas",              color: "#10B981" },
  { name: "RECHAZADA", description: "Solicitud rechazada",               color: "#EF4444" },
];
for (const s of vacationStatuses) {
  await tx.vacationStatus.upsert({ where: { name: s.name }, update: { color: s.color, description: s.description }, create: s });
}
```

### Holidays — LFT Art. 74 (rules, not precomputed dates)
```ts
const holidays = [
  { name: "Año Nuevo",                 month: 1,  day: 1,    nthMonday: null, isRecurring: true,  year: null },
  { name: "Día de la Constitución",    month: 2,  day: null, nthMonday: 1,    isRecurring: true,  year: null }, // 1er lunes feb
  { name: "Natalicio de Benito Juárez",month: 3,  day: null, nthMonday: 3,    isRecurring: true,  year: null }, // 3er lunes mar
  { name: "Día del Trabajo",           month: 5,  day: 1,    nthMonday: null, isRecurring: true,  year: null },
  { name: "Independencia de México",   month: 9,  day: 16,   nthMonday: null, isRecurring: true,  year: null },
  { name: "Revolución Mexicana",       month: 11, day: null, nthMonday: 3,    isRecurring: true,  year: null }, // 3er lunes nov
  { name: "Navidad",                   month: 12, day: 25,   nthMonday: null, isRecurring: true,  year: null },
  // Sexenal: transmisión del Poder Ejecutivo Federal (1-oct, one-time). Admin updates the year each sexenio.
  { name: "Transmisión del Poder Ejecutivo", month: 10, day: 1, nthMonday: null, isRecurring: false, year: 2030 },
];
```
Holiday has no unique natural key beyond id; seed with `upsert` keyed on a deterministic `findFirst` by `name` OR seed idempotently by deleting+recreating recurring rows under a guard. **Decision**: add `@@unique([name, month])`? No — names can shift. Use guarded create: `if ((await tx.holiday.count()) === 0) { await tx.holiday.createMany({ data: holidays }); }` so re-seeding doesn't duplicate. (Document this in tasks.)

### Permissions (append to the permissions array)
```ts
{ name: "holidays:read",   description: "View holidays",   resource: "holidays",  action: "read"   },
{ name: "holidays:create", description: "Create holidays", resource: "holidays",  action: "create" },
{ name: "holidays:update", description: "Update holidays", resource: "holidays",  action: "update" },
{ name: "holidays:delete", description: "Delete holidays", resource: "holidays",  action: "delete" },
{ name: "vacations:read",    description: "View vacations",    resource: "vacations", action: "read"    },
{ name: "vacations:create",  description: "Create vacations",  resource: "vacations", action: "create"  },
{ name: "vacations:approve", description: "Approve/reject vacations", resource: "vacations", action: "approve" },
{ name: "vacations:delete",  description: "Delete vacations",  resource: "vacations", action: "delete"  },
```

### Role assignment
- ADMINISTRADOR: already gets all permissions via `...permissionRecords.map((p) => p.name)`. No change.
- FSR permissions array: add `"vacations:read", "vacations:create", "vacations:delete"`. (FSR does NOT get holidays:* nor vacations:approve.)
- CLIENT / GUEST: no change.

---

## 8. Slicing plan (stacked-to-main, 3 PRs, each < 400 lines)

### S1 — Foundation (~180 lines)
- Scope: schema (Holiday, VacationStatus, Vacation, `Assignment.scheduledDate` + User back-relations) + migration + seed (catalog, holidays, permissions, FSR role grant) + `src/lib/utils/availability.ts` (resolver + `isFsrUnavailable` + batch variant).
- Dependencies: none.
- Independent/deployable: yes — additive schema, no observable behavior change, helper unused yet.
- Rollback: revert migration + files; nullable column + new tables drop cleanly.
- PR boundary criterion: compiles, migration applies, seed runs idempotently, helper unit-testable.

### S2 — CRUD + RBAC + UI (~270 lines)
- Scope: `holidays.ts`, `vacations.ts`, validations, admin pages (holidays CRUD, vacations list+approval+alta), FSR page, shared form components, middleware confirm.
- Dependencies: S1 (models, permissions, statuses).
- Independent/deployable: yes — adds new admin/FSR screens; does not touch assignment flow.
- Rollback: remove routes/actions; data tables remain harmless.
- PR boundary criterion: admin can CRUD holidays, create/approve/reject vacations; FSR can self-request; overlap rejection works.

### S3 — Block integration (~80 lines)
- Scope: `scheduledDate` field in assignment create/edit forms + wiring `isFsrUnavailable` into `createAssignment`/`updateAssignment` (toAdd) and `createAssignmentActivity` (performedAt).
- Dependencies: S1 (helper), S2 (data to make blocks meaningful).
- Independent/deployable: yes — turns the enforcement on.
- Rollback: remove the guard calls + form field; data intact.
- PR boundary criterion: assigning/logging on a festivo or approved-vacation day throws; null scheduledDate does not block.

**Total ~530 lines / 3 PRs, each < 400.** Confirmed under budget per slice.

---

## 9. Risks & mitigation
1. **CDMX timezone off-by-one (high)** → all day math goes through `mxDateString`/`mxDayRange`; vacation ranges stored as CDMX start/end-of-day instants. Mitigation centralized in `availability.ts`; add unit tests around midnight boundaries.
2. **N-th-Monday correctness (medium)** → `floor((day-1)/7)+1` formula validated against known 2026 dates (3rd Mon Mar = Mar 16, 2026); covered by helper unit test.
3. **scheduledDate nullable means no block (medium, by design)** → activity-level enforcement on `performedAt` (always dated) closes the gap when planning date is absent.
4. **Seed idempotency for holidays (medium)** → no natural unique key; guard with count-zero create so re-seed doesn't duplicate. Documented in tasks.
5. **Retroactive approval (product, accepted)** → approving a vacation overlapping existing assignments does not auto-reassign or retro-block; admin resolves manually (non-goal).
6. **N+1 in block loop (low)** → per-assignee `isFsrUnavailable` calls in the loop are 2 small queries each; assignee counts are tiny. Batch variant available if bulk import is added later.
7. **Per-FSR availability under bulk import (medium, future)** → `unavailableFsrsForDate` batch helper provided; not wired in S1–S3.

## Next recommended
sdd-tasks (once spec is also ready).
