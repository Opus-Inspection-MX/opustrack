# Design: Incident Type Priority (1–10)

Change: `incident-type-priority` · Phase: design · Artifact store: hybrid

This design turns the closed contract from the proposal into concrete technical
decisions against the real codebase. It does NOT reopen any contract point
(integer 1–10, no catalog, critical = `priority >= 8`, dashboard fix, numeric
badge, migration default 5 + real seed).

---

## 1. Executive Summary

Add a NOT NULL `priority Int` (1–10, DB default 5) to `IncidentType`. Centralize
the critical threshold (`CRITICAL_PRIORITY_THRESHOLD = 8`) plus an
`isCriticalPriority` helper in the existing `incident-type.ts` constants module
(client-safe, no `"use server"`). Fix `criticalIncidents` in `dashboard.ts` by
folding a correct relational `count` into the existing `Promise.all`. Surface the
number through one reusable `PriorityBadge` (rango→color) mounted on the types
table, incident lists, tracking and reports. Ship in 3 PR-independent slices.

---

## 2. Architecture Approach

No new architectural pattern. This is an **additive vertical extension** of an
existing dimension (the `IncidentType` lookup) following the conventions already
present in the repo:

- Lookups use Server Actions in `src/lib/actions/lookups.ts` with explicit
  `FormData` types and per-call `requirePermission`. We extend, not restructure.
- Forms are client components using `react-hook-form` + `zodResolver`, with the
  Zod schema currently inline in the form file.
- Tables are client components consuming serialized DTOs from the action layer.
- Badges are presentational, driven by `class-variance-authority` `badgeVariants`.

The single new shared artifact is `PriorityBadge`, a presentational atom. The
single new domain rule (`isCriticalPriority`) lives beside the threshold constant
so both server (dashboard) and client (badge styling) import from the same place
without crossing the `"use server"` boundary.

### Data flow (priority dimension)

```
IncidentType.priority (DB, NOT NULL, 1–10, default 5)
        │
        ├── lookups.ts  getIncidentTypes()  ─► transform adds priority ─► IncidentTypeTable ─► PriorityBadge
        ├── lookups.ts  create/update IncidentType  ◄─ IncidentTypeFormData.priority ◄─ form (Zod 1–10)
        ├── incidents.ts getIncidents() (include: { type: true }) ─► already carries priority ─► incidents tables ─► PriorityBadge
        ├── tracking.ts  getIncidentsForTracking() select.type ─► ADD priority:true ─► tracking UI ─► PriorityBadge
        ├── reports.ts   getIncidentsByTypeData() ─► expose priority per type ─► reports UI ─► PriorityBadge
        └── dashboard.ts criticalIncidents = count(active, status!=CERRADO, type.priority >= THRESHOLD)
```

Key discovery that shrinks the blast radius: `getIncidents()` uses
`include: { type: true }`, so once the column exists the full `type` object
(including `priority`) flows to the admin/fsr/client incident tables with **zero
query changes** — only the UI badge mount is needed. `tracking.ts` and
`reports.ts` use explicit `select`/grouping and DO need a targeted change.

---

## 3. Schema Change (exact)

`prisma/schema.prisma` — `IncidentType` model:

```prisma
model IncidentType {
  id          Int        @id @default(autoincrement())
  name        String     @unique
  description String?
  priority    Int        @default(5) // 1–10, NOT NULL. Critical = priority >= 8 (see CRITICAL_PRIORITY_THRESHOLD)
  incidents   Incident[]
  active      Boolean    @default(true)
}
```

Decisions:
- `Int` NOT NULL (no `?`). The `@default(5)` provides the DB-level default so the
  `ADD COLUMN` is non-breaking over existing rows.
- The `@default(5)` stays in the schema permanently (not just for the migration).
  Rationale: defensive default for any future row created without an explicit
  priority; the form always sends a value, so it is effectively a safety net.
- Scale enforcement (1–10) is NOT a DB CHECK constraint — Prisma does not model
  CHECK natively and the repo has no raw-SQL constraint precedent for lookups.
  Range is enforced at the Zod boundary (form + action input). This matches how
  the codebase already trusts the action layer for invariants.

---

## 4. Migration Plan

Command (per repo convention):
```bash
npm run db:migrate -- --name add_incident_type_priority
```

Generated `prisma/migrations/<ts>_add_incident_type_priority/migration.sql`
(expected, single statement — Postgres backfills existing rows with the default):
```sql
-- AlterTable: add NOT NULL priority with DB default for existing rows
ALTER TABLE "IncidentType" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 5;
```

