# Tasks: Role workflow E2E

All checkboxes are initially pending. This file is an implementation handoff, not a claim that application code or tests have been implemented. Dependency order is vacation backend → vacation UI; selector/field UX can proceed independently; workflows integrate all contracts last. Shared files have one owner.

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines | 2,000–3,500 including tests/docs; planning estimate, not measured diff |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Vacation reservation/action → vacation UI → availability/control → assignment/tracking wiring → field UX/review → runner/fixtures → vacation workflows → incident workflow |
| Delivery strategy | `auto-chain` resolved by coordinator for bounded implementation/review slices U1–U8; publishing remains separately authorized |
| Chain strategy | `feature-branch-chain` planned for future review delivery; this invocation writes implementation and evidence without committing or opening PRs |

Decision needed before apply: No — bounded work units resolved by coordinator
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain (review packaging; no publication in this invocation)
400-line budget risk: High

The decision above concerns review packaging, not another product approval. Implement only the assigned bounded work units; do not add an approval gate to the business flow. Slice further when a unit exceeds 400 authored changed lines; keep tests/docs with each behavior and do not compress code to disguise size. Report unavoidable per-unit overages honestly for later review packaging.

### Suggested Work Units

Commands below are planned implementation verification, not commands executed by the artifact agent. E2E commands become available after runner wiring. Use current installed tools; preserve database isolation and serialize shared-stack invocations.

| Unit | Start → finish / likely review slice | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|
| U1 | Existing create-only API → atomic pending edit, audit and exact permission rollout | `npm run test:unit -- vacations-update vacation-periods permission-catalog` | `npm run test:int` covering real edit/decision/funding races | Update action/schema, trusted service exclusion and additive catalog; retain grants/audit on app rollback |
| U2 | U1 API → own/admin edit/cancel controls | `npm run test:unit -- vacation-edit-dialog vacation-request-actions` | Own/admin UI cases through `npm run test:e2e:workflows -- --grep vacation` after U6 | Vacation UI components and page wiring; backend remains usable |
| U3 | Undated candidate hints → scoped availability action and removable-disabled selector | `npm run test:unit -- assignment-availability fsr-availability multi-select` | Scoped lookup/action tests; UI replacement scenarios after U4/U6 | New action/hook/control and optional option fields, preserving old defaults |
| U4 | U3 selector → create/edit/tracking dated composition | `npm run test:unit -- assignment-form assignment-edit-form tracking` | Dated create/edit/tracking UI replacement after U6 | Assignment/tracking UI and date DTO plumbing; existing mutation guards retained |
| U5 | Existing partial field UX → truthful attachment-only retry, accessible ODT and review | `npm run test:unit -- assignment-activity-form odt-folio-capture` | `npm run test:e2e:workflows -- --grep incident` after U6 | Activity client state, ODT labels and admin detail fields; no machine/schema rollback |
| U6 | Existing lifecycle → opt-in runner, synthetic prerequisites and decoded-image helper | `npm run test:unit -- e2e workflow ephemeral-db` | `npm run test:e2e:workflows -- --list` for discovery, then actual U7/U8 workflows; listing alone is not workflow proof | Runner flag/options, config project exclusions, fixtures and npm invocation |
| U7 | U1/U2/U6 → employee/admin vacation workflow evidence | `npm run test:e2e:workflows -- --grep vacation` | Same invocation, authenticated UI and read-only balance/snapshot corroboration | Vacation workflow spec and UI helpers; prerequisites retained for incident suite |
| U8 | U3–U6 → full independent FSR handoff evidence | `npm run test:e2e:workflows -- --grep incident` | Same invocation, two role contexts/vehicles and last-sibling closure | Incident workflow/helper additions; application features remain independent |

## Phase 1: Pending Vacation Backend and Permission Rollout (U1)

