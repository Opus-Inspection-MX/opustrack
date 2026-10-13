# Design: Implementable role workflow contracts

## Technical Approach

Build RF-711 and RF-262–264 on existing actions and UI, then implement WF-01–03 as isolated authenticated browser workflows. `spec/*.md` is authoritative; preserve old RF text/scenarios. RF-261 already belongs to trip retries. This is BUILD-mode artifact preparation; `openspec/config.yaml` policy stays `execution_mode: interactive`.

## Architecture Decisions

| Decision | Choice and rationale | Alternative and tradeoff |
|---|---|---|
| Vacation mutation | Dedicated `updateVacation` in `vacations.ts`, serializable replacement with own-request exclusion | Delete/recreate loses identity and can release reservation before replacement commits |
| Before/after evidence | Existing append-only `BusinessCorrection`, `entityType: "Vacation"`, operation marker in snapshots | Extending generic AuditLog adds enum/schema work and weakens its free-text privacy boundary |
| Availability | Authenticated scoped Server Action, shared hook/selector; use existing holiday/vacation policy | Client-only calculation becomes stale and exposes absence data; it cannot authorize saves |
| Upload retry | Explicit committed-activity/failed-file client state | Re-running full submit duplicates activity; broad new offline protocol exceeds scope |
| Workflow runner | Dedicated npm invocation using existing fresh-stack lifecycle, project opt-in and one worker | General full-suite run shares calendar and repeats workflows across browser projects |
| Closure | Existing assignment machine and `syncIncidentState` | Admin approval before closure contradicts RF-202/257 and approved plan |

## Verified Baseline

- `vacations.ts` has create/approve/reject/delete/correct actions, but no pending update. Own/admin reads already scope by `vacations:manage`.
- `getPeriodBalance` includes active PENDIENTE/APROBADA and historical funding; `resolveVacationPeriod` calls it during explicit/candidate selection. Exclusion must reach both paths, not only the final balance check.
- `AuditEntity`/`AUDIT_PAYLOAD_ALLOWLIST` has no Vacation member; `correctStartedVacation` already stores private domain evidence in `BusinessCorrection` within its transaction.
- `MultiSelectOption` lacks per-option disabled semantics. Tracking assignment DTO/form lacks `scheduledDate`, so the UI currently cannot evaluate its effective date.
- Activity upload code only counts rejected promises; fulfilled unsuccessful ActionResults are incorrectly treated as successes, and full retries recreate the activity.
- ODT save/cancel are icon-only and the input has no label. Admin detail displays timestamps/attachments but not ODT or GPS coordinates.
- `scripts/e2e.mjs` creates/migrates/seeds/builds a new stack and always cleans up. It shares the fixed compose project/port with integration tests, so overlapping invocations are prohibited.

## Interfaces / Contracts

Suggested names are implementation contracts; workers may refine internal naming while preserving the payload/behavior boundaries.

```ts
type VacationUpdateInput = {
  startDate: Date; // calendar field encoded at UTC midnight, as createVacation
  endDate: Date;
  reason?: string | null;
  periodId?: string; // explicit selection honored; omission resolves by policy
};
// Strict runtime schema rejects unknown userId/status/approval fields.
updateVacation(id: string, input: VacationUpdateInput): Promise<ActionResult<Vacation>>;

// Trusted service-only option; only updateVacation supplies a validated own pending ID.
type ReservationReadOptions = { excludeVacationId?: string };
getPeriodBalance(periodId, tx?, options?): Promise<PeriodBalance>;
resolveVacationPeriod(userId, start, end, tx?, preferredPeriodId?, requiredDays?, options?);

type FsrAvailabilityRequest = {
  incidentId: number;
  assignmentId?: string;
  scheduledDate: string | null; // validated YYYY-MM-DD civil CDMX day
};
type FsrAvailabilityRow = {
  userId: string;
  unavailable: boolean;
  reason: "HOLIDAY" | "APPROVED_ABSENCE" | null; // no private free text/absence IDs
};
getAssignmentFsrAvailability(request: FsrAvailabilityRequest): Promise<ActionResult<{
  date: string | null;
  fsrs: FsrAvailabilityRow[];
}>>;

// Add optional disabled/disabledReason to shared option shape, default false.
type AvailabilityState = "idle" | "loading" | "ready" | "error";
// Key hook results by incidentId + assignmentId + effective date + request generation.
```