Strategy for NOT NULL over existing data:
1. `ADD COLUMN ... NOT NULL DEFAULT 5` — every existing row is backfilled to 5
   atomically by Postgres. No separate UPDATE step required.
2. The seed (`npm run db:seed`) then upserts real priorities per type (section 6),
   overriding the default for the ~20 known types.

This mirrors the established style in
`20260517100000_sla_to_incident_type/migration.sql` (plain `ALTER TABLE`,
intent documented in a comment). Add a one-line comment in the generated SQL if
Prisma omits it.

Rollback: inverse migration `ALTER TABLE "IncidentType" DROP COLUMN "priority";`
plus revert of the code commit. No incident data is touched — fully reversible.

---

## 5. Constant + Helper Location

File: `src/lib/constants/incident-type.ts` (already exists, already client-safe —
the header comment explicitly notes it lives outside the `"use server"` boundary
so both client and server can import it). Append:

```ts
/**
 * An IncidentType is "critical" when its priority is at or above this threshold.
 * Used by the dashboard critical-incident count and by the priority badge styling.
 */
export const CRITICAL_PRIORITY_THRESHOLD = 8;

/** Lowest / highest allowed priority on the 1–10 scale. */
export const MIN_INCIDENT_PRIORITY = 1;
export const MAX_INCIDENT_PRIORITY = 10;

/** True when a priority counts as critical (priority >= CRITICAL_PRIORITY_THRESHOLD). */
export function isCriticalPriority(priority: number): boolean {
  return priority >= CRITICAL_PRIORITY_THRESHOLD;
}
```

Decision: co-locating the threshold, the 1–10 bounds, and `isCriticalPriority`
in this single client-safe module gives one source of truth shared by the Zod
schema, the dashboard query, and the badge. No new file is introduced.

---

## 6. Dashboard Rewrite (exact)

`src/lib/actions/dashboard.ts`. Remove the trailing sequential `await` block
(lines 100–108) that duplicates `activeIncidents`, and fold a correct count into
the existing `Promise.all`.

Add import:
```ts
import { CRITICAL_PRIORITY_THRESHOLD } from "@/lib/constants/incident-type";
```

Add as a new entry inside the `Promise.all([...])` array and destructure it:
```ts
const [
  totalUsers,
  activeIncidents,
  openAssignments,
  scheduledTasks,
  recentIncidents,
  pendingAssignments,
  criticalIncidents, // NEW — moved into Promise.all
] = await Promise.all([
  // ...existing entries unchanged...

  // Critical incidents: active, not closed, whose type priority is critical.
  prisma.incident.count({
    where: {
      active: true,
      status: { name: { not: "CERRADO" } },
      type: { priority: { gte: CRITICAL_PRIORITY_THRESHOLD } },
    },
  }),
]);
```

Then delete the standalone `const criticalIncidents = await prisma.incident.count(...)`
block entirely. The `return` shape is unchanged.

Notes:
- `type` is a required relation on `Incident` (`typeId Int` NOT NULL), so the
  nested `type: { priority: { gte: ... } }` filter is safe — no orphan rows.
- This removes one extra sequential round-trip (now fully parallel) AND fixes the
  correctness bug in a single edit. The dashboard fix is contained in this file
  and can be reverted in isolation without touching schema.

---

## 7. Form + Action Changes

### 7.1 Zod schema — extract to `src/lib/validations/incident-types.ts` (NEW)

Decision: the incident-type Zod schema is currently inline in
`incident-type-form.tsx`. We **extract** it to `src/lib/validations/` to match the
existing domain-validation convention (`incidents.ts`, `parts.ts`, etc., all
re-exported via `index.ts`). This lets the same schema be reused later and keeps
the 1–10 rule out of the component. Rationale for extracting now rather than
keeping inline: the priority bound is a domain rule, and the repo already has a
dedicated validations module that this lookup currently bypasses — aligning it is
low cost and removes a divergence.

New file `src/lib/validations/incident-types.ts`:
```ts
import { z } from "zod";
import {
  MAX_INCIDENT_PRIORITY,
  MIN_INCIDENT_PRIORITY,
} from "@/lib/constants/incident-type";

export const incidentTypeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").optional(),
  priority: z.coerce
    .number({ invalid_type_error: "Priority is required" })
    .int("Priority must be a whole number")
    .min(MIN_INCIDENT_PRIORITY, `Priority must be at least ${MIN_INCIDENT_PRIORITY}`)
    .max(MAX_INCIDENT_PRIORITY, `Priority must be at most ${MAX_INCIDENT_PRIORITY}`),
  active: z.boolean(),
});

export type IncidentTypeSchema = z.infer<typeof incidentTypeSchema>;
```
Add `export * from "./incident-types";` to `src/lib/validations/index.ts`.