- [x] 1.1 Add strict `VacationUpdateSchema` and `VacationUpdateInput` in `src/lib/validations/vacations.ts`; allow dates/reason/optional period only and reject holder/status/approval fields. Verify invalid dates/reason return business input errors through the action rather than stripped production exceptions.
- [x] 1.2 Add trusted own-request exclusion options to `getPeriodBalance` and `resolveVacationPeriod` in `src/lib/services/vacation-periods.ts`; propagate to explicit/candidate funding, aggregate reservations and historical-policy reservation inputs. Preserve ledger consumption and every default caller. Extend `src/lib/services/vacation-periods.test.ts` for old reservation exclusion, different-period replacement and historical funding.
- [x] 1.3 Implement `updateVacation` in `src/lib/actions/vacations.ts`: require update; own-or-manage holder; active/PENDIENTE stable-code guard; CDMX/date/retroactive/zero-charge/overlap/single-period/balance rules in one serializable transaction; conditional pending update. Reason-only changes preserve snapshots. Verify decision/cancel winner rejects a stale draft without writes.
- [x] 1.4 In the same action transaction, append `BusinessCorrection` before/after evidence with actor and `PENDING_EDIT` operation marker, immutable holder and original approval metadata; preserve prior correctionHistory/grant snapshots. Add `src/lib/actions/vacations-update.test.ts` cases for owner/admin success, holder/terminal rejection, own-excluded reservation, invalid rollback, reason-only preservation and audit-failure rollback. Revalidate own/admin pages after commit.
- [x] 1.5 Add typed `vacations:update` and explicit EMPLEADO/FSR/ADMIN_VACACIONES grants in `src/lib/authz/permission-catalog.ts`; avoid unintentionally granting ADMIN_OPERACION through the shared self-service spread. Create additive idempotent `prisma/migrations/<timestamp>_vacations_update_permission/migration.sql` using existing unique-name/role-code/composite-grant conventions; preserve unrelated grants and ROOT behavior. Extend catalog tests and migration-replay coverage. (Plus `initial_load/seed.example.ts` grant convergence for fresh databases: migration-time roles do not exist yet on fresh DBs, so the template seed carries the same grants.)
- [x] 1.6 Add `src/test/integration/vacations-update.int.test.ts` for real edit-vs-approval/rejection/cancellation, competing reservation replacement, before/after audit and historical ledger preservation; assert one consistent winner and unchanged losing operation. Follow existing ephemeral integration harness. (Verified 2026-10-12: 8/8 pass on ephemeral PostgreSQL.)

## Phase 2: Own/Admin Vacation UI (U2; depends on Phase 1)

- [x] 2.1 Create `src/components/vacations/vacation-edit-dialog.tsx` backed by current scoped `getVacationById` and `updateVacation`: read-only holder, CDMX date fields/reason and eligible period selection, busy/error states and retained drafts after rejection. Add focused component coverage for successful edit, invalid range, stale-status failure and immutable holder.
- [x] 2.2 Create `src/components/vacations/vacation-request-actions.tsx`: pending edit visibility gated by update, own/admin cancellation confirmation delegated to `deleteVacation`, preserved draft on error and refresh on success. Keep approved-started corrections in existing `src/components/vacations/vacation-approval-buttons.tsx`; tests prove started cancellation rejects and cannot route through pending edit.
- [x] 2.3 Wire actions into desktop rows and mobile cards in `src/app/vacations/page.tsx` and `src/app/admin/vacations/page.tsx`, passing permission hints and immutable request identity; retain existing admin approval/rejection/correction UI. Verify EMPLEADO and FSR use the actual shared `/vacations` route and no cross-owner record is exposed.

## Phase 3: Scoped Availability and Removable Disabled Selection (U3)

