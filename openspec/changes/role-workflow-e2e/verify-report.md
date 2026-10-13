# Verification Report — role-workflow-e2e

Date: 2026-10-13 (final run)

## Commands executed

| Command | Result |
|---------|--------|
| `npm run check` (biome + tsc + knip) | **0 errors** (729 files) |
| `npm run test:unit` | **1721 passed / 0 failed** (168 files) |
| `npm run test:int -- --run src/test/integration/vacations-update.int.test.ts` | **8 passed / 0 failed** (612ms; P2034 retry noise expected from serializable races) |
| `npm run test:e2e:workflows` (dedicated runner, isolated ephemeral DB, 1 worker, prod build) | **8 passed / 0 failed** in 2.3m |
| Focused main journey: `npm run test:e2e:workflows -- --grep "close only after the last sibling"` | **passed** in 55.2s |

## What the workflows run proves (all through authenticated UI)

- Vacation pending edit (RF-711): immutable holder, own-excluded replacement
  balance, snapshot/audit corroboration; approval/rejection and
  cancellation paths through the admin/own UI.
- Availability (RF-262): absent FSR disabled in create/edit/tracking
  selectors; removal of an already-selected unavailable FSR allowed,
  additions blocked.
- Field UX (RF-263): activity retry of failed attachments only; trip forms
  keep capture identity across retries.
- Main incident journey: report → program → two separate assignments →
  VISTO/INICIADO/EN_PROGRESO phases → activity evidence (decoded images) →
  two concurrent EN_CURSO trips on two vehicles → independent closure →
  automatic parent closure after the LAST sibling → admin review of ODTs,
  GPS, timestamps, decoded photos (RF-201/202/252–259/263/264/357/365/402/408).
- RF-265 route-over-`public/` precedence: freshly written attachment files
  (reporter image, activity evidence, odometer photos) decode through the
  dynamic uploads route during the run.

## Defects found and fixed during verification

1. **RF-265 (real product defect)**: `next start` does not serve files added
   to `public/` after startup — fresh uploads returned 400s from
   `/_next/image`. Fixed with `src/app/uploads/[...path]/route.ts`
   (per-request disk read, traversal-guarded, extension content types,
   immutable cache) + unit tests; spec/04 and business-invariants updated.
2. **Assignment full-edit dead save (real defect)**: the form sent a literal
   `incidentId: 0` which failed `intIdSchema`, rejecting every full-edit
   save. `updateAssignment` now accepts an optional `incidentId` (resolved
   from the assignment) and the form no longer sends it; component test pins
   the absence.
3. **Soft-delete contract**: `updateVacation` read tightened to
   `findUnique({ where: { id, active: true } })`; coverage registry entry
   added for the action.
4. **Test infra**: unbounded `page.waitForURL`/clicks now bounded
   (`actionTimeout`/`navigationTimeout: 60s` in the workflows project),
   click+navigation races use `Promise.all`, `waitForURL` uses
   `domcontentloaded` (load can block on slow image optimizer), `decodedImage`
   polls `img.complete` bounded instead of awaiting `img.decode()` unbounded,
   and trace cleanup no longer masks the original failure when a timed-out
   context cannot stop tracing.

## Notes

- Migrations run before seed on fresh DBs: the `vacations:update` grant ships
  in both the migration and `initial_load/seed.example.ts` (private seed
  uses the shared catalog).
- No raw writes to tested business entities: fixture writes are
  prerequisites only; every tested transition goes through the UI.
- No commits made (BUILD mode, working tree only).
