# Design: SLA from Priority (RF-218, RF-518)

Change: `sla-from-priority` · Phase: design · Artifact store: hybrid

This design turns the proposal contract into concrete technical decisions. It does NOT reopen any contract point (bands reuse badge buckets, computed-not-stored breach, CDMX business days via `availability.ts`, no `sla` column, no auto-escalation).

---

## 1. Executive Summary

Add `src/lib/constants/sla-policy.ts`: three priority bands (8–10 / 5–7 / 1–4, same buckets as `PriorityBadge`) each with `responseBusinessDays` and `resolutionBusinessDays`. Add pure helpers `businessDaysBetween(from, to, holidayDates)` and `getSlaState(incident)` returning `ON_TRACK | AT_RISK | BREACHED` (AT_RISK = ≥80% of target consumed). Tracking DTOs and the new RF-518 report consume `getSlaState`; `CANCELADA` maps to a fourth display state `NOT_APPLICABLE` and never breaches. Ship in 2 slices.

---

## 2. Policy Table (exact, to confirm at apply)

```ts
// src/lib/constants/sla-policy.ts
export type SlaBand = "critical" | "medium" | "low";

export const SLA_POLICY: Record<SlaBand, { responseBusinessDays: number; resolutionBusinessDays: number }> = {
  critical: { responseBusinessDays: 1, resolutionBusinessDays: 3 },
  medium:   { responseBusinessDays: 2, resolutionBusinessDays: 7 },
  low:      { responseBusinessDays: 5, resolutionBusinessDays: 15 },
};

export function slaBandForPriority(priority: number): SlaBand {
  if (priority >= 8) return "critical";
  if (priority >= 5) return "medium";
  return "low";
}
```

Decisions:
- Bands reuse the badge buckets so priority color and SLA urgency can never disagree (one mapping, two consumers).
- Values above are starting points for review at apply time; changing them later is a one-line diff with zero migration (the entire point of code-policy over a column).
- Response clock: `createdAt → first seenAt` across any active assignment (first acuse, RF-252). Unseen incidents accrue against the response target indefinitely.
- Resolution clock: `createdAt → resolvedAt` (set by `syncIncidentState` on `CERRADO`, or `cancelIncident` — but cancelled rows are excluded, see §4).

---

## 3. Business-Day Math (reuse, don't rebuild)

`src/lib/utils/availability.ts` already owns CDMX-aware holiday logic (`isHoliday`, `getHolidayDatesForYear`, `APP_TZ`). The new helper takes a precomputed `Set<string>` of holiday dates for the years spanned:

```ts
export function businessDaysBetween(from: Date, to: Date, holidays: Set<string>): number
```

- Counts weekdays (Mon–Fri) in CDMX (`APP_TZ` conversion at the boundary) minus dates present in `holidays`.
- Callers fetch holiday sets once per request (`getHolidayDatesForYear` for each year in range, memoized in-request) — no per-row queries, no N+1.
- Explicitly NOT vacation-aware: `availability.ts` also models per-FSR leave, but SLA measures the organization's obligation, not an individual's calendar. Documented in code comment to prevent future "reuse" from pulling vacations in.

---

## 4. Breach Semantics (exact)

```ts
export type SlaState = "ON_TRACK" | "AT_RISK" | "BREACHED" | "NOT_APPLICABLE";

export function getSlaState(args: {
  priority: number; createdAt: Date; seenAt: Date | null;
  resolvedAt: Date | null; statusName: string; now: Date; holidays: Set<string>;
}): SlaState
```

Rules:
1. `statusName === "CANCELADA"` → `NOT_APPLICABLE` (terminal without resolution obligation). Always first.
2. Response phase (no `seenAt` yet): elapsed = business days `createdAt → now`. `elapsed > responseTarget` → `BREACHED`; `≥ 80%` → `AT_RISK`; else `ON_TRACK`.
3. Resolution phase (`seenAt` set, still open): elapsed = business days `createdAt → now` vs `resolutionTarget`. Same 80% banding.
4. Closed (`resolvedAt` set): elapsed = business days `createdAt → resolvedAt` vs `resolutionTarget` → `BREACHED` or `ON_TRACK` (history: was it late?). AT_RISK never applies retroactively.
5. `resolvedAt` nulling on reopen (known issue, fixed by `incident-audit-trail`) does not corrupt SLA: while open, the clock runs against `now`; the audit log preserves when it previously closed.

Pure function of its inputs — trivially unit-testable, including pinned CDMX holiday/weekend cases (e.g., across 16 de septiembre, across a weekend).

---

## 5. Tracking + Reports Wiring

### Tracking (`src/lib/actions/tracking.ts`)
- `getIncidentsForTracking()` select already carries `type.priority` (Phase 2 slice 3) — add `createdAt`, `resolvedAt`, and first-`seenAt` (min over active assignments; compute in the action, not the query, to avoid grouped-subquery complexity).
- Attach `sla: SlaState` per incident DTO. UI renders a breach badge (destructive) / at-risk badge (amber) next to the priority badge. Reuses existing `Badge` atom.

### RF-518 breach report (`src/lib/actions/reports.ts`)
- New `getSlaBreachData()` returning per-type rows: `{ type, priority, total, breached, atRisk, onTrack }` over active, non-cancelled incidents in range. Same anti-division-by-zero percentage convention as RF-502.
- New table in the reports UI (`/admin/reports/...`), route TBD at apply. RF-509 (aging) and RF-510 (seen-time) stay untouched — the breach report links to them as drill-down inputs, which is exactly "turns describing reports into accountability" without rewriting them.

---

## 6. Why Not a Column (ADR)

Rejected: re-adding `sla Int` to `IncidentType` (the `20260517100000` shape). Reasons: (a) history shows the column was added then dropped — per-type scalars drift from the priority they duplicate; (b) two targets (response + resolution) don't fit one int; (c) code policy is tunable without migration and versioned in git. If admins later need custom targets, the follow-up is an admin-editable policy table — explicitly out of this change.

---

## 7. Spec Updates

- `spec/03-incidentes.md`: RF-218 (targets, bands, breach semantics, CANCELADA exclusion, vacation exclusion).
- `spec/09-reportes-tracking.md`: RF-518 (breach report shape + route) + cross-refs from RF-509/RF-510.

---

## 8. Slicing Plan

### Slice 1 — Policy + math + tests
`sla-policy.ts`, `businessDaysBetween`, `getSlaState`, pinned holiday/weekend unit tests. Zero UI, zero query changes — mergeable alone.

### Slice 2 — Tracking badge + RF-518 report + specs
DTO wiring, badges, `getSlaBreachData()` + table, spec updates.

---

## 9. Risks + Mitigations

| Risk | Mitigation |
|---|---|
| `seenAt` min-computation is slow on huge tracking sets | Computed in-memory over already-fetched assignments; benchmark at apply, paginate if needed |
| Target values disputed by operations | Policy file header marks them as tunable; slice 1 review is the decision point |
| Holiday set fetch per report run | `getHolidayDatesForYear` caches per request; years spanned are ≤ 2 in practice |

---

## 10. Next Recommended

`sdd-tasks` — task breakdown follows the 2-slice plan in section 8.