- [x] 3.1 Create `src/lib/actions/assignment-availability.ts` with scoped `getAssignmentFsrAvailability`, strict civil date/incident/assignment validation and server-derived active FSR candidates; reuse availability policy and return only HOLIDAY/APPROVED_ABSENCE categories. Add action tests for access/mismatched target denial, null date, pending/rejected vacation neutrality, approved/holiday blocking and absence of private reason in returned payload.
- [x] 3.2 Extend `src/components/ui/multi-select.tsx` with optional per-option disabled/explanation: block new additions while allowing selected deselection/chip removal, keyboard removal of overflow and globally disabled mutation behavior. Add `src/components/ui/multi-select.test.tsx` to verify unavailable selected removal and unchanged unrelated selections/default consumers.
- [x] 3.3 Create `src/hooks/use-fsr-availability.ts` and, if needed, `src/components/assignments/fsr-availability-select.tsx` for generation-keyed lookups, immediate stale readiness invalidation, visible pending/error/retry and preserved selected IDs. Add component/hook tests for reversed response order, date/incident changes, closed/unmounted editor, lookup failure and null-date deferred semantics.

## Phase 4: Date Plumbing and Assignment/Tracking Wiring (U4; depends on Phase 3)

- [x] 4.1 Integrate date-aware FSR control into `src/components/admin/assignments/assignment-form.tsx` and `src/components/assignments/assignment-edit-form.tsx`; bind effective dates, labels and authoritative save errors. Verify disabled unavailable creation candidate and removal/replacement of an already-selected unavailable person without silent deselection.
- [x] 4.2 Add assignment `scheduledDate` projection/payload handling in `src/lib/actions/tracking.ts`; route date-changing edits through existing transactional composition/update validation. Extend tracking action tests for final-set replacement, retained unavailable rejection, null date and untouched incident enablement semantics.
- [x] 4.3 Integrate effective-date input/availability into every assignment create/composition surface in `src/components/tracking/tracking-table.tsx`, including desktop/mobile; update DTO/drafts and preserve persisted date on composition-only changes. Verify create/edit/tracking share the same disabled/removable behavior and server rejection refreshes hints.

### U3/U4 executor evidence (standard mode; runtime pending)

Tasks 3.1–3.3 and 4.1–4.3 are implemented with focused evidence in `apply-U3-U4.md`. Their checkboxes remain pending until the coordinator records applicable isolated runtime/UI replacement evidence. Final invocation: `npm run test:unit -- assignment-availability fsr-availability multi-select assignment-form assignment-edit-form tracking assignments-build actions-contract access-contract` — exit 0, 13 files / 148 tests passed. Scoped Biome — exit 0, 17 files clean. `npx tsc --noEmit --incremental false` — exit 0. No database, integration or E2E runner was executed by this executor. Scoped hybrid topic: `sdd/role-workflow-e2e/apply-U3-U4`; global progress is not overwritten.

## Phase 5: Field UX and Administrative Evidence (U5)

- [x] 5.1 Update `src/components/assignments/odt-folio-capture.tsx` with Label/input association, distinct accessible save/cancel names and decorative icon semantics. Add `src/components/assignments/odt-folio-capture.test.tsx` for keyboard save/cancel, saved-value restoration and rejected-save draft retention.
- [x] 5.2 Refactor `src/components/assignments/assignment-activity-form.tsx` into committed-activity/per-file retry state: detect fulfilled unsuccessful ActionResults and rejected uploads, retain failed files, retry attachments only and avoid successful-file reupload or duplicate activity. Always release loading. Add `src/components/assignments/assignment-activity-form.test.tsx` proving create is called once across partial failure/retry and completion fires only after success.
- [x] 5.3 Extend `src/app/admin/assignments/[id]/page.tsx` with persisted ODT/start-end GPS/timestamps/addresses and explicit missing states using null checks; retain existing activities/attachment preview and scoped access. Verify zero coordinates render and review adds no status mutation or closure gate.

## Phase 6: Dedicated Ephemeral Runner and Synthetic Fixtures (U6)