Import `ActionResult` from `src/lib/actions/result.ts` and use the existing success/data shapes. Avoid client-imported runtime service modules; share DTOs with type-only imports or a small contract module.

## Vacation Mutation and UI

1. Require `vacations:update`; parse strict update schema using `safeParse` or existing guarded error conversion so invalid business input returns an operator-facing rejection. Holder comes exclusively from the loaded request.
2. Inside `serializableTransaction`, load active row/status/holder, enforce own-or-manage and PENDIENTE by stable code. Normalize civil date keys using create's UTC-field → `mxDayRange` convention; capture the current CDMX day per action, not client time.
3. If dates/funding change, apply create's date/retroactive reason rules, compute charge dates with `tx`, reject zero charge, and check consuming overlap with `id: { not: id }`. Resolve one eligible period with own-reservation exclusion propagated to every balance read.
4. Exclusion filters BOTH aggregate consuming reservations and the dated reservation list passed to historical balance policy. It never excludes historical ledger consumption. Do not globally deactivate the request or subtract its cost from an unrelated period. Default options preserve every existing caller.
5. Reason-only edit leaves dates, period, consumption and chargedDates untouched; do not recalculate with changed holidays. A submitted explicit different period is a funding change, not reason-only.
6. Conditionally update `id + active + PENDIENTE` (and loaded mutable values where practical). Serializable retries re-read the live row; approval/rejection/cancellation winner leads to business rejection, not automatic resurrection.
7. Append one `BusinessCorrection` with actor, `entityType: "Vacation"`, fixed nonempty operation description (e.g. `Pending vacation request edited`), and before/after snapshots containing `operation: "PENDING_EDIT"`, holder, dates, request reason, period, chargedDates, consumption, status/approval metadata and prior correctionHistory. This is edit evidence, not an approved-shortening operation; retain original approved/correction evidence unchanged. Audit failure rolls the update back.
8. Revalidate `/vacations` and `/admin/vacations` after success. Do not add a new notification type; existing decision/cancel/correction delivery remains post-commit.

```mermaid
sequenceDiagram
  participant UI as Own/Admin edit dialog
  participant A as updateVacation
  participant T as Serializable transaction
  UI->>A: immutable request ID + dates/reason/period
  A->>T: load active pending row; authorize holder
  T->>T: own-excluded overlap/funding + provisional charge replacement
  T->>T: conditional pending write + BusinessCorrection before/after
  alt decision won or invalid replacement
    T-->>A: rollback / business rejection
    A-->>UI: failure; preserve draft
  else committed
    T-->>A: updated request
    A-->>UI: success; refresh lists/balance
  end
```

Prefer reusable `vacation-request-actions.tsx` and `vacation-edit-dialog.tsx` on desktop rows/mobile cards in both pages. Load current scoped request through `getVacationById` when opening; provide holder read-only, date/reason fields and eligible period selection. `canPerform` drives render hints, Server Actions enforce ownership/status. Edit is visible only for active pending requests. Cancellation confirmation calls `deleteVacation(id)` and preserves its existing notifications and started guards. Reuse `VacationApprovalButtons` for decisions/correction; do not duplicate or relax its correction controls. Use current Spanish UI copy conventions, with professional operator messages; technical artifacts/identifiers stay English.

## Availability and Composition

