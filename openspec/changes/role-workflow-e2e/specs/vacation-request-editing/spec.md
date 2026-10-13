# Vacation request editing specification

## Purpose

Add RF-711, the next free vacation ID after RF-710. Existing RF-701/702/706/709 and all their scenarios remain unchanged. This capability adds pending editing; approval, started corrections and cancellation retain their current semantics.

## Requirements

### Requirement: RF-711 · Pending request editing with atomic reservation replacement

The system MUST allow users with `vacations:update` to edit dates and optional reason of an active PENDIENTE request. EMPLEADO and FSR MUST be limited to their own requests; managing another holder MUST additionally require `vacations:manage`. The holder MUST be immutable, including for administrators. The shared permission catalog and an additive idempotent migration MUST grant `vacations:update` to EMPLEADO, FSR and ADMIN_VACACIONES, preserving existing grants and ROOT behavior.

Date validation, civil CDMX normalization, non-admin past-date restrictions, explicit reason for admin retroactive requests, overlap, chargeable-day calculation, period eligibility and balance MUST follow RF-701. The current request MUST be excluded from its own overlap and funding reservation checks, including candidate-period selection; historical consumption and other requests MUST remain included. The replacement MUST reserve its whole range in one valid period or reject atomically. Explicit period selection MUST be honored or rejected, never silently substituted. Reason-only changes MUST preserve funding and charge snapshots.

The edit and append-only actor-attributed before/after evidence MUST commit together. A pending date edit MAY replace its provisional `chargedDates`/`businessDaysUsed`/funding period; it MUST NOT rewrite grant snapshots, approved requests, original approval metadata or historical correction evidence. An edit submitted after approval, rejection or cancellation MUST reject without altering the winning decision, reservation or audit history. Business-rule failure MUST be returned to the operator; the draft MUST remain available for correction.

#### Scenario: Own pending edit replaces its reservation
- GIVEN an employee's pending request reserving two days and only one additional available day
- WHEN the employee edits it to a valid three-chargeable-day range
- THEN the same request and holder persist with a three-day reservation, not a five-day cumulative charge
- AND before/after evidence records the actor, old/new dates, reason and funding snapshots.

#### Scenario: Administrator edits another holder's pending request
- GIVEN an administrator with update and manage permissions and another employee's pending request
- WHEN the administrator edits dates/reason through administration UI
- THEN the request remains pending for its original holder and the new valid reservation is visible to both roles.

#### Scenario: Ownership and immutable holder fail closed
- GIVEN an employee's request and a different employee with update permission
- WHEN the different employee attempts to read an edit surface or submit an edit, or any actor submits a changed holder
- THEN access or mutation is denied and the original request, holder, balance and audit are unchanged.

#### Scenario: Changed decision rejects a stale draft
- GIVEN a pending edit draft and another actor who approves, rejects or cancels that request
- WHEN the stale edit is submitted
- THEN the edit rejects and preserves the winning status, approval metadata, snapshots and balance.

#### Scenario: Invalid replacement rolls back
- GIVEN a pending request with an existing reservation
- WHEN an edit overlaps another consuming request, exceeds eligible balance, spans invalid periods, has zero chargeable days, or violates date/reason rules
- THEN the edit rejects and retains the complete old reservation and request with no successful-edit audit entry.

#### Scenario: Reason-only edit preserves snapshots
- GIVEN a pending request with stored dates, period, charge dates and consumption
- WHEN only the optional reason changes
- THEN the reason and actor-attributed audit change while all funding and charge snapshots remain identical.

#### Scenario: Correction and cancellation stay distinct from editing
- GIVEN an approved request and own/admin UI controls
- WHEN the user seeks an edit or cancellation
- THEN pending editing is unavailable; cancellation uses existing RF-709 guards, and a started approved request only permits its authorized, reasoned shortening correction
- AND approved snapshots and original approval remain preserved.

#### Scenario: Idempotent permission rollout
- GIVEN existing role/permission data
- WHEN the additive grant migration is applied and its grant statements are replayed
- THEN the three specified roles each hold one update grant and all unrelated permissions and requests remain unchanged.
