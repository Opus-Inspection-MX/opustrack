# Tasks: sla-from-priority

Change: sla-from-priority · Phase: tasks · Store: hybrid
Strategy: stacked-to-main (2 independent PRs, each <400 lines)
Delivery: ask-on-risk → single PR acceptable if slice 2 stays small; chain otherwise

---

## SLICE 1 — Policy + Math + Tests

**PR target**: main
**Branch**: feat/sla-policy-math
**Objective**: `SLA_POLICY`, business-day math, and `getSlaState` exist with pinned CDMX tests. No consumers yet.
**Satisfies**: RF-218 (policy + semantics)

### Tasks (sequential within slice)

- [ ] T1.1 — NEW `src/lib/constants/sla-policy.ts`: bands, targets, `slaBandForPriority` (exact values confirmed at apply per design §2).
- [ ] T1.2 — Business-day helper (`businessDaysBetween`) reusing `getHolidayDatesForYear`/`APP_TZ`; explicit code comment excluding per-user vacations.
- [ ] T1.3 — `getSlaState` with the 5 rules from design §4 (`CANCELADA` first, 80% at-risk band, closed-history semantics).
- [ ] T1.4 — Unit tests: breach across a weekend; breach across a real CDMX holiday; at-risk boundary at 80%; `CANCELADA` → `NOT_APPLICABLE`; closed-late → `BREACHED` from `resolvedAt`.

**Verification (manual)**:
1. Focused test command passes (record command + result at apply time).
2. `npm run check` clean.

**Rollback boundary**: revert two new modules + tests. Nothing consumes them.

**Estimated lines**: ~150 lines changed.

---

## SLICE 2 — Tracking Badge + Breach Report + Specs

**PR target**: main (after slice 1 merged)
**Branch**: feat/sla-breach-surface
**Objective**: Breach visible in tracking and in the RF-518 report; specs updated.
**Satisfies**: RF-218 (surface), RF-518
**Depends on**: Slice 1 (policy + `getSlaState`)

### Tasks (sequential within slice)

- [ ] T2.1 — `src/lib/actions/tracking.ts`: attach `sla: SlaState` to tracking DTOs (first-`seenAt` computed in-action).
- [ ] T2.2 — Tracking UI: breach/at-risk badges next to the priority badge.
- [ ] T2.3 — `src/lib/actions/reports.ts`: NEW `getSlaBreachData()` (per-type breached/at-risk/on-track, RF-502 percentage convention).
- [ ] T2.4 — Reports UI: RF-518 breach table with drill-down links to RF-509/RF-510 views.
- [ ] T2.5 — `spec/03-incidentes.md` (RF-218) + `spec/09-reportes-tracking.md` (RF-518, cross-refs).
- [ ] T2.6 — E2E (ephemeral DB): seeded overdue critical incident appears breached in tracking and in the report.

**Verification (manual)**:
1. Tracking view shows breach badge on an overdue critical incident, none on a fresh low-priority one.
2. Breach report counts reconcile with tracking badges for the same range.
3. `npm run check` clean.

**Rollback boundary**: revert DTO/UI/report commits; slice 1 policy module remains (harmless, tested).

**Estimated lines**: ~250 lines changed.

---

## Dependency Graph

```
main
  └─ feat/sla-policy-math    [Slice 1] ─ PR #1 → main
       └─ feat/sla-breach-surface [Slice 2] ─ PR #2 → main
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Chained PRs recommended | Yes if slice 2 approaches budget |
| 400-line budget risk | Low–Medium — ~150 / ~250 |
| Estimated changed lines total | ~400 lines (2 PRs) |
| Largest single PR | Slice 2 (~250 lines) |
| Decision needed before apply | Yes — confirm target day-values in design §2 with operations |

---

## Commit Map (work-unit-commits convention)

**Slice 1**:
- `feat(sla): add priority-band policy and CDMX business-day breach math`
- `test(sla): pin breach semantics across weekends, holidays, cancellation`

**Slice 2**:
- `feat(tracking): surface SLA breach state on tracking rows`
- `feat(reports): add RF-518 SLA breach report`
- `docs(spec): document RF-218 SLA targets and RF-518 breach report`