Note: `z.coerce.number()` is used because numeric `<Input>` values arrive as
strings via `react-hook-form` `register`. This is the same coercion concern the
form must handle.

### 7.2 Form — `src/components/incident-types/incident-type-form.tsx`

- Replace the inline schema with an import of `incidentTypeSchema` from the new
  validations module; `type IncidentTypeFormData = z.infer<typeof incidentTypeSchema>`.
- Add `priority` to `defaultValues`: `initialData?.priority ?? 5`.
- Add a numeric field between Description and the Active switch:
  ```tsx
  <div className="space-y-2">
    <Label htmlFor="priority">Prioridad (1–10) *</Label>
    <Input
      id="priority"
      type="number"
      min={1}
      max={10}
      step={1}
      {...register("priority", { valueAsNumber: true })}
      className={errors.priority && touchedFields.priority ? "border-red-500" : ""}
    />
    {errors.priority && touchedFields.priority && (
      <p className="text-sm text-red-500">{errors.priority.message}</p>
    )}
  </div>
  ```
- `register("priority", { valueAsNumber: true })` keeps RHF state numeric; the Zod
  `coerce` is the second line of defense.

### 7.3 Action layer — `src/lib/actions/lookups.ts`

- Extend the `IncidentTypeFormData` type:
  ```ts
  export type IncidentTypeFormData = {
    name: string;
    description?: string;
    priority: number; // 1–10, required
    active?: boolean;
  };
  ```
- `createIncidentType`: add `priority: data.priority` to the `data` object.
- `updateIncidentType`: add `priority: data.priority` to the `data` object.
- `getIncidentTypes`: add `priority: type.priority` to the transformed DTO so the
  table receives it.
- `getIncidentTypeById`: returns the raw model (already includes `priority` once
  the column exists) — no change needed beyond regenerated Prisma types.

---

## 8. PriorityBadge — reusable component

New file: `src/components/incident-types/priority-badge.tsx` (presentational,
co-located with the incident-type domain; could also live in `common/` — chosen
under the domain folder because it encodes the incident-priority business mapping,
not a generic UI primitive).

```tsx
import { Badge } from "@/components/ui/badge";

interface PriorityBadgeProps {
  priority: number;
  className?: string;
}

// Rango → estilo. The badge ALWAYS shows the number; color communicates severity.
function priorityClasses(priority: number): string {
  if (priority >= 8) return "bg-destructive text-white border-transparent"; // 8–10 critical
  if (priority >= 5) return "bg-amber-500 text-white border-transparent";   // 5–7 medium
  return "bg-muted text-muted-foreground border-transparent";               // 1–4 low
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge className={`${priorityClasses(priority)} ${className ?? ""}`}>
      {priority}
    </Badge>
  );
}
```

Decisions:
- Built on the existing `Badge` atom + `className` override (the `badgeVariants`
  `cva` already supports arbitrary `className` merge via `cn`). We do NOT add a new
  variant to `badgeVariants` because the medium (amber) tone has no token in the
  current variant set; an inline class is the smallest, theme-consistent change.
  Critical reuses the `destructive` token via its utility classes.
- The number is always rendered; color is purely additive severity signal — this
  honors the contract ("badge shows the NUMBER").

### Mount points
| Location | File | How |
|---|---|---|
| Types table | `src/components/incident-types/incident-type-table.tsx` | New "Prioridad" `<TableHead>` + `<PriorityBadge priority={type.priority} />` cell; add `priority: number` to the local `IncidentType` interface |
| Admin incidents list | `src/components/admin/incidents/incidents-table.tsx` | Add `priority` to local `type` shape; render `PriorityBadge` next to the type badge |
| FSR / Client incident views | `src/app/fsr/incidents/*`, `src/app/client/incidents/[id]/*` | Same badge where the type is displayed (data already carried by `include: { type: true }`) |
| Tracking | tracking UI consuming `getIncidentsForTracking()` | After adding `priority` to the `type` select (section 9) |
| Reports | reports UI consuming `getIncidentsByTypeData()` | After exposing `priority` per type (section 9) |

---

## 9. Tracking + Reports query changes

