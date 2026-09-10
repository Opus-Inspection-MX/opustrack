# Proposal: SLA from Priority (RF-218, RF-518)

## Intent

Phase 2 gave every `IncidentType` a priority (1–10, `CRITICAL_PRIORITY_THRESHOLD = 8`) — but priority currently has no teeth. The aging report (RF-509) and seen-time report (RF-510) *describe* delay without ever declaring a breach, so no one is accountable when a critical incident sits unseen. This change turns priority into **response and resolution targets with a breach flag computed in CDMX business days**, plus a breach report. History note: a bare `sla Int` column was added to `IncidentType` (`20260517100000`) and later removed (`20260609000000`) — this proposal deliberately does NOT restore a per-type column; targets live in one versioned policy keyed by priority band.

## Scope

### In Scope
- RF-218: response target (creation → first `seenAt`) and resolution target (creation → `CERRADO`) per priority band, derived from `IncidentType.priority`; breach flag computed in **CDMX business days** reusing `src/lib/utils/availability.ts` (holidays; weekends excluded; per-user vacations excluded — SLA counts shared holidays, not personal leave).
- Breach surfaced where decisions happen: tracking view badge + incident DTOs.
- RF-518: breach report (breached vs at-risk vs on-track counts, by type/priority).
- Spec/03 (RF-218) + spec/09 (RF-518, RF-509/RF-510 cross-refs).

### Out of Scope (Non-Goals)
- NO automatic escalation or notifications on breach (follow-up change; notification types are closed at 10).
- NO per-incident custom SLA override by admins.
- NO per-type `sla` column revival (explicitly rejected — see Approach).
- NO change to how RF-509/RF-510 compute raw elapsed times (they gain a breach sibling, not a rewrite).

## Capabilities

### New Capabilities
- None (new policy + computed flag on existing queries).

### Modified Capabilities
- `incidents`: RF-218 — SLA targets + breach flag derived from priority.
- `reportes-tracking`: RF-518 — breach report; RF-509/RF-510 referenced as inputs.

## Approach

One policy table in code (`src/lib/constants/` beside `CRITICAL_PRIORITY_THRESHOLD`, same precedent): priority bands reuse the badge buckets (critical 8–10, medium 5–7, low 1–4) with response/resolution targets in business days (exact values fixed at design). Breach is **computed on read**, never stored — no migration, no drift between stored flags and policy edits, and nothing to backfill. Business-day math reuses `isHoliday`/`getHolidayDatesForYear` from `availability.ts` (CDMX timezone already handled there). `CANCELADA` incidents are excluded from breach (terminal without resolution obligation); `resolvedAt` remains the resolution timestamp.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/constants/` (SLA policy) | New | Band → { responseDays, resolutionDays } + `isBreached()`/`businessDaysBetween()` helpers |
| `src/lib/utils/availability.ts` | Reused (no change expected) | Holiday-aware CDMX day counting |
| `src/lib/actions/tracking.ts` | Modified | Breach flag in tracking DTOs |
| `src/lib/actions/reports.ts` | Modified | RF-518 breach report query + types |
| Tracking + reports UI | Modified | Breach badge / report table |
| `spec/03-incidentes.md`, `spec/09-reportes-tracking.md` | Modified | RF-218, RF-518 |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Target values are a business guess | High | Policy is one constants file; values chosen at design, tunable in one-line follow-ups without migration |
| Business-day calc cost on large lists | Medium | Holidays fetched once per year-range and memoized per request; breach computed only for non-terminal incidents |
| Vacations confusion (availability.ts also models per-user leave) | Low | Design states explicitly: SLA uses holidays + weekends only, never personal vacations |

## Rollback Plan

Purely additive code (no migration). Revert commits; tracking/reports return to pre-breach DTOs. No data loss possible — nothing was stored.

## Dependencies

- Requires Phase 2 `IncidentType.priority` + threshold (shipped).
- **§3.5 decisions:** independent of both (a) gate-vs-log and (b) ScheduleStatus. Stated for completeness: breach math never consults `IncidentAssignee` or schedule state.

## Success Criteria

- [ ] Response/resolution targets defined per priority band in one policy module; no `sla` column re-added.
- [ ] Breach flag correct across a holiday and a weekend (tests pin CDMX cases).
- [ ] Tracking shows breach state; RF-518 report lists breached/at-risk/on-track by type.
- [ ] `CANCELADA` never counts as breached.
- [ ] spec/03 (RF-218) and spec/09 (RF-518) updated.
