# Delta for Incidentes (Domain 03)

> Change: `sla-from-priority` | RF range: RF-200–RF-249 | Spec file: spec/03-incidentes.md
> Free number verified: RF-217 taken by `incident-evidence-photos`; RF-218 is next free.

---

## ADDED Requirements

### Requirement: RF-218 · Objetivos SLA por prioridad y bandera de incumplimiento

The system MUST define response and resolution targets per `IncidentType.priority` band and MUST compute a breach state per incident in CDMX business days. Targets live in a single versioned code policy (NOT a database column — the `sla` column added in `20260517100000` and removed in `20260609000000` MUST NOT be revived).

**Rules:**

- Bands reuse the priority-badge buckets: critical (8–10), medium (5–7), low (1–4). Each band has a `responseBusinessDays` target (creation → first `seenAt`) and a `resolutionBusinessDays` target (creation → `CERRADO`).
- Business days are Monday–Friday in CDMX minus official holidays from `src/lib/utils/availability.ts`. Per-user vacations MUST NOT count (SLA measures the organization's obligation).
- Breach state per incident: `ON_TRACK` | `AT_RISK` (≥80% of the applicable target consumed) | `BREACHED` | `NOT_APPLICABLE`.
- Incidents in `CANCELADA` MUST always resolve to `NOT_APPLICABLE`, never breached.
- The flag is computed on read, never stored. Policy edits apply immediately with no migration or backfill.
- The breach state MUST be exposed in tracking DTOs (badge) alongside the priority badge.

#### Scenario: Critical incident unseen past its response target breaches

- GIVEN a critical-band incident (priority ≥ 8) with no `seenAt`, created more than `responseBusinessDays` business days ago
- WHEN tracking renders it
- THEN its SLA state is `BREACHED`

#### Scenario: Weekend and holiday do not consume the clock

- GIVEN an incident created the Friday before a holiday Monday
- WHEN breach is evaluated on Tuesday
- THEN elapsed business days exclude Saturday, Sunday, and the holiday

#### Scenario: Cancelled incident never breaches

- GIVEN an incident in `CANCELADA`, however old
- WHEN breach is evaluated
- THEN the state is `NOT_APPLICABLE`
