# Tasks: incident-type-priority

Change: incident-type-priority · Phase: tasks · Store: hybrid (also engram topic_key `sdd/incident-type-priority/tasks`)
Strategy: stacked-to-main (3 independent PRs, each <400 lines)
Delivery: ask-on-risk → confirmed Chained PRs (3 slices, all under budget)

---

## SLICE 1 — Core: Schema + Migration + Seed + Constants + Dashboard Fix

**PR target**: main
**Branch**: feat/incident-type-priority-core
**Objective**: Add `priority Int @default(5)` to IncidentType, migrate DB, seed real priorities, centralize threshold constant + helper, and fix the criticalIncidents dashboard bug.
**Satisfies**: RF-214, RF-215, RF-500

### Tasks (sequential within slice)

- [x] T1.1 — `prisma/schema.prisma`: add `priority Int @default(5)` to model IncidentType (after `description String?`). No `?` — NOT NULL. Satisfies RF-214.
- [x] T1.2 — Run migration: `npm run db:migrate -- --name add_incident_type_priority`. Verify SQL contains `ALTER TABLE "IncidentType" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 5`. Satisfies RF-214. **NOTE**: DB unreachable (Neon pooler offline in dev). `npx prisma generate` ran — client regenerated. Migration must be applied when DB is available.
- [x] T1.3 — `src/lib/constants/incident-type.ts`: append `CRITICAL_PRIORITY_THRESHOLD = 8`, `MIN_INCIDENT_PRIORITY = 1`, `MAX_INCIDENT_PRIORITY = 10`, and `isCriticalPriority(p: number): boolean` (returns `p >= 8`). No new file — append to existing. Satisfies RF-215.
- [x] T1.4 — `prisma/seed.ts`: extend `incidentTypes` array type to `{ name, description, priority }`. Add explicit `priority` to every entry: Desconocido=3, Falla Eléctrica=8, Falla Mecánica=7, Falla de Software=8, Falla de Cámaras=6, Falla de Báscula=8, Falla de Diagnóstico=8, Falla de Red=7, Calibración=5, Limpieza=2, Suministro=4, MANTENIMIENTO=4 (cover all seeded types). Upsert `update` block includes `priority`. Satisfies RF-214.
- [x] T1.5 — `src/lib/actions/dashboard.ts`: import `CRITICAL_PRIORITY_THRESHOLD` from `@/lib/constants/incident-type`. Added `criticalIncidents` query INSIDE the Promise.all destructure array (after `pendingAssignments`). Filter: `active: true`, `status.name: { not: "CERRADO" }`, `type.priority: { gte: CRITICAL_PRIORITY_THRESHOLD }`. Deleted the standalone sequential `await prisma.incident.count` that previously duplicated `activeIncidents`. Return shape unchanged. Satisfies RF-500.

**Verification (manual)**:
1. `npm run db:migrate` — exits 0, migration file created in `prisma/migrations/`.
2. `npm run db:seed` — exits 0.
3. `npm run db:studio` — confirm each `IncidentType` row has the correct priority value (not all 5).
4. Start dev server, log in as admin, open dashboard — confirm `criticalIncidents` card shows a number different from (and ≤) `activeIncidents`.

**Rollback boundary**: drop `priority` column via inverse migration, revert constant appends (3 lines in incident-type.ts), revert dashboard.ts. No UI changes — safe to revert without touching other slices.

**Estimated lines**: ~89 lines changed.

---

## SLICE 2 — Authoring: Validations + Form + Lookups + Types Table + PriorityBadge

**PR target**: main (after slice 1 merged)
**Branch**: feat/incident-type-priority-authoring
**Objective**: Admin can set/edit priority 1–10 on IncidentType. PriorityBadge component created as first consumer in the catalog table.
**Satisfies**: RF-213, RF-216 (catalog surface only)
**Depends on**: Slice 1 (schema + Prisma client regenerated with priority field)

### Tasks (sequential within slice)

- [x] T2.1 — NEW `src/lib/validations/incident-types.ts`: define and export `incidentTypeSchema` (extract from form + add `priority: z.number().int().min(1).max(10)`). Note: z.number() not z.coerce.number() — RHF's valueAsNumber handles coercion before Zod; z.coerce with zodResolver causes resolver type mismatch in Zod v4. Export `IncidentTypeFormData` type. Satisfies RF-213 validation rule.
- [x] T2.2 — `src/lib/validations/index.ts`: add `export * from "./incident-types"` line. Re-export to align with module convention.
- [x] T2.3 — `src/lib/actions/lookups.ts`: (a) Update `IncidentTypeFormData` type to add `priority: number` (required). (b) `createIncidentType`: add `priority: data.priority` to `prisma.incidentType.create`. (c) `updateIncidentType`: add `priority: data.priority` to `prisma.incidentType.update`. (d) `getIncidentTypes` transform: add `priority: type.priority` to the mapped object. Satisfies RF-213 admin can set/update priority.
- [x] T2.4 — `src/components/incident-types/incident-type-form.tsx`: (a) Remove inline `incidentTypeSchema` and local `IncidentTypeFormData` type; import from `@/lib/validations/incident-types`. (b) Add `priority` to `defaultValues` (default `initialData?.priority ?? 5`). (c) Add numeric input field with `valueAsNumber: true`, label "Prioridad *", and error display. Satisfies RF-213 form scenario.
- [x] T2.5 — NEW `src/components/incident-types/priority-badge.tsx`: client-safe presentational component. Props: `priority: number`. Color mapping: 8–10 → `bg-destructive text-white`, 5–7 → `bg-amber-500 text-white`, 1–4 → `bg-muted text-muted-foreground`. Built on existing `Badge` atom with `className` override (no new cva variant). Always renders the number. Satisfies RF-216 catalog surface.
- [x] T2.6 — `src/components/incident-types/incident-type-table.tsx`: (a) Add `priority: number` to `IncidentType` local interface. (b) Import `PriorityBadge`. (c) Add `<TableHead>Prioridad</TableHead>` column header. (d) Add `<TableCell><PriorityBadge priority={type.priority} /></TableCell>` in each row. Satisfies RF-216 (catalog table scenario).