### Tracking — `src/lib/actions/tracking.ts`
`getIncidentsForTracking()` uses an explicit `select` on `type` (lines 121–126).
Add `priority: true`:
```ts
type: {
  select: {
    id: true,
    name: true,
    priority: true, // NEW
  },
},
```
The consuming tracking UI then renders `PriorityBadge` from `incident.type.priority`.

### Reports — `src/lib/actions/reports.ts`
`getIncidentsByTypeData()` groups by `type.name` only. Extend the
`IncidentByTypeData` type and grouping to carry priority per type:
```ts
export type IncidentByTypeData = {
  type: string;
  priority: number; // NEW — priority of that type
  count: number;
  percentage: number;
};
```
The `include: { type: true }` is already present, so `incident.type.priority` is
available; carry it into the per-type aggregate (`typeCounts` becomes a small
object holding `{ count, priority }`). The reports UI renders `PriorityBadge` in
the by-type row.

Decision: only `getIncidentsByTypeData` is touched in reports. Trend/summary/aging
reports do not group by type and are out of scope for the badge.

---

## 10. Seed Priorities (~20 types)

`prisma/seed.ts` — extend the `incidentTypes` array element type with
`priority: number` and add a value to each entry. The upsert `update`/`create`
must include `priority`. Suggested values (>= 8 = critical):

| Type | priority | critical? |
|---|---|---|
| Desconocido | 3 | no (explicit low, per contract) |
| Falla Eléctrica | 8 | YES |
| Falla Mecánica | 7 | no |
| Falla de Software | 8 | YES |
| Falla de Cámaras | 6 | no |
| Falla de Báscula | 8 | YES |
| Falla de Diagnóstico | 8 | YES |
| Falla de Red | 7 | no |
| Mantenimiento Preventivo | 3 | no |
| Mantenimiento Correctivo | 6 | no |
| Calibración | 5 | no |
| Limpieza / Acondicionamiento | 2 | no |
| Suministro | 4 | no |
| MANTENIMIENTO | 4 | no |
| Mantenimiento Predictivo | 4 | no |
| Mantenimiento de Equipos de Diagnóstico | 6 | no |
| Mantenimiento de Báscula | 6 | no |
| Mantenimiento de Cámaras / OCR | 5 | no |
| Mantenimiento de Red / IT | 6 | no |
| Mantenimiento de Infraestructura | 5 | no |

Rationale: real equipment/measurement faults that block inspection throughput
(eléctrica, software, báscula, diagnóstico) are critical (>= 8). "Desconocido"
gets an explicit low 3 (not the neutral 5 default) so unclassified incidents do
not silently inflate the critical count. Exactly 4 types are critical, giving a
visibly non-trivial dashboard number distinct from `activeIncidents`.

Update upsert (priority is set on both create and update so re-seeding corrects
existing rows):
```ts
await tx.incidentType.upsert({
  where: { name: it.name },
  update: { description: it.description, priority: it.priority },
  create: it,
});
```

---

## 11. Spec Updates

- `spec/03-incidentes.md`: document `IncidentType.priority` (Int, 1–10, NOT NULL)
  and update RF-213 to reference priority on the type.
- `spec/09-reportes-tracking.md`: update RF-500 to reflect priority surfaced in
  tracking/reports and the corrected critical-incident definition.

These are doc-only edits bundled with slice 3 (or its own trivial commit).

---

## 12. Slicing Plan (for the tasks phase)

Confirmed at 3 slices. Each is an independently mergeable PR with its own
verification and rollback. Ordering is by dependency: slice 1 ships the column +
constant the others rely on.

### Slice 1 — Core: schema + migration + seed + constant + dashboard fix
- `prisma/schema.prisma` (priority column)
- migration `add_incident_type_priority`
- `prisma/seed.ts` (priority values + upsert)
- `src/lib/constants/incident-type.ts` (threshold + helper + bounds)
- `src/lib/actions/dashboard.ts` (criticalIncidents into Promise.all, correct where)
- **PR criterion**: dashboard critical count is correct and no longer equals
  activeIncidents; DB migrates cleanly; seed assigns real priorities.
- **Rollback**: inverse migration drops column; revert commit. Dashboard fix
  reverts in isolation.
- **Verification**: `npm run db:migrate`, `npm run db:seed`, load admin dashboard,
  confirm critical < active and reflects 4 critical types.