- Put the new action at `src/lib/actions/assignment-availability.ts`, shared hook at `src/hooks/use-fsr-availability.ts`, and optional reusable control at `src/components/assignments/fsr-availability-select.tsx`.
- Action requires `assignments:manage-all` plus actual assignment/incident scope access; load incident and, if supplied, verify assignment belongs to it. Derive active FSR candidates server-side via `whereHasRole`, using existing incident enablement/suggestion rules. Do not trust arbitrary client user IDs or leak inaccessible incident/absence records.
- Reuse `isHoliday`/`isFsrUnavailable` policy. Select only approved absence existence/holder when an explanation category is needed; never select or serialize Vacation.reason. With null date return neutral availability (deferred semantics), not an invented today fallback.
- Add `scheduledDate` to tracking query projection, `TrackingAssignment`, assignment edit/new drafts and action payloads. Tracking creation must include a date input; existing composition uses persisted date unless explicitly edited. Confirm `updateAssignmentDetails` plumbing routes actual date mutation through existing authoritative composition/update path; do not add generic status writes.
- Hook invalidates readiness immediately when date/incident/editor changes. Increment a generation token; accept only matching generation/key and mounted/open editor. Surface loading/error; disable new selection during unresolved lookups but allow removal and retry. Refresh after a guarded save rejection.
- Keep unavailable selected IDs in option maps even if candidate results change. Disabled applies to adding; selected item deselection/chip removal remains possible. Overflow offers a keyboard-accessible removal path. Whole-control disabled during mutation still prevents all edits. Missing selected labels use safe existing identity labels, not silently dropped values.
- Apply identical behavior to `assignment-form.tsx`, `assignment-edit-form.tsx`, and every assignment create/composition control in `tracking-table.tsx` (desktop/mobile). Incident enablement controls have no assignment work date and retain their domain semantics.
- Existing server create/update/tracking guards stay transactional and authoritative. Verify final-set removal/replacement behavior from `spec/04`; preserve null-date semantics and no automatic reassignment on vacation approval.

## Field UX and Review

In `AssignmentActivityForm`, maintain phases `editing → creating → uploading → partial/complete` with `committedActivityId`, frozen description and per-file stable local identity/status. On fulfilled upload inspect `isFailure(result.value)`; on rejected promise retain its error. Store successful files separately and retry only failed files. Once committed, skip create on all retries, lock description or clearly separate a new activity, and call `onSuccess`/reset only on complete. Always clear loading in `finally`; keep failure details and pending files until retry or explicit leave. Do not claim cross-reload/ambiguous transport exactly-once semantics without an existing receipt. Attachments remain assignment-level, as the schema requires.

In `OdtFolioCapture`, connect Label/input ID; name save/cancel distinctly and mark decorative icons hidden. Retain current save failure/cancel semantics. In admin `[id]/page.tsx`, display `odtFolio`, `startLatitude/startLongitude`, `endLatitude/endLongitude`, `startedAt/finishedAt`, optional addresses and existing attachments/activities. Use null checks so zero coordinates display. Prefer semantic sections/definition lists over additional actions.

## Workflow Fixtures, Calendar and Runner

