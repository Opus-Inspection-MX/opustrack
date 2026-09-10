# Tasks: offline-field-capture

Change: offline-field-capture · Phase: tasks · Store: hybrid
Strategy: stacked-to-main (3 independent PRs, each <400 lines)
Delivery: ask-on-risk → chained; slice 2 gated on the §3.5(a) gate-vs-log decision

---

## SLICE 1 — Outbox + closeAssignment Idempotency

**PR target**: main
**Branch**: feat/offline-outbox-close
**Objective**: Draft store exists and `closeAssignment` is safe to retry.
**Satisfies**: RF-260 (outbox, close path)

### Tasks (sequential within slice)

- [ ] T1.1 — NEW outbox module (`src/lib/offline/outbox.ts` or apply-decided path): entry shape, localStorage persistence, attempt/backoff counters, byte/entry caps with user-confirmed eviction.
- [ ] T1.2 — Unit tests: round-trip persistence, backoff schedule (immediate/30s/5min → manual), quota-exceeded handling, cap enforcement.
- [ ] T1.3 — Server: `closeAssignment` accepts optional `idempotencyKey`/`capturedAt`; dedupe store (table vs column decided at apply + migration if table); 24h freshness rejection in Spanish via `rejected()`.
- [ ] T1.4 — Test: double-flush with the same key applies the close exactly once; stale `capturedAt` rejected; online callers without the new params unaffected.

**Verification (manual)**:
1. Focused tests pass (record command + result at apply time).
2. `npm run check` clean (knip: module imported by at least the close form).

**Rollback boundary**: revert module + action params (+ inverse migration if a table was added). Online close flow untouched.

**Estimated lines**: ~220 lines changed.

---

## SLICE 2 — Remaining Actions + Forms UX (gated on §3.5a)

**PR target**: main (after slice 1 merged)
**Branch**: feat/offline-actions-ux
**Objective**: All four actions draft-and-retry with pending UX.
**Satisfies**: RF-260 (start path), RF-261
**Depends on**: Slice 1 + the §3.5(a) gate-vs-log decision (flush-failure tests pin it)

### Tasks (sequential within slice)

- [ ] T2.1 — Server params (`idempotencyKey`/`capturedAt` + freshness + dedupe) on `startAssignmentWork`, `startVehicleTrip`, `endVehicleTrip`. No guard logic touched.
- [ ] T2.2 — FSR start/close screens: failure/offline → draft; pending badge + entry detail + Reintentar/Descartar (confirm).
- [ ] T2.3 — `trip-start-form.tsx` / `trip-end-form.tsx`: same pattern + staged-photo thumbnail (or documented photo-fallback if quota forces it).
- [ ] T2.4 — `online`-event auto-flush + manual flush; conflict errors render in the existing toast path.
- [ ] T2.5 — Flush tests pinning the §3.5(a) outcome (gate-denial vs log-auto-create); other variant ignored-with-reason.

**Verification (manual)**:
1. DevTools offline: start work → pending; reconnect → flushed + success toast.
2. `npm run check` clean.

**Rollback boundary**: revert form + param commits; slice 1 outbox + close path keep working.

**Estimated lines**: ~280 lines changed.

---

## SLICE 3 — E2E + Specs

**PR target**: main (after slice 2 merged)
**Branch**: feat/offline-e2e-spec
**Objective**: Full offline cycle proven end-to-end; specs updated.
**Satisfies**: RF-260/RF-261 (acceptance + docs)
**Depends on**: Slice 2 (all four paths flushable)

### Tasks (sequential within slice)

- [ ] T3.1 — E2E (ephemeral DB, offline simulation): all four actions persist offline and flush on reconnect with action-time GPS intact.
- [ ] T3.2 — E2E: stale draft (>24h) rejected in Spanish; moved-on server state (e.g., reassigned/closed) surfaces the standard business-rule error, entry kept.
- [ ] T3.3 — `spec/04-asignaciones.md` (RF-260) + `spec/06-vehiculos-viajes.md` (RF-261).
- [ ] T3.4 — Confirm 24h window + photo-fallback decisions with operations; record in spec notes.

**Verification (manual)**:
1. E2E suite green (record command + result at apply time).
2. `npm run check` clean.

**Rollback boundary**: revert E2E + spec commits; behavior unchanged.

**Estimated lines**: ~150 lines changed.

---

## Dependency Graph

```
main
  └─ feat/offline-outbox-close [Slice 1] ─ PR #1 → main
       └─ feat/offline-actions-ux [Slice 2, needs §3.5a] ─ PR #2 → main
            └─ feat/offline-e2e-spec [Slice 3] ─ PR #3 → main
```

---

## Review Workload Forecast

| Metric | Value |
|--------|-------|
| Chained PRs recommended | Yes (3 slices, ordered) |
| 400-line budget risk | Low — ~220 / ~280 / ~150 |
| Estimated changed lines total | ~650 lines (3 PRs) |
| Largest single PR | Slice 2 (~280 lines) |
| Decision needed before apply | YES — §3.5(a) gate-vs-log before slice 2; confirm 24h window + dedupe-store shape before slice 1 |

---

## Commit Map (work-unit-commits convention)

**Slice 1**:
- `feat(offline): add localStorage outbox with backoff and caps`
- `feat(assignments): make closeAssignment idempotent with freshness window`

**Slice 2**:
- `feat(assignments): draft-and-retry for startAssignmentWork`
- `feat(trips): draft-and-retry for trip start/end with staged photos`
- `feat(fsr): pending-draft badges with retry and discard`

**Slice 3**:
- `test(e2e): prove offline capture-retract-flush cycle for all four actions`
- `docs(spec): document RF-260 offline drafts and RF-261 trip drafts`
