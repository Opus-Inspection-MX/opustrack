# Tasks: holidays-and-vacations

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~530 (S1≈180, S2≈270, S3≈80) |
| 400-line budget risk | High (total), Low per slice |
| Chained PRs recommended | Yes |
| Suggested split | PR S1 → PR S2 → PR S3 (stacked-to-main) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Base branch | Notes |
|------|------|-----------|-------------|-------|
| S1 | Schema + migration + seed + availability helper | PR 1 | main | No observable UI; safe to deploy independently |
| S2 | CRUD actions + RBAC pages + UI components | PR 2 | PR 1 branch | Depends on S1 models and permissions |
| S3 | scheduledDate field wiring + isFsrUnavailable blocks | PR 3 | PR 2 branch | Depends on S1 helper and S2 seed permissions |

---

## Slice S1 — Foundation (~180 lines)

**PR objective**: Introduce Holiday, VacationStatus, Vacation models + nullable Assignment.scheduledDate; run migration; seed LFT holidays, vacation statuses, and 8 new permissions; add CDMX-aware availability helper.
**Rollback boundary**: Revert migration + remove availability.ts. No UI surface exposed.
**Verification**: `npm run db:migrate` succeeds; `npm run db:seed` creates 8 Holiday rows, 3 VacationStatus rows, 8 permissions; `availibility.ts` exports compile without error.

### Phase 1.1 — Schema

- [x] 1.1.1 Add `Holiday` model to `prisma/schema.prisma`: fields `id`, `name`, `month Int`, `day Int?`, `nthMonday Int?`, `isRecurring Boolean @default(true)`, `year Int?`, `active Boolean @default(true)`. Add `@@index([active])` and `@@index([month])`. [schema: new model]
- [x] 1.1.2 Add `VacationStatus` model to `prisma/schema.prisma`: fields `id`, `name @unique`, `description String?`, `color String @default("#6B7280")`, `active Boolean @default(true)`. [schema: new model]
- [x] 1.1.3 Add `Vacation` model to `prisma/schema.prisma`: fields `id String @id @default(cuid())`, `userId`, `startDate DateTime`, `endDate DateTime`, `reason String?`, `statusId`, `approvedById String?`, `approvedAt DateTime?`, `active Boolean @default(true)`. Relations: `user User @relation("VacationUser")`, `status VacationStatus`, `approvedBy User? @relation("VacationApprover")`. Indexes: `@@index([userId])`, `@@index([statusId])`, `@@index([userId,startDate,endDate])`, `@@index([active,userId])`. [schema: new model]
- [x] 1.1.4 Add back-relations to `User` model in `prisma/schema.prisma`: `vacations Vacation[] @relation("VacationUser")` and `approvedVacations Vacation[] @relation("VacationApprover")`. [schema: delta]
- [x] 1.1.5 Add `scheduledDate DateTime?` field to `Assignment` model in `prisma/schema.prisma` with `@@index([scheduledDate])`. Nullable, no default (safe migration; null = no block). [schema: delta]

### Phase 1.2 — Migration

- [x] 1.2.1 Run `npm run db:migrate -- --name add_holidays_and_vacations` to generate and apply migration. Verify migration file appears in `prisma/migrations/`. [migration] **NOTE: Neon DB unreachable (P1001). Prisma client regenerated via `npx prisma generate`. Migration pending application when DB is accessible.**

### Phase 1.3 — Seed