- Add `test:e2e:workflows`: proposed command `node scripts/e2e.mjs --workflows`. Consume this flag in the runner; set `E2E_WORKFLOWS=1`, pass `--project=workflows --workers=1`, prevent conflicting project/worker overrides, and reuse guarded prepare/build/finally cleanup. A fresh invocation is independent of earlier normal suites; fixed shared-stack runners must not execute concurrently.
- Define opt-in `workflows` project in `playwright.config.ts`, `testMatch: /workflows\/.*\.spec\.ts$/`, `fullyParallel: false`, `workers: 1` where supported, and Chromium fallback consistent with existing projects. Explicitly exclude workflow paths from EVERY other browser/flow project. Synthetic workflow contexts log in through UI using `fixtures/login.ts`; do not depend on shared root-admin storage state or general fixture actions that seed business records.
- Introduce `e2e/fixtures/workflows.ts` for synthetic identities/hierarchy/vehicles/calendar and cleanup, `e2e/fixtures/workflow-ui.ts` for reusable UI handoffs, `e2e/workflows/{incident-role-workflow,vacation-role-workflow}.spec.ts` for cases. Namespace records per test/retry; prerequisites are fresh, and cleanup is owned by fixtures plus final stack destruction.
- Calendar setup uses actual `mxDateString(new Date())`. In this isolated opt-in run only, temporarily deactivate seeded holiday rules that would block the field date (snapshot/restore active flags). Add explicit synthetic holidays for holiday validation cases outside the operational range. Sunday is not automatically unavailable under RF-703; for the candidate vacation include the next chargeable day so a Sunday-only zero-charge request is never needed.
- Grant configuration/hire dates must give synthetic users already-earned entitlement and sufficiently long grace windows (cover near-year-end future vacation/correction ranges in one eligible current/prior grant). Configure prerequisites before lazy period generation; do not rewrite generated grant snapshots or create future unearned cycles. Derive dates by civil-day arithmetic, account for Sundays/holidays and year transitions. For a started correction use admin UI retroactive creation with explicit reason and then UI approval, never inserted APROBADA rows. Capture setup day; if midnight changes it mid-flow, fail clearly and clean up rather than rewrite business dates or time.
- Actual images: reuse a valid small PNG/JPEG buffer or generated browser image, not a text buffer named `.jpg`. Scope each preview to its incident/assignment/trip, await `HTMLImageElement.decode()` and `naturalWidth/Height > 0`. Start/end trip photos are distinct captures; screenshots document outcomes but do not replace upload decoding.
- UI helpers must return IDs from navigated hrefs/visible folios, with read-only DB lookup allowed as corroboration. Never call actions directly or mutate domain entities from browser evaluation/API request for a tested transition. Negative cross-owner routing is exercised by authenticated navigation; hidden malicious fields/server guards are additionally unit/integration-tested.

## Workflow Sequence and Evidence

1. Candidate A requests vacation, vacation admin approves it through UI; vacation request includes actual work day and a chargeable day.
2. REPORTER reports center incident with decoded image. Operations creates/edits schedule and selects that exact incident; assert persisted shared ID/link and no substitute.
3. Operations sees candidate A disabled and chooses B/C for two dated sibling assignments. Separate selector scenarios cover full edit/tracking replacement of an already-selected unavailable person, using UI-created requests and approval after assignment creation.
4. B and C each acknowledge/start/pause/resume through their own contexts with distinct geolocation. Interleave phases and assert one mutation does not advance sibling state.
5. Each starts an assignment-linked trip on its separate vehicle while the assignment is open; verify both trips can be EN_CURSO simultaneously. Each adds activity/image and accessible ODT, finishes its own trip with final photo/reading, then closes its assignment with GPS.
6. Assert after first close: first assignment CERRADO, second open, incident nonterminal. After last close: both CERRADO and parent CERRADO/resolved. Admin subsequently reviews distinct ODTs/GPS/activity images and completed trips/km/photos.
7. Vacation cases separately cover own/admin create/edit/read/cancel, approval/rejection release, started correction and negatives. Keep failure cases isolated and preserve draft/state evidence.

## File Changes and Worker Boundaries

| Work unit | Concrete paths | Boundary |
|---|---|---|
| Vacation backend/RBAC | `src/lib/actions/vacations.ts`, `src/lib/services/vacation-periods.ts`, `src/lib/validations/vacations.ts`, `src/lib/authz/permission-catalog.ts`, `prisma/migrations/<timestamp>_vacations_update_permission/migration.sql` | Own exclusion, update/audit and exact grants; no schema enum expansion |
| Vacation UI | `src/components/vacations/vacation-{request-actions,edit-dialog}.tsx` (new), `src/app/vacations/page.tsx`, `src/app/admin/vacations/page.tsx`, existing form/planner/approval components as needed | Shared backend contract; reusable row/mobile actions |
| Assignment selector | New availability action/hook/control; `src/components/ui/multi-select.tsx`, both assignment forms, `src/components/tracking/tracking-table.tsx`, `src/lib/actions/tracking.ts` | Coordinate shared tracking/action payloads; retain server guards |
| Field UX/review | `src/components/assignments/{odt-folio-capture,assignment-activity-form}.tsx`, `src/app/admin/assignments/[id]/page.tsx` and focused component tests | No activity schema rewrite or closure gate |
| Workflow infra/tests | `package.json`, `playwright.config.ts`, `scripts/e2e.mjs`, `e2e/fixtures/workflow*.ts`, `e2e/workflows/*.spec.ts`, `e2e/README.md` | One runner owner; fixtures prerequisites only |
| Domain synchronization | Append RF-711 to `spec/10-festivos-vacaciones.md`; RF-262–264 to `spec/04-asignaciones.md`; update traceability in `docs/business-invariants.md` as needed | Preserve all old requirement blocks/scenarios and existing RF-261 |

