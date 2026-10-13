# Proposal: Role-owned workflows with authentic UI evidence

## Intent

Implement the approved vacation-editing and field-work UX contract, then prove complete role handoffs through authenticated UI workflows. Existing `spec/*.md` remains authoritative; this change adds requirements without replacing existing rules or scenarios.

## Scope

### In Scope
- Pending-only vacation date/reason editing with immutable holder, ownership checks, atomic reservation replacement and before/after audit; shared `vacations:update` grants and additive idempotent migration.
- Own/admin cancellation controls that reuse `deleteVacation`; preserve approval, cancellation and started-vacation correction rules.
- Date-aware FSR selection in assignment creation, full editing and tracking: disabled unavailable candidates, removable selected chips, privacy-safe operational explanations, stale-response protection and authoritative server guards.
- Accessible ODT capture; activity attachment failure detection and attachment-only retry; admin detail displaying ODT and start/end GPS.
- Authentic REPORTER → operations → two independent FSR/two vehicle → operations review workflow, plus employee/admin vacation CRUD, decisions, cancellation, corrections and ownership negatives.
- Dedicated `workflows` Playwright project/invocation with one worker, fresh ephemeral stack, controlled calendar prerequisites, decoded image assertions and cleanup.

### Out of Scope
- Production clock changes, production DB operations, automatic reassignment, a new approval gate before incident closure, commits or pushes.
- Raw fixture writes for any transition under test; broader offline synchronization or historical snapshot reconstruction.

## Capabilities

### New Capabilities
- `vacation-request-editing`: additive RF-711 for pending editing, reservation replacement, audit and permission rollout; references existing RF-701/702/706/709 unchanged.
- `assignment-workflow-ux`: additive RF-262–264 for date-aware selection, accessible ODT/attachment retries and review evidence; RF-261 is already used for trip retries. References RF-010/250–261/703–705/515 unchanged.
- `role-workflow-e2e`: authenticated UI acceptance contract mapped to existing domain RF IDs, including last-sibling automatic closure and isolated execution.

### Modified Capabilities
None. Existing OpenSpec names are `auditoria-observabilidad` and `renames-cliente-reporter`; neither needs a replacement requirement. Use existing audit infrastructure and current code identifiers (`Client`, REPORTER), without rewriting historical rename artifacts.

## Approach

Extend existing Server Actions and serializable vacation funding helpers; keep domain guards inside the mutation transaction. Reuse existing forms, cancellation/correction actions, availability utilities, state machines and trip capture. Vacation before/after evidence uses the existing append-only `BusinessCorrection` store: generic `AuditLog` has no Vacation entity and filters free text. Build isolated synthetic prerequisites and role browser contexts; perform every business operation asserted by the workflows via the UI. Approval snapshots become immutable once approved; a pending date change replaces its provisional charge snapshot atomically.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/lib/actions/vacations.ts`, `src/lib/services/vacation-periods.ts`, `src/lib/validations/vacations.ts` | Modified | Pending edit, own-reservation exclusion, guards and audit |
| `src/lib/authz/permission-catalog.ts`, `prisma/migrations/` | Modified/New | Typed grant and additive role-permission migration |
| `src/components/vacations/`, `src/app/{vacations,admin/vacations}/` | Modified/New | Edit/cancel UI on own/admin surfaces |
| `src/components/admin/assignments/assignment-form.tsx`, `src/components/assignments/assignment-edit-form.tsx`, `src/components/tracking/tracking-table.tsx` | Modified | Date-aware FSR options and replacement |
| `src/components/ui/multi-select.tsx`, `src/lib/utils/availability.ts` | Modified | Disabled option semantics and safe availability projection |
| `src/components/assignments/{odt-folio-capture,assignment-activity-form}.tsx`, `src/app/admin/assignments/[id]/page.tsx` | Modified | Accessibility, retry and review evidence |
| `playwright.config.ts`, `package.json`, `scripts/e2e.mjs`, `e2e/fixtures/`, `e2e/workflows/` | Modified/New | Dedicated isolated UI workflow suite |
| `openspec/config.yaml` | Modified | Refresh stale context/testing descriptions only |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Double-reserved balance or decision/edit race | Medium | Serializable transaction, exclude only current pending request, conditional pending write and rollback |
| Approved or legacy evidence rewritten | Medium | Restrict editing to pending; separate existing correction path; preserve historical grants and approved snapshots |
| Availability response races or private absence leakage | Medium | Latest-request identity and minimal operational DTO; server remains authoritative |
| Partial upload appears successful or creates duplicate activity | High | Inspect fulfilled ActionResult failures; retain committed activity ID and retry failed files only |
| Calendar-dependent E2E instability or shared-stack interference | High | Dedicated invocation, one worker, civil-date setup and fresh stack; lifecycle excludes concurrent shared-stack runners |
| Overlarge implementation review | High | Deliver reviewable vacation, selector/field UX and workflow work units; forecast in tasks |

## Rollback Plan

Revert app/UI/test changes and disable the new workflow invocation. Retain additive permission rows and all edit/correction audit evidence; old code ignores the added permission. Do not reverse audit history, reset databases or recompute historical snapshots. If grant removal is subsequently needed, use an explicit reviewed migration rather than destructive rollback SQL.

## Dependencies

- Existing RBAC catalog, append-only audit writer, serializable funding helpers, availability guards, state machines and ephemeral lifecycle.
- Installed Chromium, Docker and existing test stack for later execution; artifact creation does not run tests or DB runners.
- Worker coordination for shared files and future domain-spec synchronization; this artifact agent owns only this change folder and config descriptions.

## Success Criteria

- [ ] Pending own/admin edits preserve holder and replace reservation atomically; unauthorized, terminal and concurrent decision edits reject without mutation.
- [ ] Unavailable FSRs cannot be newly selected; existing unavailable selections can be removed on all assignment surfaces without exposing private reasons.
- [ ] ODT controls are keyboard/screen-reader accessible; failed attachments retry without duplicate activity or successful-file uploads.
- [ ] Admin sees persisted ODT/GPS and evidence after both independent assignments close; first sibling closure keeps the incident open, last sibling closes it automatically before review.
- [ ] Dedicated UI vacation and incident workflows pass using real decoded photos, synthetic prerequisites and fresh ephemeral lifecycle.