**Verification (manual)**:
1. Navigate to `/admin/incident-types/new` — confirm Priority field renders with numeric input, min/max enforced in HTML.
2. Submit with priority=0 → form shows validation error. Submit with priority=11 → validation error.
3. Submit with priority=7 → record saved. View catalog table → badge renders with amber color.
4. Edit existing type, change priority to 9 → saved, badge turns destructive red.

**Rollback boundary**: revert T2.1–T2.6 files. No DB change. Slice 3 must not be applied without slice 2 (PriorityBadge import would break).

**Estimated lines**: ~137 lines changed.

---

## SLICE 3 — Visibility: Incident Lists + Tracking + Reports + Spec Docs

**PR target**: main (after slice 2 merged)
**Branch**: feat/incident-type-priority-visibility
**Objective**: PriorityBadge visible in all incident list views, tracking module, and reports; spec documents updated.
**Satisfies**: RF-216 (3 remaining surfaces: lists, tracking, reports), RF-513, RF-503, RF-504
**Depends on**: Slice 2 (PriorityBadge component must exist)

### Tasks (sequential within slice)

- [x] T3.1 — `src/components/admin/incidents/incidents-table.tsx`: Added `priority: number` to local `Incident.type`. Imported `PriorityBadge`. Rendered badge next to type name in the desktop type cell. Satisfies RF-216 admin list.
- [x] T3.2 — `src/app/fsr/incidents/page.tsx`: Imported `PriorityBadge`. Rendered badge next to type badge in each incident card. `getMyIncidents()` includes type — priority flows automatically. Satisfies RF-216 FSR list.
- [x] T3.3 — Client incidents view: Located at `src/app/client/page.tsx` (dashboard with "Incidentes Recientes" list using `getClientIncidents()`). Added `PriorityBadge` next to type badge in the incident list. Satisfies RF-216 client surface.
- [x] T3.4 — `src/lib/actions/tracking.ts`: Added `priority: true` to the `type` select block in `getIncidentsForTracking()`. Satisfies RF-513.
- [x] T3.5 — Tracking UI: `src/components/tracking/tracking-table.tsx`. Updated `TrackingIncident.type` interface to include `priority: number`. Also updated `src/app/admin/tracking/page.tsx` local `TrackingIncident` interface. Imported `PriorityBadge`. Rendered badge in the "Tipo de Incidente" column and in the expanded detail panel. Satisfies RF-513 badge render.
- [x] T3.6 — `src/lib/actions/reports.ts`: `IncidentByTypeData` gains `priority: number`. `getIncidentsByTypeData()` accumulates priority from incident.type.priority per type entry. Satisfies RF-503/RF-504.
- [x] T3.7 — `src/app/admin/reports/incidents/incidents-report-client.tsx`: Imported `PriorityBadge`. Added "Prioridad" column to the "Detalle por Tipo" table. Updated `colSpan` from 3 to 4. Satisfies RF-504 visual requirement.
- [x] T3.8 — Updated `spec/03-incidentes.md` (IncidentType model table, RF-213, added RF-214/RF-215/RF-216 entries) and `spec/09-reportes-tracking.md` (RF-500 criticalIncidents corrected, RF-504 priority added, RF-513 type.priority noted).

**Verification (manual)**:
1. Admin incidents list (`/admin/incidents`) — each row shows a priority badge next to the type name.
2. FSR incidents list — same.
3. Tracking view (`/admin/tracking`) — each incident row shows priority badge.
4. Reports page, "Distribución por tipo" section — each type row shows priority badge.
5. Spec files updated in openspec directory.

**Rollback boundary**: revert T3.1–T3.8. Slice 2 (PriorityBadge + form) remains intact and working independently.

**Estimated lines**: ~123 lines changed.

---

## Dependency Graph

```
main
  └─ feat/incident-type-priority-core        [Slice 1] ─ PR #1 → main
       └─ feat/incident-type-priority-authoring [Slice 2] ─ PR #2 → main
            └─ feat/incident-type-priority-visibility [Slice 3] ─ PR #3 → main
```

Each child branch is rebased on main after the parent PR merges.

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Chained PRs recommended | Yes (already planned) |
| 400-line budget risk | Low — individual PRs are 89 / 137 / 123 lines |
| Estimated changed lines total | ~349 lines (3 PRs) |
| Largest single PR | Slice 2 (~137 lines) |
| Decision needed before apply | No |

---

## Commit Map (work-unit-commits convention)

**Slice 1**:
- `feat(db): add priority field to IncidentType model and migration`
- `feat(constants): add CRITICAL_PRIORITY_THRESHOLD and isCriticalPriority helper`
- `fix(dashboard): fold criticalIncidents into Promise.all with correct priority filter`
- `seed(incident-types): assign real priority values to all incident types`

**Slice 2**:
- `feat(validations): extract incident-type schema with priority field`
- `feat(incident-types): add priority field to form, lookups create/update/transform`
- `feat(ui): add PriorityBadge component with severity color mapping`
- `feat(incident-types): render PriorityBadge in catalog table column`

**Slice 3**:
- `feat(incidents): render priority badge in admin and FSR incident lists`
- `feat(tracking): include type.priority in tracking query and render badge`
- `feat(reports): expose priority in IncidentByTypeData and render badge`
- `docs(spec): update incident and reporting specs to reflect priority implementation`
