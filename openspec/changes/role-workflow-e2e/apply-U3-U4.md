# Apply U3/U4: Assignment availability and dated composition

## Structured status consumed

- Dedicated sdd-apply executor; no delegation. schemaName: spec-driven; applyState: ready at launch.
- artifactStore: hybrid; planningHome/changeRoot: `openspec/changes/role-workflow-e2e`.
- Read proposal.md, design.md, tasks.md and all three supplied delta specifications.
- actionContext: workspace-build; allowedEditRoots: `/home/abdiel/work/opustrack`.
- Assigned tasks: 3.1–3.3 and 4.1–4.3 only. Standard mode (`strict_tdd: false`).
- Delivery: auto-chain, bounded U3/U4; feature-branch-chain planned, no publication.
- Status: implementation/unit evidence complete; runtime evidence pending; not ready for archive.

## Implementation

| Task | Implementation evidence | Runtime status |
|---|---|---|
| 3.1 | Strict civil-date/object validation; manage-all; active scoped incident/assignment membership inside query transaction; server-derived active FSRs; holiday/approved-only overlap policy; absence holder-only projection | Real scoped lookup/UI pending |
| 3.2 | Optional disabled/explanation fields; disabled-add/removable-selected semantics; overflow names/keyboard removal; global disabled; default consumers covered | Browser accessibility/replacement pending |
| 3.3 | Generation/key identity includes date/incident/assignment/editor/retry; immediate readiness invalidation; late/closed/unmounted results ignored; loading/error/retry; retained selections | Browser query-race/replacement pending |
| 4.1 | Shared selector in create/full edit; actual incident/effective date; retained identities/drafts; rejection refresh; unchanged full-edit date omitted to preserve its instant | Authenticated create/full-edit replacement pending |
| 4.2 | Tracking date projection; shared internal composition mutation; details/date/final set in one existing transaction; manager/scope, availability, differential reassignment, state-machine and sync retained; same-day composition preserves instant | Real transaction/UI pending |
| 4.3 | Date drafts/inputs/payloads and selector in both existing tracking create surfaces/composition editor; single save; rejection refresh; duplicate create form removed in incident quick-edit mode | Tracking UI replacement pending |

Task checkboxes remain pending because applicable runtime evidence is outstanding. Parent-owned phase status is preserved.

## Work Unit Evidence

| Evidence | U3 | U4 |
|---|---|---|
| Focused test command/result | Combined final invocation below: exit 0, 13 files / 148 tests passed; action/privacy, hook/race, shared control/MultiSelect and action contracts included | Same invocation; both forms, both tracking creation surfaces, composition/date preservation and existing machine parity included |
| Runtime harness/result | `npm run test:e2e:workflows -- --grep incident` after U6: PENDING. Mocked Prisma action tests are not real-DB proof | Same parent-owned invocation: PENDING dated create/full edit/tracking unavailable-selection replacement and authoritative rejection |
| Rollback boundary | New DTO/action/hook/shared selector and optional MultiSelect fields/tests; revert dependent U4 wiring before removing shared imports | Both assignment form edits/tests, tracking-table edits/tests, tracking.ts composition/date projection and tracking.test.ts additions; U3 can remain |

## Commands executed

- `npm run test:unit -- assignment-availability fsr-availability multi-select assignment-form assignment-edit-form tracking assignments-build actions-contract access-contract`: final exit 0, 13 files / 148 tests passed.
- `npx biome check` with the 17 source/test paths below: exit 0, 17 files checked, no fixes applied.
- `npx tsc --noEmit --incremental false`: exit 0. Earlier local mock signature mismatch was fixed; a concurrent parent-owned vacation integration typing error was absent on the next run.
- Earlier scoped Biome formatting corrected formatting and overflow semantics to fieldset. The extracted composition gate initially failed the static access scanner; the public action now explicitly loads its manager-scoped target inside the transaction, and final contract tests pass.
- No DB/integration/E2E/build/git/production command, session registration, commit or PR was executed.

## Exact source/test files

Added:
- `src/lib/assignments/fsr-availability.ts`
- `src/lib/actions/assignment-availability.ts`
- `src/lib/actions/assignment-availability.test.ts`
- `src/hooks/use-fsr-availability.ts`
- `src/hooks/use-fsr-availability.test.tsx`
- `src/components/assignments/fsr-availability-select.tsx`
- `src/components/assignments/fsr-availability-select.test.tsx`
- `src/components/ui/multi-select.test.tsx`
- `src/components/admin/assignments/assignment-form.test.tsx`
- `src/components/assignments/assignment-edit-form.test.tsx`
- `src/components/tracking/tracking-table.test.tsx`

Modified:
- `src/components/ui/multi-select.tsx`
- `src/components/admin/assignments/assignment-form.tsx`
- `src/components/assignments/assignment-edit-form.tsx`
- `src/components/tracking/tracking-table.tsx`
- `src/lib/actions/tracking.ts`
- `src/lib/actions/tracking.test.ts`

Artifacts: this file and scoped tasks.md evidence. Engram mirror: `sdd/role-workflow-e2e/apply-U3-U4` with capture_prompt=false. No global progress/tasks observation is overwritten.

## Runtime selectors

| Surface | FSR control | Date control |
|---|---|---|
| Admin create/form | `#assignment-fsrs` / label `Asignados *` | `#scheduledDate` / label `Fecha programada (opcional)` |
| Full editor after `Editar` | `#assignment-edit-fsrs` / label `Técnicos Asignados *` | `#scheduledDate` |
| Tracking normal create | `#new-fsr-{incidentId}` | `#new-date-{incidentId}` |
| Tracking incident quick-edit create | `#edit-mode-fsr-{incidentId}` | `#edit-mode-date-{incidentId}` |
| Tracking composition | `#wo-fsr-{assignmentId}` | `#wo-date-{assignmentId}` |

Options: role option; accessible name includes identity plus Día festivo/Ausencia aprobada; selected names include seleccionado. New unavailable options expose aria-disabled=true; selected unavailable options permit deselection. Chip/overflow removal: `Quitar {name}`; overflow summary names hidden selections. Error: role alert; retry: `Reintentar disponibilidad`; loading: `Consultando disponibilidad…`.

## Deviations, review packaging and gaps

- DTO adds the public FSR name for labels so server-derived candidates can offer replacements even when old caller options were incident-filtered. No absence reason text, absence IDs or decision metadata is fetched/returned.
- Existing tracking mobile cards are read-only summaries with incident detail links and no local create/composition controls. All existing tracking editors are wired; mobile browser behavior remains pending runtime evidence.
- Combined U3/U4 exceed the 400-line review budget. Finer planned boundaries: action/DTO/privacy tests; MultiSelect/removal tests; hook/control/race tests; canonical tracking transaction/date tests; assignment/tracking UI with component tests. Keep dependencies in the feature-branch chain. Exact authored diff counts remain parent packaging work because git was prohibited; no code compression or size-exception claim.
- Parent owns isolated runtime/integration/E2E, full check/build and global completion. No terminal completion/archive claim.