- [x] 6.1 RED: add mocked runner/options tests in `scripts/e2e.test.mjs` (or extracted `scripts/lib/workflow-options.test.mjs`) before runner changes: consume `--workflows`, enforce project/worker and reject conflicting overrides before startup, preserve `shell:false`, propagate nonzero prepare/build/browser outcomes and cleanup on each failure plus SIGINT/SIGTERM. Preserve unsafe-URL rejection coverage in `e2e/fixtures/ephemeral-db.test.ts`. No real DB/browser subprocesses in these unit tests.
- [x] 6.2 GREEN: modify `scripts/e2e.mjs` and add `scripts/lib/workflow-options.mjs` only if extraction is needed; implement isolated `--workflows` opt-in, E2E_WORKFLOWS flag, argument-array project/one-worker enforcement and existing fresh prepare/build/finally/signal cleanup. Add `test:e2e:workflows` in `package.json` without changing dependencies. Serialize shared-stack invocations operationally.
- [x] 6.3 Add opt-in Chromium `workflows` project in `playwright.config.ts` with workflow-directory match, one-worker/nonparallel semantics and existing browser fallback; exclude workflow paths from every other project. Verify discovery lists workflows once and normal runs exclude them. UI login uses dedicated synthetic contexts instead of root-admin shared auth setup.
- [x] 6.4 Create `e2e/fixtures/workflows.ts` for namespaced users/roles/memberships, center/hierarchy, two vehicles, calendar/accrual/hire-date prerequisites and guaranteed cleanup; assert ephemeral DB before writes. Snapshot/restore holiday flags, ensure actual CDMX work day unblocked and earned funding/grace across year boundaries. Handle Sunday charge ranges and midnight rollover without a production clock change. No raw inserts/updates of tested business entities.
- [x] 6.5 Create `e2e/fixtures/workflow-ui.ts` for authentic role login/context management, stable row/dialog scoping, UI-returned IDs, geolocation setup and uploaded-image decode assertions; use valid image buffers with nonzero dimensions. Add pure helper tests for civil-day/year/Sunday fixture calculations and actual valid-image handling where meaningful.

## Phase 7: Vacation Acceptance Workflows (U7; depends on Phases 1, 2, 6)

- [x] 7.1 Create `e2e/workflows/vacation-role-workflow.spec.ts` own EMPLEADO/FSR and admin-on-behalf create/read/pending edit cases; assert immutable holder, UI date/reason and own-excluded replacement balance with read-only snapshot/audit corroboration (RF-711).
- [x] 7.2 In the same workflow file add UI approval/rejection and own/admin eligible cancellation cases; assert reservation retention/release, attribution and original decision preservation. Cover pending and approved-before-start cancellation through the reused guards (RF-702/709).
- [x] 7.3 Add started-approved correction created retroactively and approved through admin UI: explicit creation reason, mandatory separate correction reason, rejected cancellation, retained today/past dates and original approval/charge snapshots, released future consumption; no raw approved fixture or clock movement (RF-709).
- [x] 7.4 Add authentic cross-owner navigation/control-denial, non-admin approval/correction route/control denial, stale pending draft after another actor decides/cancels, and invalid replacement date/overlap/balance cases. Corroborate no mutation; malicious holder payloads/action-boundary negatives remain covered by Phase 1 unit/integration tests.

## Phase 8: Incident and Independent Field Acceptance Workflow (U8; depends on Phases 2–6)