## Testing Strategy (Later Implementation)

| Layer | Required evidence |
|---|---|
| Unit/action | Own/admin permissions, holder rejection, terminal status, own-excluded period selection including historical ledger, reason-only snapshot preservation, invalid rollback/audit failure, exact catalog grants |
| Component | Latest availability result wins; loading/failure state, disabled add/removable selected/overflow, ODT accessible save/cancel, rejected and fulfilled-failure upload batches retry without duplicate create |
| Integration | Real serializable update vs decision/cancel, competing balance replacement, committed audit before/after and untouched historical snapshots; idempotent grant statements |
| E2E | WF-01–03 via authenticated UI; real image decoding; own/admin vacations and independent sibling/trip evidence |
| Checks | `npm run check`, focused unit tests, `npm run test:int`, dedicated workflow invocation, and `npm run build` as appropriate; artifact agent executes none |

## Threat Matrix

Runner process integration is applicable; the shared matrix rows below are explicitly classified.

| Boundary | Applicability | Safe/failure behavior | Planned RED tests |
|---|---|---|---|
| Documentation-like paths (`requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh`) | N/A — no file execution classification | No classification added | None |
| Git repository selection (`git -C`, relative/absolute selectors) | N/A — no git subprocess/selector | Workspace paths do not select git operations | None |
| Commit state (staged, `commit -a`, empty index) | N/A — no commits | No index mutation | None |
| Push state (tracking, first push, explicit refspec) | N/A — no push | No remote mutation | None |
| PR commands (`--head`, environment prefixes, composition) | N/A — no PR automation | No PR execution | None |
| Workflow invocation/process environment | Applicable — new runner flag/project boundary | Argument arrays with `shell:false`; flag consumed, one project/worker, ephemeral URL guard, nonzero child failure and cleanup in finally/signals; reject conflicting overrides before stack startup | Runner tests mock subprocess/lifecycle: flag consumption, conflict rejection, prepare/build/browser failure cleanup, SIGINT/SIGTERM cleanup; preserve existing unsafe-URL rejection test |

## Migration / Rollout and Rollback

Add `vacations:update` definition to catalog and explicit grants for EMPLEADO/FSR/ADMIN_VACACIONES. Do not add it to `SELF_SERVICE_VACATIONS` blindly: that shared group also grants ADMIN_OPERACION. Keep requested grants explicit unless the approved role catalog already establishes broader intent. ROOT remains implicit superuser; mirror normal root seed conventions without changing unrelated roles. Migration upserts permission by unique name and role grants by role code/composite unique key, preserves IDs/grants and can replay safely. Follow existing SQL ID/default/active conventions. Apply migration before deploying new action/UI; do not seed/reset as deployment. Existing route claims do not change; DB permission checks remain authoritative and any in-process permission cache needs normal invalidation/restart.

Rollback app/UI/test code and retain additive grants, edit receipts and all correction/approval evidence. No production operation is executed during this task.

## Open Questions

No unresolved product choices. Shared-stack invocations must be serialized. Review-size forecast and suggested slices are recorded in tasks for the coordinator; this artifact agent does not open PRs or start implementation workers.