### Slice 2 — Authoring: form + types table
- `src/lib/validations/incident-types.ts` (+ `index.ts` re-export)
- `src/components/incident-types/incident-type-form.tsx` (numeric field)
- `src/lib/actions/lookups.ts` (`IncidentTypeFormData` + create/update + transform)
- `src/components/incident-types/incident-type-table.tsx` (Prioridad column)
- `src/components/incident-types/priority-badge.tsx` (NEW — shared atom; introduced
  here because the types table is its first consumer)
- **PR criterion**: admin can set/edit priority 1–10; Zod rejects out-of-range;
  types table shows the numeric badge with rango color.
- **Rollback**: revert commit. Depends on slice 1 column existing.
- **Verification**: create/edit a type, attempt priority 0 and 11 (rejected),
  confirm badge color buckets.

### Slice 3 — Visibility: incident lists + tracking + reports + specs
- `src/components/admin/incidents/incidents-table.tsx` (+ fsr/client incident views)
- `src/lib/actions/tracking.ts` (`priority: true` in type select) + tracking UI
- `src/lib/actions/reports.ts` (`IncidentByTypeData.priority`) + reports UI
- `spec/03-incidentes.md`, `spec/09-reportes-tracking.md`
- **PR criterion**: PriorityBadge appears in incident lists, tracking, and the
  by-type report; specs updated.
- **Rollback**: revert commit; purely additive UI + one select field + one report
  type field. Depends on slice 2 for `PriorityBadge`.
- **Verification**: load admin/fsr/client incident lists, tracking, reports;
  confirm numbers render with correct colors.

Slice size: each is well under the 400-line PR budget. Slice 2 introduces the
shared `PriorityBadge`; slice 3 only consumes it, so there is no duplication.

---

## 13. ADR-style Decisions

1. **DB default stays permanent (`@default(5)`), not migration-only.** Rejected
   alternative: add default for the migration then drop it. Kept it as a safety net
   for any future row created without explicit priority; the form always supplies a
   value so it never masks user intent.

2. **Range (1–10) enforced at Zod boundary, not a DB CHECK.** Rejected: raw-SQL
   CHECK constraint. Prisma has no native CHECK modeling and the repo has no
   precedent; the action layer is already the trusted invariant boundary here.

3. **Extract incident-type Zod schema to `src/lib/validations/`.** Rejected:
   keeping it inline in the form. The repo already has a dedicated validations
   module convention this lookup bypassed; aligning it co-locates the 1–10 domain
   rule with the other domain schemas at low cost.

4. **`PriorityBadge` built on existing `Badge` + className, no new cva variant.**
   Rejected: adding an `amber`/`priority` variant to `badgeVariants`. The medium
   tone has no design token; an inline utility class is the smallest theme-aligned
   change and keeps the shared atom self-contained.

5. **`criticalIncidents` folded into the existing `Promise.all`.** Rejected:
   leaving a separate sequential `await`. Folding it removes a round-trip and fixes
   correctness in one edit, matching the parallel pattern already in the function.

6. **"Desconocido" seeded to explicit 3, not neutral 5.** Rejected: leaving it at
   the default 5. An explicit low value keeps unclassified incidents out of the
   critical count, which is the whole point of the dashboard fix.

7. **Reuse `getIncidents()`'s `include: { type: true }` for incident-list badges.**
   No query change for admin/fsr/client lists — the full type object already flows.
   Only `tracking.ts` (explicit select) and `reports.ts` (grouping) need edits.

---

## 14. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| NOT NULL column over existing rows fails | `ADD COLUMN NOT NULL DEFAULT 5` backfills atomically in Postgres; no separate UPDATE; matches `sla_to_incident_type` precedent |
| Numeric input arrives as string → Zod/type mismatch | `register("priority", { valueAsNumber: true })` + `z.coerce.number().int()` double guard |
| Re-seed does not update existing rows' priority | upsert `update` includes `priority` so re-seeding corrects rows, not just creates |
| Badge color for medium has no theme token | Use inline `bg-amber-500`; critical/low reuse existing `destructive`/`muted` tokens; revisit if a token is added later (out of scope) |
| Slice 3 depends on `PriorityBadge` from slice 2 | Enforce slice order in tasks; PriorityBadge ships in slice 2, consumed in slice 3 — no duplication |
| `getIncidentTypeById` raw model used elsewhere | It already returns the full model; once column exists `priority` is present — verify no DTO mapper drops it |
| Spec drift (CLAUDE.md outdated) | Source of truth is `spec/03` and `spec/09`; update both in slice 3 |

---

## 15. Next Recommended

`sdd-tasks` — once the spec phase is also ready, generate the task breakdown
following the 3-slice plan in section 12.
