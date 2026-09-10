# Delta for Reportes y Tracking (Domain 09)

> Change: `sla-from-priority` | RF range: RF-500–RF-549 | Spec file: spec/09-reportes-tracking.md
> Free number verified: RF-500–RF-517 taken; RF-518 is next free.

---

## ADDED Requirements

### Requirement: RF-518 · Reporte de incumplimiento SLA

The system MUST provide an SLA breach report aggregating incidents by type: totals plus `breached`, `atRisk`, and `onTrack` counts computed from RF-218 semantics. This report turns the descriptive aging (RF-509) and seen-time (RF-510) reports into accountability — they remain unchanged and serve as drill-down inputs.

**Rules:**

- Scope: active, non-`CANCELADA` incidents in the selected range, under the caller's `getReportScope()` Cliente filter (fail-closed, transversal rule 4).
- Percentages follow the RF-502 anti-division-by-zero convention.
- Each row links to the underlying RF-509 / RF-510 views for the same type/range.

#### Scenario: Breach report reconciles with tracking badges

- GIVEN the same date range and Cliente scope
- WHEN the RF-518 report is generated and tracking is viewed
- THEN the per-type breached counts equal the number of `BREACHED`-badged rows of that type in tracking
