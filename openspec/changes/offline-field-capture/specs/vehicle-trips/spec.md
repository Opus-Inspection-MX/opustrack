# Delta for Vehículos y Viajes (Domain 06)

> Change: `offline-field-capture` | RF range: RF-350–RF-399 | Spec file: spec/06-vehiculos-viajes.md
> Number: RF-261 continues the proposal's numbering (RF-260 lives in domain 04); no RF-261 exists in any range (verified).

---

## ADDED Requirements

### Requirement: RF-261 · Borradores offline y reintento para inicio/fin de viaje

The system MUST extend the RF-260 draft-and-retry mechanism to `startVehicleTrip` and `endVehicleTrip`: odometer readings, GPS fixes, timestamps, and trip photos captured in the field MUST persist locally on failure/offline and flush on reconnect under the same idempotency, freshness, and no-merge rules.

**Rules:**

- All RF-260 rules (frozen action-time evidence, idempotency keys, freshness window, unchanged guards, kept-on-conflict drafts, capped storage, flush triggers) apply unchanged.
- Trip photos are staged as local file refs and submitted as `File` in the retried payload (no base64 persistence). If device quota forces it, photo persistence MAY degrade first — but scalars + GPS + odometer MUST still persist, and the degradation is user-visible, never silent.
- Odometer monotonicity and all existing trip guards run at flush time against live server state.

#### Scenario: Trip start offline flushes with photo on reconnect

- GIVEN the FSR starts a trip offline with odometer reading, GPS, and photo
- WHEN connectivity returns and the draft flushes
- THEN the trip exists with the action-time reading, GPS, timestamp, and photo
- AND a duplicate flush does not create a second trip (idempotency key)

#### Scenario: Trip end conflicts with live state

- GIVEN a pending trip-end draft for a trip an admin already closed
- WHEN flush is attempted
- THEN the standard business-rule error is returned and the draft is kept for manual resolution