- [x] 1.3.1 In `prisma/seed.ts`, upsert 3 `VacationStatus` entries (after existing ScheduleStatus block): `PENDIENTE` (#F59E0B), `APROBADA` (#10B981), `RECHAZADA` (#EF4444). Upsert by `name`. [seed: new catalog]
- [x] 1.3.2 In `prisma/seed.ts`, seed 8 LFT Art. 74 Holiday rows guarded by `count === 0` (createMany, idempotent): Año Nuevo (1,day:1), Día de la Constitución (2,nthMonday:1), Natalicio de Benito Juárez (3,nthMonday:3), Día del Trabajo (5,day:1), Día de la Independencia (9,day:16), Día de la Revolución (11,nthMonday:3), Navidad (12,day:25), Transmisión del Poder Ejecutivo (10,day:1,isRecurring:false,year:2030). [seed: new data]
- [x] 1.3.3 In `prisma/seed.ts`, append 8 new permissions to the permissions array: `holidays:read`, `holidays:create`, `holidays:update`, `holidays:delete`, `vacations:read`, `vacations:create`, `vacations:approve`, `vacations:delete`. [seed: permissions]
- [x] 1.3.4 In `prisma/seed.ts`, assign to FSR role: `vacations:read`, `vacations:create`, `vacations:delete`. ADMIN already receives all permissions via auto-all pattern. CLIENT and GUEST receive none. [seed: RBAC]

### Phase 1.4 — Availability helper

- [x] 1.4.1 Create `src/lib/utils/availability.ts`. Export `holidayRuleMatchesDate(rule: Holiday, dateStr: string): boolean`: use `mxDateString`/`mxDayRange` from `src/lib/utils/datetime.ts`; handle fixed (month+day), n-th Monday (month+nthMonday: isoWeekday===1 && floor((date-1)/7)+1===nthMonday), and one-time (isRecurring:false && year match). [helper: new file]
- [x] 1.4.2 In `src/lib/utils/availability.ts`, export `isHoliday(dateStr: string): Promise<boolean>`: query `prisma.holiday.findMany({ where: { active: true, month } })`, return `.some(r => holidayRuleMatchesDate(r, dateStr))`. [helper: isHoliday]
- [x] 1.4.3 In `src/lib/utils/availability.ts`, export `isFsrUnavailable(userId: string, date: Date): Promise<boolean>`: compute `dateStr = mxDateString(date)`; if `isHoliday(dateStr)` return true; compute `{gte,lte} = mxDayRange(dateStr)`; findFirst APROBADA vacation overlapping range → return `!= null`. [helper: isFsrUnavailable]
- [x] 1.4.4 In `src/lib/utils/availability.ts`, export `unavailableFsrsForDate(userIds: string[], date: Date): Promise<Set<string>>` (batch variant, not wired in S1–S3; available for future use). [helper: batch variant]

---

## Slice S2 — CRUD + RBAC + UI (~270 lines)

**PR objective**: Add server actions for holidays and vacations, admin and FSR pages, and UI form components. No new availability checks wired yet.
**Rollback boundary**: Remove `src/lib/actions/holidays.ts`, `src/lib/actions/vacations.ts`, `src/app/admin/holidays/`, `src/app/admin/vacations/`, `src/app/fsr/vacations/`, and related components. S1 schema/seed unaffected.
**Verification**: Admin can reach `/admin/holidays` and `/admin/vacations`; FSR can reach `/fsr/vacations`; CRUD operations persist and revalidate correctly; non-admin access to holiday routes returns 403/redirect.

**Depends on**: S1 (models, permissions seeded).

### Phase 2.1 — Validations

- [x] 2.1.1 Create `src/lib/validations/holidays.ts`: export `HolidayFormData` type with `name`, `month`, `day?`, `nthMonday?`, `isRecurring`, `year?`. Add `validateHolidayXOR(data)` that throws if both `day` and `nthMonday` are set, or neither; throws if `!isRecurring && !year`. [validation]
- [x] 2.1.2 Create `src/lib/validations/vacations.ts`: export `VacationFormData` type with `userId?`, `startDate`, `endDate`, `reason?`. Add `validateVacationDates(data)` that throws if `endDate < startDate`. [validation]

### Phase 2.2 — Server actions: holidays

- [x] 2.2.1 Create `src/lib/actions/holidays.ts` ("use server"). Export `getHolidays()` (requires `holidays:read`), `getHolidayById(id)` (requires `holidays:read`). [action: read]
- [x] 2.2.2 In `src/lib/actions/holidays.ts`, export `createHoliday(data: HolidayFormData)` (requires `holidays:create`): validate XOR + year; `prisma.holiday.create`; `revalidatePath("/admin/holidays")`. [action: create]
- [x] 2.2.3 In `src/lib/actions/holidays.ts`, export `updateHoliday(id, data)` (requires `holidays:update`): validate XOR + year; `prisma.holiday.update`; revalidate. [action: update]
- [x] 2.2.4 In `src/lib/actions/holidays.ts`, export `deleteHoliday(id)` (requires `holidays:delete`): soft delete `active: false`; revalidate. [action: delete]

### Phase 2.3 — Server actions: vacations

- [x] 2.3.1 Create `src/lib/actions/vacations.ts` ("use server"). Export `getVacations()` and `getMyVacations()` (requires `vacations:read`); `getVacationById(id)` (same). `getMyVacations` filters by `userId = caller.id`. [action: read]
- [x] 2.3.2 In `src/lib/actions/vacations.ts`, export `getFsrsForVacations()` (requires `vacations:create`): return active FSR users for the FSR-select dropdown. [action: helper]
- [x] 2.3.3 In `src/lib/actions/vacations.ts`, export `createVacation(data: VacationFormData)` (requires `vacations:create`): resolve `targetUserId = data.userId ?? caller.id`; if `targetUserId !== caller.id`, assert admin; validate FSR active; `validateVacationDates`; check PENDIENTE|APROBADA overlap (throw neutral Spanish if overlap); set `statusId = PENDIENTE`; create; revalidate `/admin/vacations` + `/fsr/vacations`. [action: create]
- [x] 2.3.4 In `src/lib/actions/vacations.ts`, export `approveVacation(id)` and `rejectVacation(id)` (both require `vacations:approve`): set `statusId`, `approvedById = caller.id`, `approvedAt = now`; revalidate. No auto-reassignment. [action: approve/reject]
- [x] 2.3.5 In `src/lib/actions/vacations.ts`, export `deleteVacation(id)` (requires `vacations:delete`): soft delete `active: false`; FSR can only delete own; admin can delete any. Revalidate. [action: delete]

### Phase 2.4 — UI components

- [x] 2.4.1 Create `src/components/holidays/holiday-form.tsx`: rule-type toggle (Fixed / N-th Monday) showing `day` or `nthMonday` input conditionally; `isRecurring` switch with conditional `year` input. Submits to `createHoliday`/`updateHoliday`. Labels in neutral Spanish. [component]
- [x] 2.4.2 Create `src/components/vacations/vacation-form.tsx`: props `showFsrSelect: boolean`. When true, renders FSR `<select>` (admin path); when false, hides it (FSR self-service). Submits to `createVacation`. Labels: "Fecha de inicio", "Fecha de fin", "Motivo (opcional)". [component]
- [x] 2.4.3 Create `src/components/vacations/vacation-approval-buttons.tsx`: two buttons "Aprobar" and "Rechazar" calling `approveVacation`/`rejectVacation` via form actions. Conditionally rendered based on `vacations:approve`. [component]

### Phase 2.5 — Admin pages: holidays

- [x] 2.5.1 Create `src/app/admin/holidays/page.tsx`: `requireRouteAccess("/admin/holidays")`; fetch `getHolidays()`; render table with name, type, date rule, active status, edit/delete actions. [page: list]
- [x] 2.5.2 Create `src/app/admin/holidays/new/page.tsx`: `requireRouteAccess("/admin/holidays")`; render `<HolidayForm />` for creation. [page: new]
- [x] 2.5.3 Create `src/app/admin/holidays/[id]/edit/page.tsx`: `requireRouteAccess("/admin/holidays")`; `await params`; fetch `getHolidayById(id)`; render `<HolidayForm />` pre-filled. [page: edit]

### Phase 2.6 — Admin pages: vacations

- [x] 2.6.1 Create `src/app/admin/vacations/page.tsx`: `requireRouteAccess("/admin/vacations")`; fetch `getVacations()`; render table with FSR name, dates, status (colored badge), approval buttons via `<VacationApprovalButtons />`. [page: list]
- [x] 2.6.2 Create `src/app/admin/vacations/new/page.tsx`: `requireRouteAccess("/admin/vacations")`; render `<VacationForm showFsrSelect={true} />`. [page: new]

### Phase 2.7 — FSR page: vacations

- [x] 2.7.1 Create `src/app/fsr/vacations/page.tsx`: `requireRouteAccess("/fsr/vacations")`; fetch `getMyVacations()`; render own vacations table + link to create new request. [page: FSR list]
- [x] 2.7.2 Create `src/app/fsr/vacations/new/page.tsx`: `requireRouteAccess("/fsr/vacations")`; render `<VacationForm showFsrSelect={false} />`. [page: FSR new]

---

## Slice S3 — Block integration (~80 lines)

**PR objective**: Wire `scheduledDate` UI field into assignment forms and enforce `isFsrUnavailable` in `createAssignment`, `updateAssignment` (toAdd only), and `createAssignmentActivity` (performedAt).
**Rollback boundary**: Revert changes to `src/lib/actions/lines.ts`, `src/lib/actions/roles.ts` (if applicable), assignment form components. S1 and S2 unaffected.
**Verification**: Creating assignment with `scheduledDate` set to an FSR's approved vacation day returns Spanish error and no record is persisted; activity on a holiday returns Spanish error; null `scheduledDate` assignment proceeds without check; soft-delete of activity always succeeds.

**Depends on**: S1 (availability helper), S2 (seed has permissions applied).

### Phase 3.1 — scheduledDate in assignment form

- [x] 3.1.1 Locate the assignment creation form component (likely under `src/components/` or `src/app/*/assignments/`). Add a date input labeled "Fecha programada (opcional)" bound to `scheduledDate` field. Input is optional; submits `null` when empty. [UI: delta]

### Phase 3.2 — createAssignment block

- [x] 3.2.1 In `src/lib/actions/lines.ts` (or the file containing `createAssignment`): extend `AssignmentFormData` to include `scheduledDate?: Date | null`. After `assertAssigneesAreFsrs` and before the transaction, if `scheduledDate != null && assignees.length > 0`, loop `isFsrUnavailable(userId, scheduledDate)` for each assignee; if any returns true, throw with neutral Spanish error: "No es posible asignar al FSR en la fecha indicada porque no está disponible (festivo o vacaciones aprobadas)." Persist `scheduledDate ?? null` inside the transaction. [action: block]

### Phase 3.3 — updateAssignment block

- [x] 3.3.1 In the `updateAssignment` action: add `scheduledDate` to the `findUnique` select so the existing date is recoverable. Resolve effective date as `data.scheduledDate ?? existing.scheduledDate`. Check `isFsrUnavailable` only for `toAdd` fsrs against effective date (if non-null). Persist `scheduledDate` via undefined-means-unchanged pattern (same as `odtFolio`). [action: block]

### Phase 3.4 — createAssignmentActivity block

- [x] 3.4.1 In `src/lib/actions/lines.ts` (or the file containing `createAssignmentActivity`): resolve `performedAt = data.performedAt ?? new Date()`. Load active assignees for the assignment. Loop `isFsrUnavailable(userId, performedAt)` for each; if any returns true, throw neutral Spanish: "No es posible registrar la actividad en esa fecha porque el FSR no estaba disponible (festivo o vacaciones aprobadas)." Soft-delete of activity path: skip availability check entirely. [action: block]

---

## Optional focused tests (not blocking apply)

> strict_tdd = false. These are suggested to cover the highest-risk logic. Not required to proceed with sdd-apply.

- [ ] T.1 `holidayRuleMatchesDate` unit tests: fixed match, n-th-Monday 2026 calendar dates, one-time sexennial year mismatch, CDMX off-by-one (UTC instant crossing midnight). File: `src/lib/utils/availability.test.ts`.
- [ ] T.2 `isFsrUnavailable` integration tests: approved vacation blocks, pending does not, holiday blocks, no-match returns false. Mock Prisma or use test DB snapshot.