- [x] 8.1 Create `e2e/workflows/incident-role-workflow.spec.ts`: candidate A requests vacation and admin approves via UI; REPORTER reports its center incident with real decoded image; operations links that exact incident to a schedule through programming/schedule UI. Assert same incident ID/link and no substituted incident (RF-201/217/402/408).
- [x] 8.2 In the main workflow prove A is visibly unavailable/disabled, operations selects B/C and creates two separate dated assignments for the same incident. Add UI replacement scenarios for full edit/tracking with already-selected unavailable FSRs, approving the absence after UI assignment creation; no auto reassignment (RF-262/704).
- [x] 8.3 Drive B/C through their own VISTO → INICIADO GPS → EN_PROGRESO → resumed INICIADO phases, interleaving to prove sibling independence. Each records its activity/image and distinct accessible ODT. Exercise missing ODT/evidence closure failure before supplying required evidence (RF-252–259/263).
- [x] 8.4 Start separate assignment-linked trips on two vehicles while assignments remain open; prove both EN_CURSO concurrently and one trip ending does not release the other's vehicle. Finish each through UI with valid start/end odometer photos/GPS and monotonic readings; decode both photos and assert completed status/km/links before assignment closure (RF-357/358/365).
- [x] 8.5 Close first assignment with final GPS and assert sibling remains open and incident nonterminal; close last sibling and assert automatic parent closure before operations review. Review both assignment details and completed trips for distinct ODTs/GPS/timestamps/activity images/photos, with real decoding and no admin approval gate (RF-202/257/264).

## Phase 8b: Filesystem Upload Serving (RF-265; discovered by failing WF-03 evidence)

- [x] 8b.1 Add `specs/file-serving/spec.md` with ADDED RF-265 (dynamic per-request disk reads, unchanged stored URLs/providers, traversal/missing fail closed, optimizer receives valid images).
- [x] 8b.2 Implement `src/app/uploads/[...path]/route.ts` (public, traversal guard, extension content types, immutable cache) with `src/app/uploads/[...path]/route.test.ts` (fresh-file serving, 404s, octet-stream fallback). Verified: 4/4 unit tests pass; `npm run check` clean.
- [x] 8b.3 Merge RF-265 into `spec/04-asignaciones.md` (all old blocks/scenarios preserved) and add the traceability row in `docs/business-invariants.md`.
- [x] 8b.4 Prove route-over-`public/` precedence and fresh-file decoding through the dedicated workflows run (decoded reporter/activity/odometer previews).

## Phase 8c: Full-Edit Save Payload (discovered by failing replacement journey)

- [x] 8c.1 `assignment-edit-form.tsx` no longer sends dummy `incidentId: 0` (fails `intIdSchema`, rejected every full-edit save before the transaction); `updateAssignment` accepts an optional incidentId it resolves from the assignment id. Component test pins the absence.
- [x] 8c.2 Prove the full-edit replacement journey persists through the dedicated workflows run. (Verified: both replacement journeys pass, 14.0s/13.3s.)

## Phase 9: Domain Traceability and Implementation Verification

- [x] 9.1 Append RF-711 to `spec/10-festivos-vacaciones.md` and RF-262–264 to `spec/04-asignaciones.md`; retain every old requirement/scenario and RF-261's existing trip-retry use. Update `docs/business-invariants.md` requirement-to-test traceability for atomic replacement and snapshot preservation.
- [x] 9.2 Update `e2e/README.md` with dedicated command, one-worker/project isolation, fixed-stack no-overlap rule, prerequisites-only fixture boundary, controlled calendar and decoded-photo evidence. Keep docs with U6/U7/U8 review units, not a detached docs-only implementation slice.
- [x] 9.3 Implementation coordinator runs focused unit checks, `npm run check`, appropriate ephemeral integration tests, dedicated `npm run test:e2e:workflows` and build; record actual results and failures without marking pending work complete based on test discovery/screenshots alone. Inspect fixture writes and assert every tested transition is authenticated UI. Do not run integration/E2E simultaneously.

## Worker Handoff

Backend worker owns U1 contracts; vacation UI worker consumes them in U2. Selector worker owns U3/U4 and shared tracking DTO/action coordination. Field worker owns U5. Workflow worker owns U6–U8 and the single runner/config/package changes; it consumes backend/UI contracts and cannot seed outcomes. Coordinator owns U9/shared domain docs and task progress. These are ownership instructions, not delegated agents launched by this artifact task.

No tests, DB runners, migrations, production operations, commits or pushes are executed during artifact creation. Mark each task complete only with implementation evidence in a later apply phase.
